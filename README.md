# DS_PBL

이 저장소의 메인 프로젝트는 `us_box_office_analysis/`입니다.

## 현재 기준

- 메인 프로젝트: `us_box_office_analysis/`
- 공식 실행 진입점: `us_box_office_analysis/main.py`
- 공식 분석 데이터: `us_box_office_analysis/data/분석데이터/미국영화_분석데이터_2016_2025.csv`
- 현재 제출 산출물: `us_box_office_analysis/outputs/assignment2/`
- 프로젝트 보관본: `us_box_office_analysis/archive/`

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
│   └── README.md
├── .gitignore
├── README.md
├── pyproject.toml
├── requirements.txt
└── uv.lock
```

## 빠른 실행

저장소 루트에서 아래처럼 실행하면 2차 과제 산출물을 다시 생성할 수 있습니다.

```bash
.venv\Scripts\python.exe us_box_office_analysis\main.py
```

`us_box_office_analysis/`로 이동한 뒤에는 아래 명령을 사용합니다.

```bash
python main.py
```

## 메모

- 루트는 환경 설정과 메타 문서만 두고, 실제 분석 작업은 `us_box_office_analysis/` 아래에서 진행합니다.
- 프로젝트 상세 구조와 문서 원칙은 `us_box_office_analysis/README.md`를 기준으로 봅니다.
