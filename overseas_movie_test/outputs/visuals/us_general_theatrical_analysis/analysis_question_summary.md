# US General Theatrical Analysis Summary

## Dataset
- source file: `C:\Dev\study\python\DS_PBL\overseas_movie_test\data\analysis_ready\overseas_us_general_theatrical_2016_2025_analysis_ready.csv`
- row count: `7368`
- year range: `2016-2025`
- filter: `general_movie_only`

## Analysis Questions
1. 장르별 흥행 성과
- highest average worldwide gross genre: `Adventure`
2. 개봉 시기별 흥행 성과
- highest average worldwide gross month: `December`
3. 관람등급별 흥행 성과
- most frequent rating: `R`
4. 극장 수와 흥행의 관계
- widest release theaters vs worldwide gross correlation: `0.4966`
- opening theaters vs domestic gross correlation: `0.5428`
- highest average worldwide gross theater band: `4000_plus`
5. 코로나 전·중·후 패턴 변화
- highest average worldwide gross period: `post_covid_2023_2025`

## Notes
- This sample keeps general movies only and excludes obvious re-releases and event-cinema titles.
- This dataset covers the full U.S. theatrical release schedule in the configured year range, not just top-grossing titles.
- Genre summaries exclude non-genre formatting tokens such as IMAX and 3D IMAX.
- Theater counts are not direct equivalents of KOBIS screen counts.
- Audience count and show count are unavailable in this overseas sample.
- Rating is interpreted with U.S.-centered MPAA labels where present.

