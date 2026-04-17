#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import gzip
import json
from collections import defaultdict
from pathlib import Path
from datetime import datetime, timezone


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "분석데이터" / "overseas_us_general_theatrical_2016_2025_analysis_ready.csv"
DEFAULT_RATINGS = (
    PROJECT_ROOT / "data" / "원본자료" / "imdb" / "title.ratings.tsv.gz"
)
DEFAULT_BASICS = (
    PROJECT_ROOT / "data" / "원본자료" / "imdb" / "title.basics.tsv.gz"
)
DEFAULT_OUTPUT = (
    PROJECT_ROOT / "data" / "분석데이터" / "overseas_us_general_theatrical_2016_2025_analysis_ready_imdb_enriched.csv"
)
DEFAULT_REPORT = (
    PROJECT_ROOT / "data" / "수집자료" / "overseas_us_general_theatrical_2016_2025_imdb_enrichment_report.json"
)

NULL_TOKENS = {"", "\\N", "N/A", "NA", "null", None}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Enrich US overseas analysis CSV with IMDb bulk metadata."
    )
    parser.add_argument(
        "--input-csv",
        default=str(DEFAULT_INPUT),
        help="Input analysis CSV that already has imdb_title_id column.",
    )
    parser.add_argument(
        "--ratings-tsv-gz",
        default=str(DEFAULT_RATINGS),
        help="IMDb title.ratings.tsv.gz download from datasets.imdbws.com.",
    )
    parser.add_argument(
        "--basics-tsv-gz",
        default=str(DEFAULT_BASICS),
        help="IMDb title.basics.tsv.gz download from datasets.imdbws.com.",
    )
    parser.add_argument(
        "--output-csv",
        default=str(DEFAULT_OUTPUT),
        help="Output CSV path for enriched dataset.",
    )
    parser.add_argument(
        "--report-json",
        default=str(DEFAULT_REPORT),
        help="Output report JSON path.",
    )
    return parser.parse_args()


def is_null(value: str | None) -> bool:
    return value is None or str(value).strip() in NULL_TOKENS


def read_target_rows(input_csv: Path):
    with input_csv.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])

    imdb_ids = []
    unique_ids = set()
    for row in rows:
        imdb_id = (row.get("imdb_title_id") or "").strip()
        if imdb_id and imdb_id not in unique_ids:
            unique_ids.add(imdb_id)
            imdb_ids.append(imdb_id)

    return rows, fieldnames, imdb_ids, unique_ids


def load_imdb_ratings(path: Path, wanted_ids: set[str]):
    matches: dict[str, dict[str, str]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as fp:
        reader = csv.DictReader(fp, delimiter="\t")
        for row in reader:
            imdb_id = row["tconst"]
            if imdb_id not in wanted_ids:
                continue
            matches[imdb_id] = {
                "imdb_average_rating": row["averageRating"],
                "imdb_num_votes": row["numVotes"],
            }
    return matches


def load_imdb_basics(path: Path, wanted_ids: set[str]):
    matches: dict[str, dict[str, str]] = {}
    with gzip.open(path, "rt", encoding="utf-8") as fp:
        reader = csv.DictReader(fp, delimiter="\t")
        for row in reader:
            imdb_id = row["tconst"]
            if imdb_id not in wanted_ids:
                continue
            matches[imdb_id] = {
                "imdb_title_type": row["titleType"],
                "imdb_primary_title": row["primaryTitle"],
                "imdb_original_title": row["originalTitle"],
                "imdb_is_adult": row["isAdult"],
                "imdb_start_year": row["startYear"],
                "imdb_runtime_minutes": row["runtimeMinutes"],
                "imdb_genres": row["genres"],
            }
    return matches


def enrich_row(row: dict[str, str], ratings: dict[str, dict[str, str]], basics: dict[str, dict[str, str]]):
    imdb_id = (row.get("imdb_title_id") or "").strip()
    rating = ratings.get(imdb_id)
    basic = basics.get(imdb_id)

    row["imdb_average_rating"] = ""
    row["imdb_num_votes"] = ""
    row["imdb_title_type"] = ""
    row["imdb_primary_title"] = ""
    row["imdb_original_title"] = ""
    row["imdb_is_adult"] = ""
    row["imdb_start_year"] = ""
    row["imdb_runtime_minutes"] = ""
    row["imdb_genres"] = ""

    if rating:
        for key, val in rating.items():
            row[key] = val
    if basic:
        for key, val in basic.items():
            row[key] = val


def main() -> None:
    args = parse_args()
    input_csv = Path(args.input_csv)
    ratings_path = Path(args.ratings_tsv_gz)
    basics_path = Path(args.basics_tsv_gz)
    output_csv = Path(args.output_csv)
    report_json = Path(args.report_json)

    rows, fieldnames, imdb_ids_list, imdb_id_set = read_target_rows(input_csv)
    ratings_map = load_imdb_ratings(ratings_path, imdb_id_set)
    basics_map = load_imdb_basics(basics_path, imdb_id_set)

    extra_columns = [
        "imdb_average_rating",
        "imdb_num_votes",
        "imdb_title_type",
        "imdb_primary_title",
        "imdb_original_title",
        "imdb_is_adult",
        "imdb_start_year",
        "imdb_runtime_minutes",
        "imdb_genres",
    ]
    output_fieldnames = fieldnames + extra_columns

    matched_rating = 0
    matched_basics = 0
    both_matched = 0
    enriched_counts = defaultdict(int)

    for row in rows:
        imdb_id = (row.get("imdb_title_id") or "").strip()
        has_rating = imdb_id in ratings_map
        has_basic = imdb_id in basics_map
        if has_rating:
            matched_rating += 1
        if has_basic:
            matched_basics += 1
        if has_rating and has_basic:
            both_matched += 1

        enrich_row(row, ratings_map, basics_map)
        for c in extra_columns:
            if not is_null(row.get(c)):
                enriched_counts[c] += 1

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=output_fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    report_json.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_csv": str(input_csv),
        "output_csv": str(output_csv),
        "input_rows": len(rows),
        "input_unique_imdb_ids": len(imdb_id_set),
        "imdb_ids_requested_from_source": len(imdb_ids_list),
        "ratings_matches": matched_rating,
        "basics_matches": matched_basics,
        "both_matches": both_matched,
        "coverage": {
            "imdb_average_rating": enriched_counts["imdb_average_rating"],
            "imdb_num_votes": enriched_counts["imdb_num_votes"],
            "imdb_title_type": enriched_counts["imdb_title_type"],
            "imdb_primary_title": enriched_counts["imdb_primary_title"],
            "imdb_original_title": enriched_counts["imdb_original_title"],
            "imdb_is_adult": enriched_counts["imdb_is_adult"],
            "imdb_start_year": enriched_counts["imdb_start_year"],
            "imdb_runtime_minutes": enriched_counts["imdb_runtime_minutes"],
            "imdb_genres": enriched_counts["imdb_genres"],
        },
    }
    report_json.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        f"input_rows={len(rows)} "
        f"imdb_ids={len(imdb_id_set)} "
        f"rating_matches={matched_rating} "
        f"basics_matches={matched_basics} "
        f"both={both_matched}"
    )
    print(f"enriched_csv={output_csv}")
    print(f"report_json={report_json}")


if __name__ == "__main__":
    main()

