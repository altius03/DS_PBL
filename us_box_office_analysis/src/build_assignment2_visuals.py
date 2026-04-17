from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib import font_manager

matplotlib.use("Agg")
import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "분석데이터" / "미국영화_분석데이터_2016_2025.csv"
VISUALS_DIR = ROOT / "outputs" / "assignment2" / "visuals"
TABLES_DIR = ROOT / "outputs" / "assignment2" / "tables"


def setup_style() -> None:
    sns.set_theme(style="whitegrid", context="talk")
    installed_fonts = {font.name for font in font_manager.fontManager.ttflist}
    preferred_fonts = ["Malgun Gothic", "NanumGothic", "AppleGothic", "DejaVu Sans"]
    plt.rcParams["font.family"] = next(
        (font_name for font_name in preferred_fonts if font_name in installed_fonts),
        "DejaVu Sans",
    )
    plt.rcParams["axes.unicode_minus"] = False
    plt.rcParams["figure.facecolor"] = "#FCFBF7"
    plt.rcParams["axes.facecolor"] = "#FCFBF7"
    plt.rcParams["savefig.facecolor"] = "#FCFBF7"


def ensure_output_dirs() -> None:
    VISUALS_DIR.mkdir(parents=True, exist_ok=True)
    TABLES_DIR.mkdir(parents=True, exist_ok=True)


def classify_release_timing(month: float) -> str:
    if pd.isna(month):
        return "미상"
    if month in {5, 6, 7, 8}:
        return "여름 성수기"
    if month in {11, 12}:
        return "연말 성수기"
    return "일반기"


def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_FILE)

    open_date_col = df.columns[4]
    genre_col = df.columns[6]
    target_col = df.columns[17]
    opening_col = df.columns[21]
    widest_col = df.columns[22]

    df["worldwide_gross_usd"] = pd.to_numeric(df[target_col], errors="coerce")
    df["opening_theaters"] = pd.to_numeric(df[opening_col], errors="coerce")
    df["widest_theaters"] = pd.to_numeric(df[widest_col], errors="coerce")
    df["open_date"] = pd.to_datetime(df[open_date_col], errors="coerce")
    df["open_month"] = df["open_date"].dt.month
    df["main_genre"] = (
        df[genre_col]
        .fillna("미상")
        .astype(str)
        .str.split("|")
        .str[0]
        .replace("", "미상")
    )
    df["release_timing"] = df["open_month"].apply(classify_release_timing)
    return df


def finish_plot(title: str, subtitle: str | None = None) -> None:
    plt.suptitle(title, x=0.06, y=0.98, ha="left", fontsize=20, fontweight="bold")
    if subtitle:
        plt.figtext(0.06, 0.93, subtitle, ha="left", fontsize=11, color="#5C6770")
    plt.tight_layout(rect=(0, 0, 1, 0.9))


def save_distribution_overview(df: pd.DataFrame) -> None:
    plot_df = df[["worldwide_gross_usd", "widest_theaters", "opening_theaters"]].dropna().copy()
    plot_df = plot_df[
        (plot_df["worldwide_gross_usd"] > 0)
        & (plot_df["widest_theaters"] > 0)
        & (plot_df["opening_theaters"] > 0)
    ]

    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    chart_specs = [
        ("worldwide_gross_usd", "전세계 흥행수익", "#F4A261"),
        ("widest_theaters", "최대 상영 극장수", "#247BA0"),
        ("opening_theaters", "오픈 극장수", "#F25F5C"),
    ]

    for ax, (column, label, color) in zip(axes, chart_specs):
        sns.histplot(np.log1p(plot_df[column]), bins=30, kde=True, color=color, ax=ax)
        ax.set_title(label, loc="left", fontsize=14, fontweight="bold")
        ax.set_xlabel(f"log1p({label})")
        ax.set_ylabel("영화 수")

    finish_plot("2차 과제 분포도", "종속변수와 수치형 피처 분포를 log1p 기준으로 비교")
    plt.savefig(VISUALS_DIR / "a2_01_distribution_overview.png", dpi=220, bbox_inches="tight")
    plt.close()


def save_scatter_plot(
    df: pd.DataFrame,
    feature_col: str,
    feature_label: str,
    output_name: str,
    color: str,
) -> dict[str, float]:
    plot_df = df[[feature_col, "worldwide_gross_usd"]].dropna().copy()
    plot_df = plot_df[(plot_df[feature_col] > 0) & (plot_df["worldwide_gross_usd"] > 0)]
    plot_df["feature_log"] = np.log1p(plot_df[feature_col])
    plot_df["target_log"] = np.log1p(plot_df["worldwide_gross_usd"])

    raw_correlation = plot_df[feature_col].corr(plot_df["worldwide_gross_usd"])
    log_correlation = plot_df["feature_log"].corr(plot_df["target_log"])

    plt.figure(figsize=(10, 7))
    ax = sns.regplot(
        data=plot_df,
        x="feature_log",
        y="target_log",
        scatter_kws={"alpha": 0.25, "s": 30, "color": color, "edgecolor": "none"},
        line_kws={"color": "#1D3557", "linewidth": 2},
    )
    ax.set_xlabel(f"log1p({feature_label})")
    ax.set_ylabel("log1p(전세계 흥행수익)")
    ax.text(
        0.03,
        0.95,
        f"Pearson r(raw) = {raw_correlation:.3f}\nPearson r(log) = {log_correlation:.3f}",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=12,
        bbox={"facecolor": "white", "edgecolor": "#D9D9D9", "boxstyle": "round,pad=0.35"},
    )

    finish_plot(
        f"{feature_label}와 전세계 흥행수익의 관계",
        "수치형 피처는 산점도와 상관계수로 확인",
    )
    plt.savefig(VISUALS_DIR / output_name, dpi=220, bbox_inches="tight")
    plt.close()

    return {
        "feature": feature_label,
        "pair_count": int(len(plot_df)),
        "pearson_r_raw": round(float(raw_correlation), 4),
        "pearson_r_log": round(float(log_correlation), 4),
    }


def save_genre_boxplot(df: pd.DataFrame) -> None:
    genre_counts = df["main_genre"].value_counts().head(10)
    order = genre_counts.index.tolist()

    plot_df = df[df["main_genre"].isin(order)][["main_genre", "worldwide_gross_usd"]].dropna().copy()
    plot_df = plot_df[plot_df["worldwide_gross_usd"] > 0]

    plt.figure(figsize=(14, 8))
    ax = sns.boxplot(
        data=plot_df,
        x="worldwide_gross_usd",
        y="main_genre",
        order=order,
        color="#247BA0",
        showfliers=False,
    )
    ax.set_xscale("log")
    ax.set_xlabel("전세계 흥행수익 (log scale)")
    ax.set_ylabel("대표장르")

    finish_plot("대표장르별 전세계 흥행수익 분포", "상위 10개 대표장르 기준 그룹별 분포 비교")
    plt.savefig(VISUALS_DIR / "a2_04_main_genre_boxplot.png", dpi=220, bbox_inches="tight")
    plt.close()

    summary = (
        plot_df.groupby("main_genre")["worldwide_gross_usd"]
        .agg(movie_count="size", mean_usd="mean", median_usd="median")
        .round(2)
        .sort_values("median_usd", ascending=False)
        .reset_index()
    )
    summary.to_csv(TABLES_DIR / "a2_main_genre_summary.csv", index=False, encoding="utf-8-sig")


def save_release_timing_boxplot(df: pd.DataFrame) -> None:
    order = ["연말 성수기", "여름 성수기", "일반기"]
    plot_df = df[df["release_timing"].isin(order)][["release_timing", "worldwide_gross_usd"]].dropna().copy()
    plot_df = plot_df[plot_df["worldwide_gross_usd"] > 0]

    plt.figure(figsize=(12, 7))
    ax = sns.boxplot(
        data=plot_df,
        x="worldwide_gross_usd",
        y="release_timing",
        hue="release_timing",
        order=order,
        palette=["#BC4749", "#F4A261", "#6A994E"],
        dodge=False,
        showfliers=False,
        legend=False,
    )
    ax.set_xscale("log")
    ax.set_xlabel("전세계 흥행수익 (log scale)")
    ax.set_ylabel("개봉시기")

    finish_plot("개봉시기별 전세계 흥행수익 분포", "여름 성수기, 연말 성수기, 일반기로 재분류")
    plt.savefig(VISUALS_DIR / "a2_05_release_timing_boxplot.png", dpi=220, bbox_inches="tight")
    plt.close()

    summary = (
        plot_df.groupby("release_timing")["worldwide_gross_usd"]
        .agg(movie_count="size", mean_usd="mean", median_usd="median")
        .round(2)
        .reindex(order)
        .reset_index()
    )
    summary.to_csv(TABLES_DIR / "a2_release_timing_summary.csv", index=False, encoding="utf-8-sig")


def save_summary_files(correlations: list[dict[str, float]]) -> None:
    pd.DataFrame(correlations).to_csv(
        TABLES_DIR / "a2_correlation_summary.csv",
        index=False,
        encoding="utf-8-sig",
    )

    lines = [
        f"assignment=2차 과제",
        f"source_file={DATA_FILE}",
        "target=전세계_흥행수익_USD",
        "features=최대_상영극장수, 오픈_극장수, 대표장르, 개봉시기",
        "release_timing_definition=여름 성수기(5~8월), 연말 성수기(11~12월), 일반기(그 외)",
        "",
        "[correlation_summary]",
    ]
    for row in correlations:
        lines.append(
            f"{row['feature']}: pair_count={row['pair_count']}, "
            f"pearson_r_raw={row['pearson_r_raw']}, pearson_r_log={row['pearson_r_log']}"
        )

    (TABLES_DIR / "a2_overview.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    setup_style()
    ensure_output_dirs()
    df = load_data()

    save_distribution_overview(df)
    correlations = [
        save_scatter_plot(
            df,
            "widest_theaters",
            "최대 상영 극장수",
            "a2_02_widest_vs_worldwide.png",
            "#247BA0",
        ),
        save_scatter_plot(
            df,
            "opening_theaters",
            "오픈 극장수",
            "a2_03_opening_vs_worldwide.png",
            "#F25F5C",
        ),
    ]
    save_genre_boxplot(df)
    save_release_timing_boxplot(df)
    save_summary_files(correlations)

    print(f"saved_to_visuals={VISUALS_DIR}")
    print(f"saved_to_tables={TABLES_DIR}")


if __name__ == "__main__":
    main()
