# us_box_office_analysis

미국 극장 개봉 영화의 흥행 데이터를 수집, 정리, 분석하는 메인 프로젝트입니다. 현재 기준 작업물은 2차 과제 산출물이며, 공식 분석 데이터 파일명은 `미국영화_분석데이터_2016_2025.csv`를 유지합니다.

## 프로젝트 개요

- 분석 대상: 미국 극장 개봉 영화
- 기준 기간: `2016-2025`
- 현재 기준 과제: `2차 과제`
- 공식 분석 데이터: `data/분석데이터/미국영화_분석데이터_2016_2025.csv`
- 공식 실행 진입점: `main.py`

## 현재 디렉토리 구조

```text
us_box_office_analysis
├── archive
│   ├── legacy_visuals_20260417
│   └── root_legacy_20260417
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
├── outputs
│   └── assignment2
│       ├── tables
│       └── visuals
├── src
├── submissions
│   ├── assignments
│   │   ├── 1차과제
│   │   └── 2차과제
│   └── README.md
├── main.py
└── README.md
```

## 폴더별 역할

- `archive/`
  - 과거 산출물과 루트 구조 보관본을 유지하는 프로젝트 내부 보관 영역입니다.
- `configs/`
  - 수집, 필터링, 스모크테스트, 레거시 산출 재생성에 사용하는 설정 파일을 둡니다.
- `data/분석데이터/`
  - 공식 분석용 CSV와 파이프라인 중간 분석용 CSV를 함께 관리합니다.
- `data/수집자료/`
  - 수집 원본 CSV, 매핑 파일, 리포트 JSON, 파이프라인 계획 파일을 보관합니다.
- `data/원본자료/`
  - IMDb bulk 같은 외부 원본 파일을 둘 자리입니다.
- `data/참고데이터/`
  - 한국 영화 비교용 참고 데이터를 둡니다.
- `docs/`
  - 과제 요구사항, 계획, 작업 기록, 출처 메모를 관리합니다.
- `outputs/assignment2/`
  - 현재 기준 제출용 시각화와 요약표를 모아둔 폴더입니다.
- `src/`
  - 수집, 보강, 전처리, 시각화 생성을 담당하는 스크립트 모음입니다.
- `submissions/`
  - 과제별 제출본을 보관합니다.

## 현재 기준 데이터

- 공식 2차 과제 분석 파일: `data/분석데이터/미국영화_분석데이터_2016_2025.csv`
- 파이프라인 중간 분석 파일: `data/분석데이터/미국일반극장영화_분석데이터_2016_2025.csv`
- 한국 비교 참고 파일: `data/참고데이터/한국영화_참고데이터_2016_2025.csv`

## 2차 과제 기준 분석 설정

- 종속변수: `전세계_흥행수익_USD`
- 수치형 피처: `최대_상영극장수`, `오픈_극장수`
- 범주형 피처: `대표장르`, `개봉시기`
- `대표장르`는 원본 `장르`에서 첫 번째 장르를 추출해 사용합니다.
- `개봉시기`는 `여름 성수기(5~8월)`, `연말 성수기(11~12월)`, `일반기(그 외)`로 재분류합니다.

## 현재 제출 산출물

- 시각화: `outputs/assignment2/visuals/`
- 요약표: `outputs/assignment2/tables/`
- 대표 파일:
  - `outputs/assignment2/visuals/a2_01_distribution_overview.png`
  - `outputs/assignment2/visuals/a2_02_widest_vs_worldwide.png`
  - `outputs/assignment2/visuals/a2_03_opening_vs_worldwide.png`
  - `outputs/assignment2/visuals/a2_04_main_genre_boxplot.png`
  - `outputs/assignment2/visuals/a2_05_release_timing_boxplot.png`
  - `outputs/assignment2/tables/a2_correlation_summary.csv`
  - `outputs/assignment2/tables/a2_main_genre_summary.csv`
  - `outputs/assignment2/tables/a2_release_timing_summary.csv`
  - `outputs/assignment2/tables/a2_overview.txt`

## 실행 방법

프로젝트 루트인 `us_box_office_analysis/`에서 아래 명령을 실행하면 현재 기준 2차 과제 산출물을 다시 생성합니다.

```bash
python main.py
```

기존 스크립트를 직접 호출해도 같은 결과를 얻을 수 있습니다.

```bash
python src/build_assignment2_visuals.py
```

저장소 루트에서 가상환경을 직접 지정하려면 아래처럼 실행합니다.

```bash
.venv\Scripts\python.exe us_box_office_analysis\main.py
```

## 관리 원칙

- 현재 제출 기준 결과는 `outputs/assignment2/`를 우선적으로 봅니다.
- 레거시 결과와 이전 루트 구조는 `archive/`에 보관하고, 현재 결과와 섞지 않습니다.
- 제출본은 현재 `submissions/assignments/` 기준으로 관리합니다.
- 수집/보강 파이프라인은 `src/`와 `configs/`를 통해 재현하고, 공식 보고용 데이터 파일명은 그대로 유지합니다.

## 해석 시 주의점

- `오픈_극장수`, `최대_상영극장수`는 미국 극장 수 기준 지표이며 KOBIS의 스크린 수와 동일하지 않습니다.
- 흥행 데이터는 오른쪽 꼬리가 길어 로그 변환 기준 해석이 더 안정적인 경우가 많습니다.
- 현재 프로젝트에서 미국 데이터가 메인이고, 한국 데이터는 비교 참고용으로만 사용합니다.
