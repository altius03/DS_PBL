from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
SOURCE_FILE = ROOT / "data" / "analysis_ready" / "kobis_korean_movies_analysis_ready_2016_2025.csv"
OUTPUT_DIR = ROOT / "data" / "분석준비_관객100초과"
OUTPUT_FILE = OUTPUT_DIR / "한국영화_분석준비완료_2016_2025_관객100초과.csv"
SUMMARY_FILE = OUTPUT_DIR / "필터_요약.txt"
MIN_AUDIENCE_COUNT = 100


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def load_source_data() -> pd.DataFrame:
    df = pd.read_csv(SOURCE_FILE)
    df["total_audience_count"] = pd.to_numeric(df["total_audience_count"], errors="coerce")
    return df


def filter_data(df: pd.DataFrame) -> pd.DataFrame:
    return df.loc[df["total_audience_count"] > MIN_AUDIENCE_COUNT].copy()


def save_summary(source_rows: int, filtered_rows: int) -> None:
    removed_rows = source_rows - filtered_rows
    lines = [
        f"source_file={SOURCE_FILE}",
        f"output_file={OUTPUT_FILE}",
        f"filter_condition=total_audience_count > {MIN_AUDIENCE_COUNT}",
        f"source_row_count={source_rows}",
        f"filtered_row_count={filtered_rows}",
        f"removed_row_count={removed_rows}",
    ]
    SUMMARY_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    ensure_output_dir()
    source_df = load_source_data()
    filtered_df = filter_data(source_df)
    filtered_df.to_csv(OUTPUT_FILE, index=False, encoding="utf-8-sig")
    save_summary(len(source_df), len(filtered_df))

    print(f"saved_to={OUTPUT_FILE}")
    print(f"filter_condition=total_audience_count > {MIN_AUDIENCE_COUNT}")
    print(f"source_rows={len(source_df)}")
    print(f"filtered_rows={len(filtered_df)}")


if __name__ == "__main__":
    main()
