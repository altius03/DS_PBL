# DS_PBL

영화 데이터 기반 PBL 저장소입니다.

## 현재 방향
- 주제: 영화
- 분석 주체: 배급사
- 분석 목적: 5개 목적을 하나의 흐름으로 함께 사용
- 데이터 범위: 한국 일반영화
- 분석 기간: 2016~2025
- 시기 구간: 2016~2019 / 2020~2022 / 2023~2025
- 데이터 소스: KOBIS 우선 사용
- 결과물 목표: 완성도 강화형

## 현재 데이터 상태
- raw 원본 확보 완료
  - `data/raw/kobis_boxoffice_yearly_2016.xls` ~ `data/raw/kobis_boxoffice_yearly_2025.xls`
  - `data/raw/kobis_korean_movie_metadata_2016_2025.csv`
- processed 분석용 데이터셋 생성 완료
  - `data/processed/kobis_master_2016_2025.csv`
  - `data/processed/kobis_processing_summary_2016_2025.json`
  - `data/processed/kobis_unmatched_movies_2016_2025.csv`

## 처리 결과 요약
- 연도별 박스오피스 통합 집계 범위 영화 수: `9815`
- 실제 분석 범위(2016~2025 개봉작) 영화 수: `5176`
- 메타데이터 매칭 성공: `5171`
- 미매칭: `5`

## 핵심 문서
- `docs/project-overview.md`: 프로젝트 개요와 의사결정 정리
- `docs/requirements.md`: 1차/2차 요구사항 정리
- `docs/analysis-plan.md`: 1차 분석 계획과 처리 기준
- `docs/worklog.md`: 결정 로그, 출처 기록, 작업 기록
- `docs/conversation-learning-log.md`: 대화 기반 학습 내용 정리

## 주요 데이터 파일
- `data/raw/`
  - KOBIS 원본 파일 보관
- `data/processed/kobis_master_2016_2025.csv`
  - 1차 과제용 최종 분석 데이터셋
- `data/processed/kobis_master_boxoffice_scope_2016_2025.csv`
  - 원본 박스오피스 집계 범위 전체를 유지한 통합본
- `data/processed/kobis_unmatched_movies_2016_2025.csv`
  - 분석 범위 내 미매칭 영화 5개 확인용

## 저장소 구조
```text
DS_PBL/
├─ README.md
├─ .gitignore
├─ data/
│  ├─ raw/
│  └─ processed/
├─ docs/
├─ notebooks/
├─ outputs/
│  └─ figures/
├─ ppt/
└─ src/
```

## 작업 순서
1. 원본 데이터 수집과 출처 기록
2. `src/prepare_kobis_master.js`로 통합 데이터 생성
3. `data/processed/kobis_master_2016_2025.csv` 기준 EDA 수행
4. 그래프 저장과 PPT 반영
5. 2차 과제용 피처 후보 정리
