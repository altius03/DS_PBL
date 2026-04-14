# Project Overview

## 프로젝트 스냅샷
- 주제: 영화
- 팀원 수: 2명
- 현재 단계: 1차 과제 기획 및 데이터 수집 시작 단계
- 1차 마감: 2026-04-14
- 이후 계획: 같은 주제로 2차 과제까지 확장
- 권장 범위: 국내 영화 / 국내 박스오피스 중심

## 핵심 전략
- 1차 과제는 데이터 이해(EDA) 중심으로 안정적으로 마무리한다.
- 2차 과제는 종속변수와 피처의 관계를 분석해 적합한 피처를 2개 이상 선택하는 방향으로 확장한다.
- 2차 분석 근거는 분포도와 상관계수를 중심으로 잡는다.
- 필요하면 그룹 분할, 추가 데이터 확보, 피처 가공을 사용한다.

## 권장 제목
- 1차 과제: 국내 영화 흥행 데이터의 구조와 특성 분석
- 2차 과제: 국내 영화 흥행 성과와 주요 피처의 관계 분석 및 핵심 피처 선택

## 추천 데이터 소스
- KOBIS / KOFIC 계열 데이터
  - 박스오피스, 개봉일, 배급사, 관객 수, 매출액, 스크린 수, 상영 횟수 확보에 적합
- 공공데이터포털 / 영화진흥위원회 제공 데이터
  - 국내 영화 메타데이터 보완에 적합
- 보조 후보
  - TMDb / IMDb / Kaggle
  - 해외 정보나 보조 메타데이터가 꼭 필요할 때만 제한적으로 사용

## 분석 주체/목적 후보
- 배급사: 어떤 장르, 개봉 시기, 관람등급의 영화가 높은 관객 수와 매출을 보이는가
- 제작사: 흥행 가능성이 높은 영화의 특징은 무엇인가
- 극장 체인: 스크린 수와 상영 횟수는 흥행 성과와 어떤 관계가 있는가
- 투자사: 흥행 상위 영화와 일반 영화의 차이는 무엇인가

## 종속변수 후보
- `audience_acc`: 누적관객수
- `sales_acc`: 누적매출액
- 로그 변환한 `audience_acc`, `sales_acc`

## 기본 데이터 컬럼 후보
```text
movie_id
movie_name
open_date
year
month
season
genre
rating
director
actors
distributor
production_company
sales
sales_acc
audience
audience_acc
screen_count
show_count
runtime
country
source
```

## 파생변수 후보
- `open_year`
- `open_month`
- `season`
- `screen_efficiency`
- `show_efficiency`
- `hit_label`
- `genre_main`

