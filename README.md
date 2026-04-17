# DS_PBL

영화 데이터 기반 PBL 저장소입니다.

## 현재 방향
- 주제: 영화
- 분석 주체: 배급사
- 총괄 목적: 배급사 관점에서 한국 일반영화의 흥행 성과와 관련된 주요 요인을 파악하고, 배급 전략 수립에 활용할 기초 자료를 마련하고자 한다.
- 분석 범위: 한국 일반영화
- 분석 기간: 2016~2025
- 시기 구간: 2016~2019 / 2020~2022 / 2023~2025
- 데이터 소스: KOBIS 우선 사용

## 세부 분석 질문
1. 배급사 입장에서 어떤 장르의 영화가 더 높은 흥행 성과를 보이는가
2. 배급사 입장에서 어떤 개봉 시기가 흥행에 유리한가
3. 배급사 입장에서 관람등급에 따라 흥행 성과 차이가 존재하는가
4. 배급사 입장에서 스크린 수와 상영 횟수는 흥행 성과와 어떤 관계가 있는가
5. 배급사 입장에서 코로나 이전·코로나기·최근 구간에 흥행 패턴은 어떻게 달라졌는가

## 현재 상태
- `data/source_original/`: KOBIS 원본 다운로드 파일 보관
- `data/raw/`: 작업용 CSV 원본 정리본
- `data/analysis_ready/`: 최종 분석용 CSV
- `data/분석준비_관객100초과/`: 관객수 100 초과 기준 파생 분석용 CSV와 요약 파일
- `outputs/visuals/1차_과제/`: 초기 1차 과제용 통계표와 시각화 초안
- `outputs/visuals/1차_과제_관객100초과/`: 관객수 100 초과 기준 1차 과제용 통계표와 시각화
- 코드 기준 파일은 `main.py`, `src/load_analysis_ready_data.py`

## 데이터 흐름
1. `data/source_original/`
   - KOBIS에서 직접 받은 원본 다운로드 파일 보관
2. `data/raw/`
   - 실제 작업과 설명에 쓰기 쉽게 CSV 기준으로 정리한 원본
3. `data/analysis_ready/`
   - 1차 분석에 바로 쓰는 최종 데이터셋

## 현재 데이터 파일
### 원본 보관
- `data/source_original/kobis_boxoffice_yearly_2016.xls` ~ `data/source_original/kobis_boxoffice_yearly_2025.xls`
- `data/source_original/kobis_korean_movie_metadata_2016_2025.csv`

### 작업용 원본
- `data/raw/kobis_boxoffice_yearly_2016.csv` ~ `data/raw/kobis_boxoffice_yearly_2025.csv`
- `data/raw/kobis_korean_movie_metadata_2016_2025.csv`

### 최종 분석용
- `data/analysis_ready/kobis_korean_movies_analysis_ready_2016_2025.csv`
- `data/analysis_ready/kobis_korean_movies_unmatched_2016_2025.csv`

## 처리 결과 요약
- 박스오피스 집계 범위 통합 영화 수: `9815`
- 분석 범위(2016~2025 개봉작) 영화 수: `5176`
- 메타데이터 매칭 성공: `5171`
- 미매칭: `5`

## 생성된 산출물
- `data/분석준비_관객100초과/필터_요약.txt`
- `data/분석준비_관객100초과/한국영화_분석준비완료_2016_2025_관객100초과.csv`
- `outputs/visuals/1차_과제/결측치_요약.csv`
- `outputs/visuals/1차_과제/기초통계.csv`
- `outputs/visuals/1차_과제/데이터셋_개요.txt`
- `outputs/visuals/1차_과제/01_결측치_개수.png` ~ `09_수치형변수_상자그림.png`
- `outputs/visuals/1차_과제_관객100초과/결측치_요약.csv`
- `outputs/visuals/1차_과제_관객100초과/기초통계.csv`
- `outputs/visuals/1차_과제_관객100초과/데이터셋_개요.txt`
- `outputs/visuals/1차_과제_관객100초과/01_결측치_개수.png` ~ `09_수치형변수_상자그림.png`

## 문서
- `docs/프로젝트_계획.md`: 프로젝트 방향과 1차 분석 계획
- `docs/과제_요구사항.md`: 1차/2차 요구사항 정리
- `docs/작업_기록.md`: 결정 로그, 출처 기록, 작업 기록
- `docs/학습_노트.md`: 대화 기반 학습 내용 정리

## 저장소 구조
```text
DS_PBL/
├─ README.md
├─ main.py
├─ pyproject.toml
├─ requirements.txt
├─ uv.lock
├─ data/
│  ├─ source_original/
│  ├─ raw/
│  └─ analysis_ready/
├─ docs/
├─ outputs/
│  └─ visuals/
├─ presentation/
└─ src/
```
