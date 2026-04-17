# Overseas Movie Test

This workspace mirrors the main `DS_PBL` project, but adds an overseas movie pipeline built from trustworthy public sources.

## Current Status
- Main overseas dataset: full U.S. theatrical release schedule, `2016-2025`
- Final analysis subset: general movies only
- Raw backbone rows after dedupe: `7605`
- Final general-movie rows: `7368`
- Backbone source: `Box Office Mojo`
- Supplementary sources: `Box Office Mojo title/credits pages`, `Wikidata`
- Legacy yearly top-100 sample is still preserved for comparison
- Raw source HTML/JSON cache is intentionally excluded from version control; canonical CSV rollups are kept instead

## Main Output Files
- Raw backbone CSV:
  - `data/raw/boxofficemojo_us_release_schedule_full_2016_2025.csv`
- Backbone collection report:
  - `data/raw/boxofficemojo_us_release_schedule_full_2016_2025_report.json`
- Enriched full CSV:
  - `data/analysis_ready/overseas_us_release_schedule_full_2016_2025.csv`
- Enriched analysis-ready CSV:
  - `data/analysis_ready/overseas_us_release_schedule_full_2016_2025_analysis_ready.csv`
- General-movie-only full CSV:
  - `data/analysis_ready/overseas_us_general_theatrical_2016_2025.csv`
- General-movie-only analysis-ready CSV:
  - `data/analysis_ready/overseas_us_general_theatrical_2016_2025_analysis_ready.csv`
- General movie filter report:
  - `data/raw/overseas_us_general_theatrical_2016_2025_filter_report.json`
- Enrichment report:
  - `data/raw/overseas_us_release_schedule_full_2016_2025_report.json`
- Domestic vs overseas evaluation:
  - `docs/국내_해외_비교_평가.md`
- CSV file index:
  - `data/raw/overseas_canonical_csv_index.csv`

## Overseas Analysis Outputs
- Question summaries:
  - `outputs/visuals/미국_일반극장_분석/분석_질문_요약.md`
  - `outputs/visuals/미국_일반극장_분석/질문1_장르_요약.csv`
  - `outputs/visuals/미국_일반극장_분석/질문2_개봉시기_요약.csv`
  - `outputs/visuals/미국_일반극장_분석/질문3_관람등급_요약.csv`
  - `outputs/visuals/미국_일반극장_분석/질문4_극장수_구간_요약.csv`
  - `outputs/visuals/미국_일반극장_분석/질문4_극장수_상관_요약.json`
  - `outputs/visuals/미국_일반극장_분석/질문5_코로나시기_요약.csv`
- Assignment 1 visuals:
  - `outputs/visuals/미국_일반극장_1차과제/01_결측치_개수.png`
  - `outputs/visuals/미국_일반극장_1차과제/02_전세계매출_분포.png`
  - `outputs/visuals/미국_일반극장_1차과제/03_북미매출_분포.png`
  - `outputs/visuals/미국_일반극장_1차과제/04_최대극장수_분포.png`
  - `outputs/visuals/미국_일반극장_1차과제/05_개봉극장수_분포.png`
  - `outputs/visuals/미국_일반극장_1차과제/06_관람등급별_영화수.png`
  - `outputs/visuals/미국_일반극장_1차과제/07_집계연도별_영화수.png`
  - `outputs/visuals/미국_일반극장_1차과제/08_장르_상위10개.png`
  - `outputs/visuals/미국_일반극장_1차과제/09_배급사_상위10개.png`
  - `outputs/visuals/미국_일반극장_1차과제/기초통계.csv`
  - `outputs/visuals/미국_일반극장_1차과제/결측치_요약.csv`
  - `outputs/visuals/미국_일반극장_1차과제/데이터셋_개요.txt`

## Preserved Legacy Sample
- Full merged sample:
  - `data/analysis_ready/overseas_movies_complete_2016_2025.csv`
- Sample analysis-ready CSV:
  - `data/analysis_ready/overseas_movies_complete_2016_2025_analysis_ready.csv`
- Sample general-movie CSV:
  - `data/analysis_ready/overseas_movies_general_only_2016_2025.csv`
- Sample general-movie analysis-ready CSV:
  - `data/analysis_ready/overseas_movies_general_only_2016_2025_analysis_ready.csv`

## Main Improvements
- Moved from a yearly worldwide top-100 sample to the full U.S. theatrical release schedule
- Kept the old sample files separate instead of overwriting them
- Added monthly schedule collection and release-page enrichment
- Recovered `director` for most rows and reduced `genre` / `distributor` gaps
- Added `budget_usd`, `brand_name`, and `franchise_name` where available
- Generated overseas-only EDA outputs and a domestic-vs-overseas comparison memo

## Remaining Limits
- `audience_count` is unavailable
- `show_count` is unavailable
- `opening_theaters` and `widest_release_theaters` are not direct KOBIS screen-count equivalents
- `rating` still has heavy missingness in the overseas dataset
- `production_company`, `production_country`, and `original_language` were not recovered reliably enough from the chosen public sources
- If GitHub repository size itself needs to shrink, history rewrite is still required because old large cache files already exist in past commits

## Re-run Commands
```powershell
node overseas_movie_test\src\collect_boxofficemojo_us_release_schedule_full.mjs --config configs\us_general_theatrical_full_2016_2025.json --execute --concurrency 2
node overseas_movie_test\src\build_complete_overseas_dataset.mjs --input-csv data\raw\boxofficemojo_us_release_schedule_full_2016_2025.csv --output-prefix overseas_us_release_schedule_full_2016_2025 --concurrency 2
node overseas_movie_test\src\filter_overseas_general_movies.mjs --input-full-csv data\analysis_ready\overseas_us_release_schedule_full_2016_2025.csv --input-analysis-csv data\analysis_ready\overseas_us_release_schedule_full_2016_2025_analysis_ready.csv --output-full-csv data\analysis_ready\overseas_us_general_theatrical_2016_2025.csv --output-analysis-csv data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv --report-file data\raw\overseas_us_general_theatrical_2016_2025_filter_report.json --minimum-runtime-minutes 40
node overseas_movie_test\src\build_overseas_analysis_summaries.mjs --input-file data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv --output-dir outputs\visuals\미국_일반극장_분석 --summary-title "미국 일반극장 분석 요약"
powershell -NoProfile -ExecutionPolicy Bypass -File overseas_movie_test\src\build_overseas_assignment1_visuals.ps1 -InputFile C:\Dev\study\python\DS_PBL\overseas_movie_test\data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv -OutputDir C:\Dev\study\python\DS_PBL\overseas_movie_test\outputs\visuals\미국_일반극장_1차과제
```

## Main Scripts
- `src/collect_boxofficemojo_sample.mjs`
- `src/collect_boxofficemojo_us_release_schedule_full.mjs`
- `src/build_complete_overseas_dataset.mjs`
- `src/filter_overseas_general_movies.mjs`
- `src/build_overseas_analysis_summaries.mjs`
- `src/build_overseas_assignment1_visuals.ps1`
- `src/prepare_us_general_theatrical_pipeline.mjs`
