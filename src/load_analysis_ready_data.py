from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib import font_manager


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "분석준비_관객100초과" / "한국영화_분석준비완료_2016_2025_관객100초과.csv"
OUTPUT_DIR = ROOT / "outputs" / "visuals" / "1차_과제_관객100초과"
FILTER_DESCRIPTION = "total_audience_count > 100"

BASIC_STATISTICS_FILE = "기초통계.csv"
NULL_SUMMARY_FILE = "결측치_요약.csv"
DATASET_OVERVIEW_FILE = "데이터셋_개요.txt"
NULL_CHART_FILE = "01_결측치_개수.png"
AUDIENCE_DISTRIBUTION_FILE = "02_관객수_분포.png"
SALES_DISTRIBUTION_FILE = "03_매출액_분포.png"
SCREEN_DISTRIBUTION_FILE = "04_스크린수_분포.png"
SHOW_DISTRIBUTION_FILE = "05_상영횟수_분포.png"
RATING_COUNTS_FILE = "06_관람등급별_영화수.png"
OPEN_YEAR_COUNTS_FILE = "07_개봉연도별_영화수.png"
GENRE_TOP10_FILE = "08_대표장르_상위10개.png"
NUMERIC_BOXPLOTS_FILE = "09_수치형변수_상자그림.png"

NUMERIC_COLUMNS = [
    "total_sales_amount",
    "total_audience_count",
    "screen_count_peak",
    "show_count_total",
    "sales_share_peak",
    "boxoffice_year_count",
]

PLOT_COLORS = {
    "coral": "#FF6B6B",
    "teal": "#1B9AAA",
    "gold": "#F4A261",
    "navy": "#2D3047",
    "green": "#7FB800",
    "rose": "#E76F51",
}


def setup_style() -> None:
    sns.set_theme(style="whitegrid", context="talk")
    installed_fonts = {font.name for font in font_manager.fontManager.ttflist}
    preferred_fonts = ["Malgun Gothic", "NanumGothic", "AppleGothic", "DejaVu Sans"]
    plt.rcParams["font.family"] = next(
        (font_name for font_name in preferred_fonts if font_name in installed_fonts),
        "DejaVu Sans",
    )
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "#FFFDF8"
    plt.rcParams["axes.facecolor"] = "#FFFDF8"
    plt.rcParams["savefig.facecolor"] = "#FFFDF8"


def build_palette_map(categories, palette_name: str) -> dict:
    unique_categories = list(dict.fromkeys(categories))
    colors = sns.color_palette(palette_name, n_colors=len(unique_categories))
    return dict(zip(unique_categories, colors))


def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_FILE)
    for column in NUMERIC_COLUMNS:
        df[column] = pd.to_numeric(df[column], errors="coerce")

    df["open_date"] = pd.to_datetime(df["open_date"].astype(str), format="%Y%m%d", errors="coerce")
    df["open_year"] = df["open_date"].dt.year
    df["open_month"] = df["open_date"].dt.month
    df["genre_main"] = (
        df["genre"]
        .fillna("미상")
        .astype(str)
        .str.split("|")
        .str[0]
        .replace("", "미상")
    )
    return df


def ensure_output_dir() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def save_basic_statistics(df: pd.DataFrame) -> pd.DataFrame:
    basic_stats = df[NUMERIC_COLUMNS].describe().T.round(2)
    basic_stats.to_csv(OUTPUT_DIR / BASIC_STATISTICS_FILE, encoding="utf-8-sig")
    return basic_stats


def save_null_summary(df: pd.DataFrame) -> pd.DataFrame:
    null_summary = pd.DataFrame(
        {
            "null_count": df.isnull().sum(),
            "null_ratio_percent": (df.isnull().mean() * 100).round(2),
        }
    ).sort_values(["null_count", "null_ratio_percent"], ascending=False)
    null_summary.to_csv(OUTPUT_DIR / NULL_SUMMARY_FILE, encoding="utf-8-sig")
    return null_summary


def save_overview_text(df: pd.DataFrame, basic_stats: pd.DataFrame, null_summary: pd.DataFrame) -> None:
    lines = [
        f"source_file={DATA_FILE}",
        f"filter_condition={FILTER_DESCRIPTION}",
        f"row_count={len(df)}",
        f"column_count={len(df.columns)}",
        "columns=" + ", ".join(df.columns),
        "",
        "[top_null_columns]",
    ]

    top_null = null_summary.head(10).reset_index(names="column")
    for row in top_null.itertuples(index=False):
        lines.append(f"{row.column}: {row.null_count}건 ({row.null_ratio_percent}%)")

    lines.extend(
        [
            "",
            "[numeric_columns]",
            ", ".join(basic_stats.index.tolist()),
        ]
    )

    (OUTPUT_DIR / DATASET_OVERVIEW_FILE).write_text("\n".join(lines) + "\n", encoding="utf-8")


def finalize_plot(title: str, subtitle: str | None = None) -> None:
    plt.title(title, loc="left", fontsize=20, fontweight="bold", pad=16)
    if subtitle:
        plt.suptitle(subtitle, x=0.125, y=0.98, ha="left", fontsize=11, color="#5C6770")
    sns.despine()
    plt.tight_layout()


def save_null_chart(null_summary: pd.DataFrame) -> None:
    plot_df = null_summary.reset_index(names="column")
    palette_map = build_palette_map(plot_df["column"], "flare")

    plt.figure(figsize=(13, 7))
    ax = sns.barplot(
        data=plot_df,
        x="null_count",
        y="column",
        hue="column",
        palette=palette_map,
        dodge=False,
        legend=False,
    )
    ax.set_xlabel("결측값 개수")
    ax.set_ylabel("컬럼")

    for patch, value in zip(ax.patches, plot_df["null_count"]):
        ax.text(
            patch.get_width() + max(plot_df["null_count"].max() * 0.01, 1),
            patch.get_y() + patch.get_height() / 2,
            f"{value}",
            va="center",
            fontsize=10,
            color="#2D3047",
        )

    finalize_plot("컬럼별 결측값 개수", "데이터셋 전반의 결측 현황을 확인하는 기본 그래프")
    plt.savefig(OUTPUT_DIR / NULL_CHART_FILE, dpi=200, bbox_inches="tight")
    plt.close()


def save_histogram(series: pd.Series, title: str, xlabel: str, file_name: str, color: str, log_scale: bool = False) -> None:
    plot_series = series.dropna()
    if log_scale:
        plot_series = np.log1p(plot_series)

    plt.figure(figsize=(12, 7))
    ax = sns.histplot(plot_series, bins=30, kde=True, color=color, edgecolor="white", alpha=0.9)
    ax.set_xlabel(xlabel)
    ax.set_ylabel("빈도")

    subtitle = "치우친 분포를 보기 쉽도록 log1p 변환을 적용" if log_scale else "원본 값 기준의 분포"
    finalize_plot(title, subtitle)
    plt.savefig(OUTPUT_DIR / file_name, dpi=200, bbox_inches="tight")
    plt.close()


def save_rating_chart(df: pd.DataFrame) -> None:
    plot_df = (
        df["rating"]
        .fillna("미상")
        .replace("", "미상")
        .value_counts()
        .reset_index()
    )
    plot_df.columns = ["rating", "count"]
    palette_map = build_palette_map(plot_df["rating"], "crest")

    plt.figure(figsize=(12, 7))
    ax = sns.barplot(
        data=plot_df,
        x="count",
        y="rating",
        hue="rating",
        palette=palette_map,
        dodge=False,
        legend=False,
    )
    ax.set_xlabel("영화 수")
    ax.set_ylabel("관람등급")

    for patch, value in zip(ax.patches, plot_df["count"]):
        ax.text(
            patch.get_width() + max(plot_df["count"].max() * 0.01, 1),
            patch.get_y() + patch.get_height() / 2,
            f"{value}",
            va="center",
            fontsize=10,
            color="#2D3047",
        )

    finalize_plot("관람등급별 영화 수", "범주형 변수의 전체 분포를 확인")
    plt.savefig(OUTPUT_DIR / RATING_COUNTS_FILE, dpi=200, bbox_inches="tight")
    plt.close()


def save_open_year_chart(df: pd.DataFrame) -> None:
    plot_df = df["open_year"].dropna().astype(int).value_counts().sort_index().reset_index()
    plot_df.columns = ["open_year", "count"]

    plt.figure(figsize=(12, 7))
    ax = sns.barplot(data=plot_df, x="open_year", y="count", color=PLOT_COLORS["teal"])
    ax.set_xlabel("개봉연도")
    ax.set_ylabel("영화 수")

    for patch, value in zip(ax.patches, plot_df["count"]):
        ax.text(
            patch.get_x() + patch.get_width() / 2,
            patch.get_height() + max(plot_df["count"].max() * 0.01, 1),
            f"{value}",
            ha="center",
            va="bottom",
            fontsize=10,
            color="#2D3047",
        )

    finalize_plot("개봉연도별 영화 수", "2016~2025 분석 범위 내 연도별 분포")
    plt.savefig(OUTPUT_DIR / OPEN_YEAR_COUNTS_FILE, dpi=200, bbox_inches="tight")
    plt.close()


def save_genre_chart(df: pd.DataFrame) -> None:
    plot_df = df["genre_main"].fillna("미상").value_counts().head(10).reset_index()
    plot_df.columns = ["genre_main", "count"]
    palette_map = build_palette_map(plot_df["genre_main"], "rocket")

    plt.figure(figsize=(13, 7))
    ax = sns.barplot(
        data=plot_df,
        x="count",
        y="genre_main",
        hue="genre_main",
        palette=palette_map,
        dodge=False,
        legend=False,
    )
    ax.set_xlabel("영화 수")
    ax.set_ylabel("대표 장르")

    for patch, value in zip(ax.patches, plot_df["count"]):
        ax.text(
            patch.get_width() + max(plot_df["count"].max() * 0.01, 1),
            patch.get_y() + patch.get_height() / 2,
            f"{value}",
            va="center",
            fontsize=10,
            color="#2D3047",
        )

    finalize_plot("대표 장르 상위 10개", "다중 장르 컬럼에서 첫 번째 값을 대표 장르로 사용")
    plt.savefig(OUTPUT_DIR / GENRE_TOP10_FILE, dpi=200, bbox_inches="tight")
    plt.close()


def save_boxplot_chart(df: pd.DataFrame) -> None:
    plot_df = df[["total_audience_count", "total_sales_amount", "screen_count_peak", "show_count_total"]].copy()
    plot_df = np.log1p(plot_df)
    melted = plot_df.melt(var_name="metric", value_name="log_value")

    label_map = {
        "total_audience_count": "관객수(log1p)",
        "total_sales_amount": "매출액(log1p)",
        "screen_count_peak": "스크린수(log1p)",
        "show_count_total": "상영횟수(log1p)",
    }
    melted["metric"] = melted["metric"].map(label_map)
    palette_map = build_palette_map(melted["metric"], "Set2")

    plt.figure(figsize=(12, 7))
    ax = sns.boxplot(
        data=melted,
        x="metric",
        y="log_value",
        hue="metric",
        palette=palette_map,
        dodge=False,
        legend=False,
    )
    ax.set_xlabel("지표")
    ax.set_ylabel("값")
    plt.xticks(rotation=10)

    finalize_plot("수치형 변수 분포 비교", "변수 간 규모 차이를 줄이기 위해 log1p 변환을 적용")
    plt.savefig(OUTPUT_DIR / NUMERIC_BOXPLOTS_FILE, dpi=200, bbox_inches="tight")
    plt.close()


def main() -> None:
    setup_style()
    ensure_output_dir()

    df = load_data()
    basic_stats = save_basic_statistics(df)
    null_summary = save_null_summary(df)
    save_overview_text(df, basic_stats, null_summary)

    save_null_chart(null_summary)
    save_histogram(
        df["total_audience_count"],
        title="관객수 분포",
        xlabel="log1p(관객수)",
        file_name=AUDIENCE_DISTRIBUTION_FILE,
        color=PLOT_COLORS["coral"],
        log_scale=True,
    )
    save_histogram(
        df["total_sales_amount"],
        title="매출액 분포",
        xlabel="log1p(매출액)",
        file_name=SALES_DISTRIBUTION_FILE,
        color=PLOT_COLORS["gold"],
        log_scale=True,
    )
    save_histogram(
        df["screen_count_peak"],
        title="스크린수 분포",
        xlabel="스크린수",
        file_name=SCREEN_DISTRIBUTION_FILE,
        color=PLOT_COLORS["teal"],
    )
    save_histogram(
        df["show_count_total"],
        title="상영횟수 분포",
        xlabel="상영횟수",
        file_name=SHOW_DISTRIBUTION_FILE,
        color=PLOT_COLORS["rose"],
    )
    save_rating_chart(df)
    save_open_year_chart(df)
    save_genre_chart(df)
    save_boxplot_chart(df)

    print(f"saved_to={OUTPUT_DIR}")
    print(
        "outputs="
        f"{BASIC_STATISTICS_FILE},{NULL_SUMMARY_FILE},{DATASET_OVERVIEW_FILE},{NULL_CHART_FILE},"
        f"{AUDIENCE_DISTRIBUTION_FILE},{SALES_DISTRIBUTION_FILE},{SCREEN_DISTRIBUTION_FILE},"
        f"{SHOW_DISTRIBUTION_FILE},{RATING_COUNTS_FILE},{OPEN_YEAR_COUNTS_FILE},"
        f"{GENRE_TOP10_FILE},{NUMERIC_BOXPLOTS_FILE}"
    )


if __name__ == "__main__":
    main()
