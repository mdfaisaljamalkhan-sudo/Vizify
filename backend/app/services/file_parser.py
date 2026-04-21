import asyncio
import pandas as pd
import io
from pathlib import Path
from typing import Tuple, Dict, Any

import chardet

try:
    from python_docx import Document
    HAS_DOCX = True
except ImportError:
    HAS_DOCX = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False


class FileParser:

    @staticmethod
    async def parse_file(file_content: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
        ext = Path(filename).suffix.lower()
        if ext == '.csv':
            return await FileParser._parse_csv(file_content)
        elif ext in ['.xlsx', '.xls']:
            return await FileParser._parse_excel(file_content, filename)
        elif ext == '.docx':
            return await FileParser._parse_word(file_content)
        elif ext == '.pdf':
            return await FileParser._parse_pdf(file_content)
        elif ext == '.json':
            return await FileParser._parse_json(file_content)
        else:
            raise ValueError(f"Unsupported file type: {ext}")

    # ── Each parser runs the CPU-bound work in a thread so it never
    # ── blocks the asyncio event loop. ──────────────────────────────

    @staticmethod
    async def _parse_csv(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        def _run():
            detected = chardet.detect(file_content)
            encoding = detected.get('encoding') or 'utf-8'
            df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)
            schema = {
                'file_type': 'csv',
                'rows': len(df),
                'columns': list(df.columns),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
                'sample': df.head(5).to_dict(orient='records'),
            }
            text = (
                f"CSV Data\n\nRows: {len(df)}, Columns: {len(df.columns)}\n\n"
                f"Columns: {', '.join(df.columns)}\n\n"
                f"First 5 rows:\n{df.head().to_string()}\n\n"
                f"Data types:\n{df.dtypes.to_string()}\n\n"
                f"Summary statistics:\n{df.describe().to_string()}"
            )
            return text, schema
        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            raise ValueError(f"Failed to parse CSV: {e}")

    @staticmethod
    async def _parse_excel(file_content: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
        def _run():
            excel_file = pd.ExcelFile(io.BytesIO(file_content))
            sheet_name = excel_file.sheet_names[0]
            df = excel_file.parse(sheet_name)
            schema = {
                'file_type': 'excel',
                'sheet_name': sheet_name,
                'sheet_names': excel_file.sheet_names,
                'rows': len(df),
                'columns': list(df.columns),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
                'sample': df.head(5).to_dict(orient='records'),
            }
            text = (
                f"Excel Data\nSheet: {sheet_name}\n\n"
                f"Rows: {len(df)}, Columns: {len(df.columns)}\n\n"
                f"Columns: {', '.join(df.columns)}\n\n"
                f"First 5 rows:\n{df.head().to_string()}\n\n"
                f"Data types:\n{df.dtypes.to_string()}\n\n"
                f"Summary statistics:\n{df.describe().to_string()}"
            )
            return text, schema
        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            raise ValueError(f"Failed to parse Excel: {e}")

    @staticmethod
    async def _parse_word(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        if not HAS_DOCX:
            raise ValueError("python-docx not installed")
        def _run():
            doc = Document(io.BytesIO(file_content))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            tables_data = [
                [[cell.text for cell in row.cells] for row in table.rows]
                for table in doc.tables
            ]
            schema = {
                'file_type': 'docx',
                'paragraphs': len(paragraphs),
                'tables': len(tables_data),
            }
            text = "Word Document Content:\n\nParagraphs:\n" + "\n".join(paragraphs[:20])
            if tables_data:
                text += "\n\nTables:\n"
                for i, rows in enumerate(tables_data[:5]):
                    text += f"\nTable {i+1}:\n"
                    if rows:
                        df_t = pd.DataFrame(rows[1:], columns=rows[0])
                        text += df_t.to_string() + "\n"
            return text, schema
        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            raise ValueError(f"Failed to parse Word document: {e}")

    @staticmethod
    async def _parse_pdf(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        if not HAS_PDFPLUMBER:
            raise ValueError("pdfplumber not installed")
        def _run():
            text_content, tables_data = [], []
            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                num_pages = len(pdf.pages)
                for i, page in enumerate(pdf.pages[:10]):
                    t = page.extract_text()
                    if t:
                        text_content.append(f"--- Page {i+1} ---\n{t}")
                    for tbl in (page.extract_tables() or []):
                        tables_data.append(tbl)
            schema = {
                'file_type': 'pdf',
                'total_pages': num_pages,
                'pages_parsed': min(10, num_pages),
                'has_tables': len(tables_data) > 0,
            }
            text = "PDF Content (first 10 pages):\n\n" + "\n".join(text_content)
            if tables_data:
                text += "\n\nExtracted Tables:\n"
                for i, tbl in enumerate(tables_data[:5]):
                    text += f"\nTable {i+1}:\n"
                    if tbl:
                        df_t = pd.DataFrame(tbl[1:], columns=tbl[0])
                        text += df_t.to_string() + "\n"
            return text, schema
        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {e}")

    @staticmethod
    async def _parse_json(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        def _run():
            import json
            data = json.loads(file_content.decode('utf-8'))
            if isinstance(data, list) and data and isinstance(data[0], dict):
                df = pd.json_normalize(data)
            elif isinstance(data, dict):
                key = 'data' if 'data' in data else ('items' if 'items' in data else None)
                df = pd.json_normalize(data[key]) if key and isinstance(data[key], list) else pd.DataFrame([data])
            else:
                df = pd.DataFrame([data])
            schema = {
                'file_type': 'json',
                'rows': len(df),
                'columns': list(df.columns),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
                'sample': df.head(5).to_dict(orient='records'),
            }
            text = (
                f"JSON Data:\n\nRows: {len(df)}, Columns: {len(df.columns)}\n\n"
                f"Columns: {', '.join(df.columns)}\n\n"
                f"First 5 rows:\n{df.head().to_string()}\n\n"
                f"Data types:\n{df.dtypes.to_string()}"
            )
            return text, schema
        try:
            return await asyncio.to_thread(_run)
        except Exception as e:
            raise ValueError(f"Failed to parse JSON: {e}")
