import pandas as pd
import io
from pathlib import Path
from typing import Tuple, Dict, Any, List
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
    """Router for different file type parsers"""

    @staticmethod
    async def parse_file(file_content: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
        """
        Parse uploaded file and return extracted text + schema metadata

        Returns:
            Tuple of (extracted_text, schema_metadata)
        """
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

    @staticmethod
    async def _parse_csv(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        """Parse CSV file"""
        try:
            # Detect encoding
            detected = chardet.detect(file_content)
            encoding = detected.get('encoding', 'utf-8')

            # Read CSV with detected encoding
            df = pd.read_csv(io.BytesIO(file_content), encoding=encoding)

            schema = {
                'file_type': 'csv',
                'rows': len(df),
                'columns': list(df.columns),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
                'sample': df.head(5).to_dict(orient='records'),
            }

            # Convert to readable text format
            text = f"CSV Data\n\n"
            text += f"Rows: {len(df)}, Columns: {len(df.columns)}\n\n"
            text += f"Columns: {', '.join(df.columns)}\n\n"
            text += f"First 5 rows:\n{df.head().to_string()}\n\n"
            text += f"Data types:\n{df.dtypes.to_string()}\n\n"
            text += f"Summary statistics:\n{df.describe().to_string()}"

            return text, schema

        except Exception as e:
            raise ValueError(f"Failed to parse CSV: {str(e)}")

    @staticmethod
    async def _parse_excel(file_content: bytes, filename: str) -> Tuple[str, Dict[str, Any]]:
        """Parse Excel file"""
        try:
            excel_file = pd.ExcelFile(io.BytesIO(file_content))

            # For MVP, parse first sheet only
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

            # Convert to readable text format
            text = f"Excel Data\n"
            text += f"Sheet: {sheet_name}\n\n"
            text += f"Rows: {len(df)}, Columns: {len(df.columns)}\n\n"
            text += f"Columns: {', '.join(df.columns)}\n\n"
            text += f"First 5 rows:\n{df.head().to_string()}\n\n"
            text += f"Data types:\n{df.dtypes.to_string()}\n\n"
            text += f"Summary statistics:\n{df.describe().to_string()}"

            return text, schema

        except Exception as e:
            raise ValueError(f"Failed to parse Excel: {str(e)}")

    @staticmethod
    async def _parse_word(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        """Parse Word document"""
        if not HAS_DOCX:
            raise ValueError("python-docx not installed. Install with: pip install python-docx")

        try:
            doc = Document(io.BytesIO(file_content))

            # Extract all paragraphs
            paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]

            # Extract tables
            tables_data = []
            for table in doc.tables:
                table_rows = []
                for row in table.rows:
                    row_data = [cell.text for cell in row.cells]
                    table_rows.append(row_data)
                tables_data.append(table_rows)

            schema = {
                'file_type': 'docx',
                'paragraphs': len(paragraphs),
                'tables': len(tables_data),
                'has_text': len(paragraphs) > 0,
                'has_tables': len(tables_data) > 0,
            }

            text = "Word Document Content:\n\n"
            text += "Paragraphs:\n" + "\n".join(paragraphs[:20])  # First 20 paragraphs

            if tables_data:
                text += "\n\nTables:\n"
                for i, table_rows in enumerate(tables_data[:5]):  # First 5 tables
                    text += f"\nTable {i+1}:\n"
                    # Convert table to readable format
                    df_table = pd.DataFrame(table_rows[1:], columns=table_rows[0] if table_rows else [])
                    text += df_table.to_string()
                    text += "\n"

            return text, schema

        except Exception as e:
            raise ValueError(f"Failed to parse Word document: {str(e)}")

    @staticmethod
    async def _parse_pdf(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        """Parse PDF file using pdfplumber"""
        if not HAS_PDFPLUMBER:
            raise ValueError("pdfplumber not installed. Install with: pip install pdfplumber")

        try:
            text_content = []
            tables_data = []

            with pdfplumber.open(io.BytesIO(file_content)) as pdf:
                num_pages = len(pdf.pages)

                # Extract text and tables from first 10 pages (MVP)
                for page_num, page in enumerate(pdf.pages[:10]):
                    # Extract text
                    text = page.extract_text()
                    if text:
                        text_content.append(f"--- Page {page_num + 1} ---\n{text}")

                    # Extract tables
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            tables_data.append(table)

            schema = {
                'file_type': 'pdf',
                'total_pages': num_pages,
                'pages_parsed': min(10, num_pages),
                'has_text': len(text_content) > 0,
                'has_tables': len(tables_data) > 0,
                'num_tables': len(tables_data),
            }

            text = "PDF Content (first 10 pages):\n\n"
            text += "\n".join(text_content)

            if tables_data:
                text += "\n\nExtracted Tables:\n"
                for i, table in enumerate(tables_data[:5]):
                    text += f"\nTable {i+1}:\n"
                    df_table = pd.DataFrame(table[1:], columns=table[0] if table else [])
                    text += df_table.to_string()
                    text += "\n"

            return text, schema

        except Exception as e:
            raise ValueError(f"Failed to parse PDF: {str(e)}")

    @staticmethod
    async def _parse_json(file_content: bytes) -> Tuple[str, Dict[str, Any]]:
        """Parse JSON file"""
        try:
            import json

            data = json.loads(file_content.decode('utf-8'))

            # If it's a list of objects, convert to DataFrame
            if isinstance(data, list) and len(data) > 0 and isinstance(data[0], dict):
                df = pd.json_normalize(data)
            elif isinstance(data, dict):
                # If it's nested, try to extract common data structures
                if 'data' in data:
                    df = pd.json_normalize(data['data']) if isinstance(data['data'], list) else pd.DataFrame([data['data']])
                elif 'items' in data:
                    df = pd.json_normalize(data['items']) if isinstance(data['items'], list) else pd.DataFrame([data['items']])
                else:
                    df = pd.DataFrame([data])
            else:
                df = pd.DataFrame([data])

            schema = {
                'file_type': 'json',
                'rows': len(df),
                'columns': list(df.columns),
                'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
                'sample': df.head(5).to_dict(orient='records'),
            }

            text = "JSON Data:\n\n"
            text += f"Rows: {len(df)}, Columns: {len(df.columns)}\n\n"
            text += f"Columns: {', '.join(df.columns)}\n\n"
            text += f"First 5 rows:\n{df.head().to_string()}\n\n"
            text += f"Data types:\n{df.dtypes.to_string()}"

            return text, schema

        except Exception as e:
            raise ValueError(f"Failed to parse JSON: {str(e)}")
