# us_box_office_analysis

미국 극장 개봉 영화의 흥행 데이터를 수집, 정리, 분석하는 프로젝트입니다.  
현재는 Box Office Mojo 기반 데이터와 IMDb/TMDB 보강 정보를 활용해 과제용 분석 자료와 시각화 산출물을 만들고 있습니다.

## 프로젝트 개요

- 분석 대상: 미국 극장 개봉 영화
- 기준 기간: `2016-2025`
- 메인 목적: 흥행 성과와 관련된 피처를 탐색하고 과제 제출용 시각화와 요약표를 만든다
- 현재 기준 과제: `2차 과제`
- 메인 데이터셋: `data/분석데이터/미국영화_분석데이터_2016_2025.csv`

## 현재 디렉토리 구조

```text
us_box_office_analysis
├── archive
│   └── legacy_visuals_20260417
├── configs
│   ├── us_general_theatrical_full_2016_2025.json
│   └── us_general_theatrical_full_2024_smoketest.json
├── data
│   ├── 분석데이터
│   ├── 수집자료
│   │   ├── pipeline_manifests
│   │   └── plans
│   ├── 원본자료
│   └── 참고데이터
├── docs
│   ├── 과제_요구사항.md
│   ├── 국내_해외_비교_평가.md
│   ├── 작업_기록.md
│   ├── 출처_기록.md
│   ├── 프로젝트_계획.md
│   └── 학습_노트.md
├── outputs
│   └── assignment2
│       ├── tables
│       └── visuals
├── src
│   ├── build_assignment2_visuals.py
│   ├── build_complete_overseas_dataset.mjs
│   ├── build_overseas_analysis_summaries.mjs
│   ├── build_overseas_assignment1_visuals.ps1
│   ├── collect_boxofficemojo_sample.mjs
│   ├── collect_boxofficemojo_us_release_schedule_full.mjs
│   ├── enrich_with_imdb_bulk.py
│   ├── enrich_with_tmdb_api.py
│   ├── filter_overseas_general_movies.mjs
│   └── prepare_us_general_theatrical_pipeline.mjs
├── submissions
│   ├── assignments
│   │   ├── 1차과제
│   │   └── 2차과제
│   ├── weekly
│   │   ├── hwp
│   │   └── ppt
│   └── README.md
├── main.py
├── README.md
└── requirements.txt
```

## 폴더별 역할

- `configs/`
  - 수집 및 파이프라인 실행에 쓰는 설정 파일을 둡니다.
- `data/분석데이터/`
  - 분석에 바로 사용할 수 있는 정제 데이터가 들어 있습니다.
- `data/수집자료/`
  - 수집 원천 CSV, 매핑 파일, 리포트 JSON, 파이프라인 계획 파일을 보관합니다.
- `data/원본자료/`
  - 원본 데이터를 따로 분리해 둘 공간입니다.
- `data/참고데이터/`
  - 직접 분석 대상은 아니지만 비교용으로 참고하는 데이터를 둡니다.
- `docs/`
  - 과제 요구사항, 작업 기록, 출처, 해석 메모 등 문서형 자료를 관리합니다.
- `outputs/assignment2/`
  - 2차 과제에서 바로 제출하거나 해석에 사용할 시각화와 요약표를 모아둔 폴더입니다.
- `src/`
  - 수집, 보강, 전처리, 시각화 생성을 담당하는 스크립트가 들어 있습니다.
- `submissions/`
  - 주간 HWP/PPT 제출본과 과제별 최종 제출본을 관리합니다.
- `archive/`
  - 이전 시각화나 중복 산출물을 당장 삭제하지 않고 보관하는 영역입니다.

## 핵심 데이터

### 메인 분석 데이터

- `data/분석데이터/미국영화_분석데이터_2016_2025.csv`
  - 현재 과제 분석의 기준이 되는 통합 데이터셋입니다.

### 참고 데이터

- `data/참고데이터/한국영화_참고데이터_2016_2025.csv`
  - 한국 영화 비교나 해석 보조가 필요할 때 참조하는 데이터입니다.

## 2차 과제 기준 분석 설정

현재 2차 과제에서는 아래 기준으로 시각화와 요약표를 만들었습니다.

- 종속변수: `전세계_흥행수익_USD`
- 피처:
  - `최대_상영극장수`
  - `오픈_극장수`
  - `대표장르`
  - `개봉시기`
- `대표장르`
  - 원본 `장르`에서 첫 번째 장르를 추출해 사용
- `개봉시기`
  - `여름 성수기(5~8월)`, `연말 성수기(11~12월)`, `일반기(그 외)`로 재분류

## 2차 과제 산출물

### 시각화

- `outputs/assignment2/visuals/a2_01_distribution_overview.png`
- `outputs/assignment2/visuals/a2_02_widest_vs_worldwide.png`
- `outputs/assignment2/visuals/a2_03_opening_vs_worldwide.png`
- `outputs/assignment2/visuals/a2_04_main_genre_boxplot.png`
- `outputs/assignment2/visuals/a2_05_release_timing_boxplot.png`

### 요약표

- `outputs/assignment2/tables/a2_correlation_summary.csv`
- `outputs/assignment2/tables/a2_main_genre_summary.csv`
- `outputs/assignment2/tables/a2_release_timing_summary.csv`
- `outputs/assignment2/tables/a2_overview.txt`

## 실행 방법

프로젝트 루트인 `us_box_office_analysis/`에서 실행합니다.

```bash
python src/build_assignment2_visuals.py
```

가상환경을 직접 지정해 실행하려면 저장소 루트에서 아래처럼 실행할 수 있습니다.

```bash
.venv\Scripts\python.exe us_box_office_analysis\src\build_assignment2_visuals.py
```

## 문서와 제출물 관리 원칙

- 과제 설명과 작업 메모는 `docs/`에 둡니다.
- 실제 제출용 HWP/PPT는 `submissions/weekly/`와 `submissions/assignments/`에 나눠서 보관합니다.
- 결과 이미지는 `outputs/`에, 과거 결과는 `archive/`에 분리해 두어 현재 산출물과 섞이지 않게 관리합니다.

## 해석 시 주의할 점

- `오픈_극장수`, `최대_상영극장수`는 미국 극장 수 기준 지표이며 KOBIS의 스크린 수와 완전히 같은 개념은 아닙니다.
- 흥행 데이터는 극단값이 큰 편이라 원자료보다 로그 변환 기준 해석이 더 안정적인 경우가 있습니다.
- 현재 프로젝트 안에는 미국 데이터가 메인이고, 한국 데이터는 참고용으로만 남아 있습니다.
- `archive/` 아래 자료는 재현성과 기록 보존을 위한 보관본이며, 현재 제출 기준 산출물은 `outputs/assignment2/`를 우선적으로 봐야 합니다.
