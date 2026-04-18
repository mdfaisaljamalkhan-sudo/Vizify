import logging
from typing import Dict, List, Any
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)


class DataQuality:
    """Analyze data quality issues in uploaded files."""

    @staticmethod
    def analyze(df: pd.DataFrame) -> Dict[str, Any]:
        """
        Run comprehensive data quality checks.
        Returns findings: nulls, duplicates, outliers, type inconsistencies.
        """
        if df.empty:
            return {"error": "Empty dataframe"}

        findings = {
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "nulls": DataQuality._analyze_nulls(df),
            "duplicates": DataQuality._analyze_duplicates(df),
            "outliers": DataQuality._analyze_outliers(df),
            "type_issues": DataQuality._analyze_type_consistency(df),
            "suspicious_values": DataQuality._analyze_suspicious_values(df),
        }

        return findings

    @staticmethod
    def _analyze_nulls(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect and report null values per column."""
        nulls = []
        for col in df.columns:
            null_count = df[col].isna().sum()
            null_pct = (null_count / len(df)) * 100
            if null_count > 0:
                nulls.append({
                    "column": col,
                    "count": int(null_count),
                    "percentage": round(null_pct, 2),
                    "suggestion": f"Fill with median, mode, or drop rows" if null_pct < 50 else "Consider dropping column"
                })
        return nulls

    @staticmethod
    def _analyze_duplicates(df: pd.DataFrame) -> Dict[str, Any]:
        """Detect and report duplicate rows."""
        total_duplicates = df.duplicated().sum()
        if total_duplicates == 0:
            return {"count": 0, "percentage": 0, "suggestion": "No duplicates found"}

        dup_pct = (total_duplicates / len(df)) * 100
        return {
            "count": int(total_duplicates),
            "percentage": round(dup_pct, 2),
            "suggestion": "Remove duplicate rows to improve analysis" if dup_pct < 10 else "High duplicate rate - investigate data source"
        }

    @staticmethod
    def _analyze_outliers(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect outliers using IQR method for numeric columns."""
        outliers = []
        numeric_cols = df.select_dtypes(include=[np.number]).columns

        for col in numeric_cols:
            q1 = df[col].quantile(0.25)
            q3 = df[col].quantile(0.75)
            iqr = q3 - q1

            if iqr == 0:  # No variation in data
                continue

            lower_bound = q1 - 1.5 * iqr
            upper_bound = q3 + 1.5 * iqr

            outlier_mask = (df[col] < lower_bound) | (df[col] > upper_bound)
            outlier_count = outlier_mask.sum()

            if outlier_count > 0:
                outlier_pct = (outlier_count / len(df)) * 100
                outliers.append({
                    "column": col,
                    "count": int(outlier_count),
                    "percentage": round(outlier_pct, 2),
                    "lower_bound": float(lower_bound),
                    "upper_bound": float(upper_bound),
                    "suggestion": "Review and potentially remove outliers" if outlier_pct < 5 else "Many outliers - verify data quality"
                })

        return outliers

    @staticmethod
    def _analyze_type_consistency(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect columns with mixed types or inconsistent values."""
        issues = []

        for col in df.columns:
            # Check for mixed types in object columns
            if df[col].dtype == 'object':
                non_null = df[col].dropna()
                if len(non_null) > 0:
                    types_in_col = set(type(val).__name__ for val in non_null)
                    if len(types_in_col) > 1:
                        issues.append({
                            "column": col,
                            "issue": "Mixed types (numeric + string values)",
                            "types_found": list(types_in_col),
                            "suggestion": "Coerce to consistent type (likely string)"
                        })

                    # Check for numeric strings
                    numeric_strings = sum(1 for val in non_null if isinstance(val, str) and val.replace('.', '', 1).replace('-', '', 1).isdigit())
                    if numeric_strings > len(non_null) * 0.5:
                        issues.append({
                            "column": col,
                            "issue": "Likely numeric column stored as string",
                            "suggestion": "Convert to numeric type"
                        })

        return issues

    @staticmethod
    def _analyze_suspicious_values(df: pd.DataFrame) -> List[Dict[str, Any]]:
        """Detect suspicious patterns like impossible dates or negative counts."""
        suspicious = []

        for col in df.columns:
            # Check for negative values in columns that shouldn't have them
            if any(substring in col.lower() for substring in ['count', 'amount', 'quantity', 'sales', 'revenue']):
                if df[col].dtype in [np.int64, np.float64]:
                    negative_count = (df[col] < 0).sum()
                    if negative_count > 0:
                        suspicious.append({
                            "column": col,
                            "issue": f"Negative values in '{col}' (likely should be positive)",
                            "count": int(negative_count),
                            "suggestion": "Verify data - negative counts/sales are unusual"
                        })

            # Check for suspiciously high values
            if df[col].dtype in [np.int64, np.float64]:
                max_val = df[col].max()
                if max_val > 1_000_000_000:  # 1B+
                    suspicious.append({
                        "column": col,
                        "issue": f"Extremely high value detected ({max_val:,.0f})",
                        "suggestion": "Verify unit (e.g., is this in millions?)"
                    })

        return suspicious

    @staticmethod
    def apply_fixes(df: pd.DataFrame, fixes: Dict[str, Any]) -> pd.DataFrame:
        """
        Apply suggested data quality fixes.
        Supported fixes: fill_nulls, drop_duplicates, coerce_types.
        """
        df = df.copy()

        # Fill nulls with median or mode
        if fixes.get("fill_nulls"):
            for col in df.columns:
                if df[col].isna().sum() > 0:
                    if df[col].dtype in [np.int64, np.float64]:
                        df[col].fillna(df[col].median(), inplace=True)
                    else:
                        df[col].fillna(df[col].mode()[0] if len(df[col].mode()) > 0 else "Unknown", inplace=True)
            logger.info("Filled null values")

        # Drop duplicates
        if fixes.get("drop_duplicates"):
            original_len = len(df)
            df = df.drop_duplicates()
            logger.info(f"Dropped {original_len - len(df)} duplicate rows")

        # Coerce types
        if fixes.get("coerce_types"):
            for col in df.columns:
                if df[col].dtype == 'object':
                    # Try to convert to numeric
                    numeric = pd.to_numeric(df[col], errors='coerce')
                    if numeric.notna().sum() > len(df) * 0.8:
                        df[col] = numeric
                        logger.info(f"Coerced {col} to numeric")

        return df
