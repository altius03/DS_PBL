from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import seaborn as sns
from matplotlib import font_manager


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "analysis_ready_audience_over_100" / "kobis_korean_movies_analysis_ready_2016_2025_audience_over_100.csv"
OUTPUT_DIR = ROOT / "outputs" / "visuals" / "assignment1_audience_over_100"
FILTER_DESCRIPTION = "total_audience_count > 100"

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
    basic_stats.to_csv(OUTPUT_DIR / "basic_statistics.csv", encoding="utf-8-sig")
    return basic_stats


def save_null_summary(df: pd.DataFrame) -> pd.DataFrame:
    null_summary = pd.DataFrame(
        {
            "null_count": df.isnull().sum(),
            "null_ratio_percent": (df.isnull().mean() * 100).round(2),
        }
    ).sort_values(["null_count", "null_ratio_percent"], ascending=False)
    null_summary.to_csv(OUTPUT_DIR / "null_summary.csv", encoding="utf-8-sig")
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

    (OUTPUT_DIR / "dataset_overview.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


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
    plt.savefig(OUTPUT_DIR / "01_null_counts.png", dpi=200, bbox_inches="tight")
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
    plt.savefig(OUTPUT_DIR / "06_rating_counts.png", dpi=200, bbox_inches="tight")
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
    plt.savefig(OUTPUT_DIR / "07_open_year_counts.png", dpi=200, bbox_inches="tight")
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
    plt.savefig(OUTPUT_DIR / "08_genre_main_top10.png", dpi=200, bbox_inches="tight")
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
    plt.savefig(OUTPUT_DIR / "09_numeric_boxplots.png", dpi=200, bbox_inches="tight")
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
        file_name="02_audience_distribution.png",
        color=PLOT_COLORS["coral"],
        log_scale=True,
    )
    save_histogram(
        df["total_sales_amount"],
        title="매출액 분포",
        xlabel="log1p(매출액)",
        file_name="03_sales_distribution.png",
        color=PLOT_COLORS["gold"],
        log_scale=True,
    )
    save_histogram(
        df["screen_count_peak"],
        title="스크린수 분포",
        xlabel="스크린수",
        file_name="04_screen_distribution.png",
        color=PLOT_COLORS["teal"],
    )
    save_histogram(
        df["show_count_total"],
        title="상영횟수 분포",
        xlabel="상영횟수",
        file_name="05_show_distribution.png",
        color=PLOT_COLORS["rose"],
    )
    save_rating_chart(df)
    save_open_year_chart(df)
    save_genre_chart(df)
    save_boxplot_chart(df)

    print(f"saved_to={OUTPUT_DIR}")
    print(
        "outputs=basic_statistics.csv,null_summary.csv,dataset_overview.txt,01_null_counts.png,"
        "02_audience_distribution.png,03_sales_distribution.png,04_screen_distribution.png,"
        "05_show_distribution.png,06_rating_counts.png,07_open_year_counts.png,"
        "08_genre_main_top10.png,09_numeric_boxplots.png"
    )


if __name__ == "__main__":
    main()
