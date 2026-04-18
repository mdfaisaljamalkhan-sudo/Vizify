import pytest
import pandas as pd
from app.services.sandbox_executor import validate_ast, run_python


class TestASTValidation:
    """Test AST validation against malicious code patterns."""

    def test_reject_import_os(self):
        code = "import os\nos.system('rm -rf /')"
        safe, errors = validate_ast(code)
        assert not safe
        assert any('Import' in e for e in errors)

    def test_reject_import_from(self):
        code = "from subprocess import call\ncall(['ls'])"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_eval(self):
        code = "eval('1 + 1')"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_exec(self):
        code = "exec('x = 1')"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_dunder_import(self):
        code = "__import__('os').system('id')"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_open(self):
        code = "f = open('/etc/passwd')\ndata = f.read()"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_socket(self):
        code = "import socket\ns = socket.socket()"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_globals_access(self):
        code = "globals()['__builtins__']['eval']('1')"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_getattr_exploit(self):
        code = "getattr(__builtins__, 'eval')('1')"
        safe, errors = validate_ast(code)
        assert not safe

    def test_reject_subprocess(self):
        code = "import subprocess\nsubprocess.run(['cat', '/etc/passwd'])"
        safe, errors = validate_ast(code)
        assert not safe

    def test_allow_simple_math(self):
        code = "result = 1 + 2 * 3"
        safe, errors = validate_ast(code)
        assert safe

    def test_allow_list_comprehension(self):
        code = "result = [x * 2 for x in range(10)]"
        safe, errors = validate_ast(code)
        assert safe

    def test_allow_dict_operations(self):
        code = """
d = {'a': 1, 'b': 2}
result = {k: v * 2 for k, v in d.items()}
"""
        safe, errors = validate_ast(code)
        assert safe

    def test_allow_df_groupby(self):
        code = "result = df.groupby('category').sum()"
        safe, errors = validate_ast(code)
        assert safe

    def test_allow_df_sort_values(self):
        code = "result = df.sort_values('amount', ascending=False)"
        safe, errors = validate_ast(code)
        assert safe

    def test_allow_np_operations(self):
        code = "result = np.array([1, 2, 3]).sum()"
        safe, errors = validate_ast(code)
        assert safe

    def test_allow_conditional(self):
        code = """
if len(df) > 0:
    result = df['value'].mean()
else:
    result = 0
"""
        safe, errors = validate_ast(code)
        assert safe

    def test_allow_for_loop(self):
        code = """
total = 0
for item in [1, 2, 3]:
    total += item
result = total
"""
        safe, errors = validate_ast(code)
        assert safe

    def test_syntax_error(self):
        code = "this is not valid python ]["
        safe, errors = validate_ast(code)
        assert not safe
        assert any('Syntax' in e for e in errors)


class TestSandboxExecution:
    """Test sandbox execution with real code."""

    @pytest.fixture
    def sample_df(self):
        return pd.DataFrame({
            'category': ['A', 'B', 'A', 'B', 'A'],
            'amount': [10, 20, 15, 25, 30],
            'value': [100, 200, 150, 250, 300]
        })

    def test_execute_arithmetic(self, sample_df):
        code = "result = 5 + 3"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'success'
        assert output['data']['type'] == 'scalar'
        assert output['data']['data'] == '8'

    def test_execute_df_sum(self, sample_df):
        code = "result = df['amount'].sum()"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'success'
        assert output['data']['type'] == 'scalar'
        assert output['data']['data'] == '100'

    def test_execute_df_groupby(self, sample_df):
        code = "result = df.groupby('category')['amount'].sum()"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'success'

    def test_execute_list_comprehension(self, sample_df):
        code = "result = [x * 2 for x in [1, 2, 3]]"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'success'
        assert output['data']['type'] == 'json'

    def test_execute_df_modification(self, sample_df):
        code = "df['amount_doubled'] = df['amount'] * 2"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'success'
        assert 'amount_doubled' in str(output['data'])

    def test_reject_malicious_import_in_execution(self, sample_df):
        code = "import os\nresult = os.getenv('HOME')"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'error'
        assert 'validation' in output['data'].lower()

    def test_reject_eval_in_execution(self, sample_df):
        code = "result = eval('1+1')"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'error'

    def test_timeout_protection(self, sample_df):
        code = """
result = 0
while True:
    result += 1
"""
        output = run_python(code, sample_df, timeout=1)
        assert output['status'] == 'timeout'

    def test_syntax_error_in_execution(self, sample_df):
        code = "this is not valid python ]"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'error'

    def test_no_result_returns_modified_df(self, sample_df):
        code = "df['doubled'] = df['amount'] * 2"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'success'
        # Should return the dataframe when no explicit result
        assert output['data']['type'] == 'dataframe'

    def test_division_by_zero_caught(self, sample_df):
        code = "result = 1 / 0"
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'error'

    def test_nested_operations_allowed(self, sample_df):
        code = """
filtered = df[df['amount'] > 15]
result = filtered.groupby('category')['value'].mean()
"""
        output = run_python(code, sample_df, timeout=5)
        assert output['status'] == 'success'
