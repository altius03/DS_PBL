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
  - `data/수집자료/boxofficemojo_us_release_schedule_full_2016_2025.csv`
- Backbone collection report:
  - `data/수집자료/boxofficemojo_us_release_schedule_full_2016_2025_report.json`
- Enriched full CSV:
  - `data/분석데이터/overseas_us_release_schedule_full_2016_2025.csv`
- Enriched analysis-ready CSV:
  - `data/분석데이터/overseas_us_release_schedule_full_2016_2025_analysis_ready.csv`
- General-movie-only full CSV:
  - `data/분석데이터/overseas_us_general_theatrical_2016_2025.csv`
- General-movie-only analysis-ready CSV:
  - `data/분석데이터/overseas_us_general_theatrical_2016_2025_analysis_ready.csv`
- General movie filter report:
  - `data/수집자료/overseas_us_general_theatrical_2016_2025_filter_report.json`
- Enrichment report:
  - `data/수집자료/overseas_us_release_schedule_full_2016_2025_report.json`
- Domestic vs overseas evaluation:
  - `docs/援?궡_?댁쇅_鍮꾧탳_?됯?.md`
- CSV file index:
  - `data/수집자료/overseas_canonical_csv_index.csv`

## Overseas Analysis Outputs
- Question summaries:
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍/遺꾩꽍_吏덈Ц_?붿빟.md`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍/吏덈Ц1_?λⅤ_?붿빟.csv`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍/吏덈Ц2_媛쒕큺?쒓린_?붿빟.csv`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍/吏덈Ц3_愿?뚮벑湲??붿빟.csv`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍/吏덈Ц4_洹뱀옣??援ш컙_?붿빟.csv`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍/吏덈Ц4_洹뱀옣???곴?_?붿빟.json`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍/吏덈Ц5_肄붾줈?섏떆湲??붿빟.csv`
- Assignment 1 visuals:
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??01_寃곗륫移?媛쒖닔.png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??02_?꾩꽭怨꾨ℓ異?遺꾪룷.png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??03_遺곷?留ㅼ텧_遺꾪룷.png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??04_理쒕?洹뱀옣??遺꾪룷.png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??05_媛쒕큺洹뱀옣??遺꾪룷.png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??06_愿?뚮벑湲됰퀎_?곹솕??png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??07_吏묎퀎?곕룄蹂??곹솕??png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??08_?λⅤ_?곸쐞10媛?png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??09_諛곌툒???곸쐞10媛?png`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??湲곗큹?듦퀎.csv`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵??寃곗륫移??붿빟.csv`
  - `outputs/visuals/誘멸뎅_?쇰컲洹뱀옣_1李④낵???곗씠?곗뀑_媛쒖슂.txt`

## Preserved Legacy Sample
- Full merged sample:
  - `data/분석데이터/overseas_movies_complete_2016_2025.csv`
- Sample analysis-ready CSV:
  - `data/분석데이터/overseas_movies_complete_2016_2025_analysis_ready.csv`
- Sample general-movie CSV:
  - `data/분석데이터/overseas_movies_general_only_2016_2025.csv`
- Sample general-movie analysis-ready CSV:
  - `data/분석데이터/overseas_movies_general_only_2016_2025_analysis_ready.csv`

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
node 미국영화흥행분석\src\collect_boxofficemojo_us_release_schedule_full.mjs --config configs\us_general_theatrical_full_2016_2025.json --execute --concurrency 2
node 미국영화흥행분석\src\build_complete_overseas_dataset.mjs --input-csv data\raw\boxofficemojo_us_release_schedule_full_2016_2025.csv --output-prefix overseas_us_release_schedule_full_2016_2025 --concurrency 2
node 미국영화흥행분석\src\filter_overseas_general_movies.mjs --input-full-csv data\analysis_ready\overseas_us_release_schedule_full_2016_2025.csv --input-analysis-csv data\analysis_ready\overseas_us_release_schedule_full_2016_2025_analysis_ready.csv --output-full-csv data\analysis_ready\overseas_us_general_theatrical_2016_2025.csv --output-analysis-csv data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv --report-file data\raw\overseas_us_general_theatrical_2016_2025_filter_report.json --minimum-runtime-minutes 40
node 미국영화흥행분석\src\build_overseas_analysis_summaries.mjs --input-file data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv --output-dir outputs\visuals\誘멸뎅_?쇰컲洹뱀옣_遺꾩꽍 --summary-title "誘멸뎅 ?쇰컲洹뱀옣 遺꾩꽍 ?붿빟"
powershell -NoProfile -ExecutionPolicy Bypass -File 미국영화흥행분석\src\build_overseas_assignment1_visuals.ps1 -InputFile C:\Dev\study\python\DS_PBL\미국영화흥행분석\data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv -OutputDir C:\Dev\study\python\DS_PBL\미국영화흥행분석\outputs\visuals\誘멸뎅_?쇰컲洹뱀옣_1李④낵??```

## Main Scripts
- `src/collect_boxofficemojo_sample.mjs`
- `src/collect_boxofficemojo_us_release_schedule_full.mjs`
- `src/build_complete_overseas_dataset.mjs`
- `src/filter_overseas_general_movies.mjs`
- `src/build_overseas_analysis_summaries.mjs`
- `src/build_overseas_assignment1_visuals.ps1`
- `src/prepare_us_general_theatrical_pipeline.mjs`


