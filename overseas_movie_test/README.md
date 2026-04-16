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
  - `docs/domestic_vs_overseas_evaluation.md`

## Overseas Analysis Outputs
- Question summaries:
  - `outputs/visuals/us_general_theatrical_analysis/analysis_question_summary.md`
  - `outputs/visuals/us_general_theatrical_analysis/q1_genre_summary.csv`
  - `outputs/visuals/us_general_theatrical_analysis/q2_release_month_summary.csv`
  - `outputs/visuals/us_general_theatrical_analysis/q3_rating_summary.csv`
  - `outputs/visuals/us_general_theatrical_analysis/q4_theater_band_summary.csv`
  - `outputs/visuals/us_general_theatrical_analysis/q4_theater_correlation_summary.json`
  - `outputs/visuals/us_general_theatrical_analysis/q5_covid_period_summary.csv`
- Assignment 1 visuals:
  - `outputs/visuals/us_general_theatrical_assignment1/01_null_counts.png`
  - `outputs/visuals/us_general_theatrical_assignment1/02_worldwide_gross_distribution.png`
  - `outputs/visuals/us_general_theatrical_assignment1/03_domestic_gross_distribution.png`
  - `outputs/visuals/us_general_theatrical_assignment1/04_widest_release_theaters_distribution.png`
  - `outputs/visuals/us_general_theatrical_assignment1/05_opening_theaters_distribution.png`
  - `outputs/visuals/us_general_theatrical_assignment1/06_rating_counts.png`
  - `outputs/visuals/us_general_theatrical_assignment1/07_open_year_counts.png`
  - `outputs/visuals/us_general_theatrical_assignment1/08_genre_top10_counts.png`
  - `outputs/visuals/us_general_theatrical_assignment1/09_distributor_top10_counts.png`
  - `outputs/visuals/us_general_theatrical_assignment1/basic_statistics.csv`
  - `outputs/visuals/us_general_theatrical_assignment1/null_summary.csv`
  - `outputs/visuals/us_general_theatrical_assignment1/dataset_overview.txt`

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

## Re-run Commands
```powershell
node overseas_movie_test\src\collect_boxofficemojo_us_release_schedule_full.mjs --config configs\us_general_theatrical_full_2016_2025.json --execute --concurrency 2
node overseas_movie_test\src\build_complete_overseas_dataset.mjs --input-csv data\raw\boxofficemojo_us_release_schedule_full_2016_2025.csv --output-prefix overseas_us_release_schedule_full_2016_2025 --concurrency 2
node overseas_movie_test\src\filter_overseas_general_movies.mjs --input-full-csv data\analysis_ready\overseas_us_release_schedule_full_2016_2025.csv --input-analysis-csv data\analysis_ready\overseas_us_release_schedule_full_2016_2025_analysis_ready.csv --output-full-csv data\analysis_ready\overseas_us_general_theatrical_2016_2025.csv --output-analysis-csv data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv --report-file data\raw\overseas_us_general_theatrical_2016_2025_filter_report.json --minimum-runtime-minutes 40
node overseas_movie_test\src\build_overseas_analysis_summaries.mjs --input-file data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv --output-dir outputs\visuals\us_general_theatrical_analysis --summary-title "US General Theatrical Analysis Summary"
powershell -NoProfile -ExecutionPolicy Bypass -File overseas_movie_test\src\build_overseas_assignment1_visuals.ps1 -InputFile C:\Dev\study\python\DS_PBL\overseas_movie_test\data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv -OutputDir C:\Dev\study\python\DS_PBL\overseas_movie_test\outputs\visuals\us_general_theatrical_assignment1
```

## Main Scripts
- `src/collect_boxofficemojo_sample.mjs`
- `src/collect_boxofficemojo_us_release_schedule_full.mjs`
- `src/build_complete_overseas_dataset.mjs`
- `src/filter_overseas_general_movies.mjs`
- `src/build_overseas_analysis_summaries.mjs`
- `src/build_overseas_assignment1_visuals.ps1`
- `src/prepare_us_general_theatrical_pipeline.mjs`
