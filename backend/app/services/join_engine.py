import pandas as pd
from io import StringIO
from typing import List, Dict, Any


def _overlap_score(s1: pd.Series, s2: pd.Series) -> float:
    """Fraction of values in s1 that appear in s2."""
    try:
        set2 = set(s2.astype(str).str.strip().str.lower())
        matches = s1.astype(str).str.strip().str.lower().isin(set2).sum()
        return matches / max(len(s1), 1)
    except Exception:
        return 0.0


def _name_similarity(a: str, b: str) -> float:
    """Simple normalized edit-distance similarity."""
    try:
        from thefuzz import fuzz
        return fuzz.ratio(a.lower(), b.lower()) / 100.0
    except ImportError:
        a, b = a.lower(), b.lower()
        if a == b:
            return 1.0
        if a in b or b in a:
            return 0.7
        return 0.0


def propose_joins(texts: List[str]) -> List[Dict[str, Any]]:
    """
    Given N extracted_text strings, propose join keys between each pair.
    Returns list of join proposals sorted by confidence.
    """
    dfs: List[pd.DataFrame] = []
    for t in texts:
        try:
            dfs.append(pd.read_csv(StringIO(t)))
        except Exception:
            dfs.append(pd.DataFrame())

    proposals = []
    for i in range(len(dfs)):
        for j in range(i + 1, len(dfs)):
            df_a, df_b = dfs[i], dfs[j]
            if df_a.empty or df_b.empty:
                continue
            best = None
            best_score = 0.0
            for col_a in df_a.columns:
                for col_b in df_b.columns:
                    name_sim = _name_similarity(col_a, col_b)
                    overlap = _overlap_score(df_a[col_a], df_b[col_b])
                    score = 0.5 * name_sim + 0.5 * overlap
                    if score > best_score:
                        best_score = score
                        best = {"left_col": col_a, "right_col": col_b, "confidence": round(score, 2)}
            if best and best_score > 0.2:
                proposals.append({
                    "left_index": i,
                    "right_index": j,
                    "left_col": best["left_col"],
                    "right_col": best["right_col"],
                    "confidence": best["confidence"],
                    "left_columns": list(df_a.columns),
                    "right_columns": list(df_b.columns),
                    "left_rows": len(df_a),
                    "right_rows": len(df_b),
                })

    return sorted(proposals, key=lambda x: x["confidence"], reverse=True)


def apply_join(texts: List[str], left_col: str, right_col: str, left_index: int, right_index: int, how: str = "inner") -> str:
    """Apply a join between two dataframes and return merged CSV."""
    dfs = []
    for t in texts:
        try:
            dfs.append(pd.read_csv(StringIO(t)))
        except Exception:
            dfs.append(pd.DataFrame())

    df_a = dfs[left_index]
    df_b = dfs[right_index]

    # Deduplicate column names before merge
    suffix_a, suffix_b = f"_file{left_index+1}", f"_file{right_index+1}"
    merged = pd.merge(df_a, df_b, left_on=left_col, right_on=right_col, how=how, suffixes=(suffix_a, suffix_b))
    return merged.to_csv(index=False)
