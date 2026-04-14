# DS_PBL

영화 데이터 기반 PBL 작업 저장소입니다.

현재 방향은 아래처럼 정리합니다.
- 1차 과제: 국내 영화 데이터를 수집하고 EDA 중심으로 데이터 구조와 특성을 설명
- 2차 과제: 종속변수와 피처(또는 변환 피처)의 관계를 분석해 적합한 피처를 2개 이상 선택
- 권장 범위: 국내 영화 / 국내 박스오피스 데이터 중심

## 현재 작업 기준
- 주제: 영화
- 분석 주체: 배급사
- 목적 수: 5개 모두 활용
- 데이터 범위: 한국 일반영화
- 분석 기간: 2016~2025
- 시기 구간: 2016~2019 / 2020~2022 / 2023~2025
- 데이터 소스: KOBIS만 우선 사용
- 팀원 수: 2명
- 1차 마감: 2026-04-14
- 코드 제출: 필요
- LLM 활용: 허용
- 결과물 목표: 완성도 강화형
  - 무리한 모델링보다 설명력 있는 EDA, 시각화 완성도, 발표 설득력을 높이는 방향

## 저장소 구조
```text
DS_PBL/
├─ README.md
├─ .gitignore
├─ data/
│  ├─ raw/
│  └─ processed/
├─ docs/
│  ├─ project-overview.md
│  ├─ requirements.md
│  ├─ analysis-plan.md
│  ├─ conversation-learning-log.md
│  └─ worklog.md
├─ notebooks/
├─ outputs/
│  └─ figures/
├─ ppt/
└─ src/
```

## 문서 안내
- `docs/project-overview.md`: 프로젝트 스냅샷, 추천 방향, 데이터 범위, 핵심 후보 정리
- `docs/requirements.md`: 1차/2차 과제 요구사항과 제출물 정리
- `docs/analysis-plan.md`: 1차 EDA와 2차 피처 선택 분석 계획
- `docs/conversation-learning-log.md`: 대화 기반 학습 내용, 질문-답변 요약, 참고 링크 정리
- `docs/worklog.md`: 결정 로그, 오픈 이슈, 리스크, 다음 액션, 출처 기록

## 작업 순서
1. 데이터 범위와 종속변수 후보 확정
2. `data/raw/`에 원본 데이터 확보
3. `src/` 또는 `notebooks/`에서 전처리와 EDA 수행
4. `outputs/figures/`에 그래프 저장
5. `ppt/`에 발표 자료 반영
