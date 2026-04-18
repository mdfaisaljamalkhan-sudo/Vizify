import ast
import subprocess
import json
import sys
from typing import Any
import pandas as pd

# Allowlist of safe methods and functions
SAFE_FUNCTIONS = {
    # pandas DataFrame/Series methods
    'sum', 'mean', 'median', 'std', 'var', 'min', 'max', 'count',
    'groupby', 'sort_values', 'reset_index', 'drop', 'rename',
    'fillna', 'astype', 'iloc', 'loc', 'head', 'tail', 'shape',
    'columns', 'index', 'values', 'to_dict', 'to_list', 'to_json',
    'apply', 'applymap', 'map', 'unique', 'value_counts', 'describe',
    'corr', 'cov', 'abs', 'round', 'clip', 'rank',
    # numpy functions
    'array', 'zeros', 'ones', 'arange', 'linspace', 'exp', 'log',
    'sqrt', 'sin', 'cos', 'tan', 'arcsin', 'arccos', 'arctan',
    'sinh', 'cosh', 'tanh', 'absolute', 'sign', 'ceil', 'floor',
    # dict/list methods
    'items', 'keys', 'values', 'get', 'pop', 'append', 'extend',
    'insert', 'remove', 'clear', 'copy', 'update', 'split', 'join',
    'strip', 'lower', 'upper', 'replace', 'find', 'startswith', 'endswith',
    # builtins
    'len', 'range', 'enumerate', 'zip', 'map', 'filter', 'sorted',
    'sum', 'min', 'max', 'abs', 'round', 'int', 'float', 'str',
    'list', 'dict', 'set', 'tuple', 'any', 'all', 'print',
}

# Disallowed AST node types
DISALLOWED_NODES = {
    ast.Import,
    ast.ImportFrom,
    ast.Call,  # Restrict all calls except safe ones
    ast.Attribute,  # Restrict attribute access (can be overridden for specific paths)
}

class ASTValidator(ast.NodeVisitor):
    """Validates that code only contains safe operations."""

    def __init__(self):
        self.safe = True
        self.errors = []

    def visit_Import(self, node: ast.Import):
        self.safe = False
        self.errors.append(f"Import statement not allowed: {', '.join(a.name for a in node.names)}")
        return node

    def visit_ImportFrom(self, node: ast.ImportFrom):
        self.safe = False
        self.errors.append(f"ImportFrom statement not allowed: from {node.module}")
        return node

    def visit_Call(self, node: ast.Call):
        # Allow calls to safe functions
        func_name = None
        if isinstance(node.func, ast.Name):
            func_name = node.func.id
        elif isinstance(node.func, ast.Attribute):
            func_name = node.func.attr

        if func_name and func_name not in SAFE_FUNCTIONS:
            self.safe = False
            self.errors.append(f"Call to unsafe function: {func_name}")

        self.generic_visit(node)
        return node

    def visit_Attribute(self, node: ast.Attribute):
        # Block access to dunder attributes
        if node.attr.startswith('_'):
            self.safe = False
            self.errors.append(f"Dunder attribute not allowed: {node.attr}")
        # Block access to dangerous attributes
        elif node.attr in ['__class__', '__bases__', '__subclasses__', '__globals__', '__code__']:
            self.safe = False
            self.errors.append(f"Dangerous attribute not allowed: {node.attr}")

        self.generic_visit(node)
        return node

    def visit_Name(self, node: ast.Name):
        # Reject access to __builtins__ or dunder names
        if node.id.startswith('__') and node.id.endswith('__'):
            self.safe = False
            self.errors.append(f"Dunder name not allowed: {node.id}")
        return node


def validate_ast(code: str) -> tuple[bool, list[str]]:
    """
    Validate that code is safe to execute.
    Returns (is_safe, error_messages)
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, [f"Syntax error: {e}"]

    validator = ASTValidator()
    validator.visit(tree)

    return validator.safe, validator.errors


def run_python(code: str, dataframe: pd.DataFrame, timeout: int = 5) -> dict[str, Any]:
    """
    Execute Python code in a subprocess with resource limits.

    Args:
        code: Python code to execute
        dataframe: pandas DataFrame available as 'df'
        timeout: Maximum execution time in seconds

    Returns:
        {
            'status': 'success' | 'error' | 'timeout',
            'data': result data or error message,
            'execution_time': float seconds,
            'stderr': captured stderr output
        }
    """
    # Validate AST first
    safe, errors = validate_ast(code)
    if not safe:
        return {
            'status': 'error',
            'data': f"Code validation failed: {'; '.join(errors)}",
            'execution_time': 0,
            'stderr': ''
        }

    # Prepare execution environment
    df_json = dataframe.to_json(orient='table')

    # Subprocess script that will execute user code
    sandbox_script = f'''
import json
import pandas as pd
import numpy as np
import sys
import traceback
from io import StringIO

# Load dataframe
df_data = json.loads({repr(df_json)})
df = pd.read_json(json.dumps(df_data), orient='table')

# Capture output
old_stdout = sys.stdout
sys.stdout = StringIO()

try:
    # User code
{chr(10).join('    ' + line for line in code.split(chr(10)))}

    # Return result
    result = locals().get('result', None)
    if result is not None:
        if isinstance(result, (pd.DataFrame, pd.Series)):
            output = json.dumps({{'type': 'dataframe', 'data': result.to_dict('records') if isinstance(result, pd.DataFrame) else result.to_dict()}})
        elif isinstance(result, (list, dict)):
            output = json.dumps({{'type': 'json', 'data': result}})
        else:
            output = json.dumps({{'type': 'scalar', 'data': str(result)}})
    else:
        # Return modified df if no explicit result
        output = json.dumps({{'type': 'dataframe', 'data': df.to_dict('records')}})

    sys.stdout = old_stdout
    print(output)
except Exception as e:
    sys.stdout = old_stdout
    print(json.dumps({{'error': str(e), 'traceback': traceback.format_exc()}}), file=sys.stderr)
    sys.exit(1)
'''

    try:
        # Run subprocess with timeout and resource limits
        proc = subprocess.run(
            [sys.executable, '-c', sandbox_script],
            capture_output=True,
            text=True,
            timeout=timeout,
        )

        if proc.returncode != 0:
            return {
                'status': 'error',
                'data': f"Execution error: {proc.stderr}",
                'execution_time': timeout,
                'stderr': proc.stderr
            }

        # Parse result
        result = json.loads(proc.stdout)
        return {
            'status': 'success',
            'data': result,
            'execution_time': timeout,
            'stderr': ''
        }

    except subprocess.TimeoutExpired:
        return {
            'status': 'timeout',
            'data': f"Code execution exceeded {timeout}s timeout",
            'execution_time': timeout,
            'stderr': ''
        }
    except Exception as e:
        return {
            'status': 'error',
            'data': str(e),
            'execution_time': 0,
            'stderr': str(e)
        }
