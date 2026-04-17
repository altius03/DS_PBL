# DS_PBL

데이터사이언스 PBL 작업을 관리하는 저장소입니다.  
현재 메인 작업공간은 `us_box_office_analysis/`이며, 미국 극장 개봉 영화의 흥행 데이터를 중심으로 과제를 진행하고 있습니다.

## 현재 초점

- 메인 프로젝트: `us_box_office_analysis`
- 분석 주제: 미국 극장 개봉 영화 흥행 분석
- 기준 기간: `2016-2025`
- 현재 진행 과제: `2차 과제`
- 메인 분석 데이터: `us_box_office_analysis/data/분석데이터/미국영화_분석데이터_2016_2025.csv`

## 저장소 구조

```text
DS_PBL
├── us_box_office_analysis
│   ├── archive
│   ├── configs
│   ├── data
│   ├── docs
│   ├── outputs
│   ├── src
│   ├── submissions
│   ├── main.py
│   ├── README.md
│   └── requirements.txt
├── archive
│   └── root_legacy_20260417
├── README.md
├── pyproject.toml
├── requirements.txt
└── uv.lock
```

## 빠른 길잡이

- 메인 프로젝트: `us_box_office_analysis/`
- 과제 문서: `us_box_office_analysis/docs/`
- 분석 데이터: `us_box_office_analysis/data/분석데이터/`
- 2차 과제 산출물: `us_box_office_analysis/outputs/assignment2/`
- 제출물 저장 위치: `us_box_office_analysis/submissions/`
- 루트 레거시 백업: `archive/root_legacy_20260417/`

## 디렉토리 역할

- `us_box_office_analysis/`
  - 실제 분석, 스크립트, 문서, 제출물을 관리하는 메인 프로젝트 폴더입니다.
- `archive/`
  - 루트에 흩어져 있던 이전 구조와 산출물을 백업한 보관 영역입니다.
- `pyproject.toml`, `requirements.txt`, `uv.lock`
  - 파이썬 실행 환경과 의존성 관리를 위한 설정 파일입니다.

## 현재 작업 방식

- 실질적인 개발과 문서 작업은 `us_box_office_analysis/` 아래에서 진행합니다.
- 이전 루트 산출물은 즉시 삭제하지 않고 `archive/`로 옮겨 재현 가능성을 남겨둡니다.
- 과제 산출물은 프로젝트 내부에서 관리하고, 제출본은 `submissions/`에 따로 모읍니다.

## 참고

- 한국 영화 데이터는 현재 `us_box_office_analysis/data/참고데이터/`에 참고 자료로 남아 있습니다.
- 구조 정리는 한 차례 진행됐지만, 데이터 폴더 한글명 정리나 레거시 분리는 이후 추가 정리 대상이 될 수 있습니다.
- 프로젝트 상세 설명은 `us_box_office_analysis/README.md`를 기준으로 보면 됩니다.
