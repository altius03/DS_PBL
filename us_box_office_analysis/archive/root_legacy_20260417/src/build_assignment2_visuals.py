from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib import font_manager

matplotlib.use("Agg")
import matplotlib.pyplot as plt


ROOT = Path(__file__).resolve().parents[1]


def find_main_dataset() -> Path:
    for path in ROOT.rglob("*.csv"):
        try:
            columns = pd.read_csv(path, nrows=0).columns
        except Exception:
            continue
        if len(columns) == 37:
            return path
    raise FileNotFoundError("37-column main dataset was not found.")


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


def load_data() -> pd.DataFrame:
    data_file = find_main_dataset()
    df = pd.read_csv(data_file)

    col_open_date = df.columns[4]
    col_genre = df.columns[6]
    col_target = df.columns[17]
    col_opening = df.columns[21]
    col_widest = df.columns[22]

    df["target_worldwide"] = pd.to_numeric(df[col_target], errors="coerce")
    df["opening_theaters"] = pd.to_numeric(df[col_opening], errors="coerce")
    df["widest_theaters"] = pd.to_numeric(df[col_widest], errors="coerce")
    df["open_date"] = pd.to_datetime(df[col_open_date], errors="coerce")
    df["open_month"] = df["open_date"].dt.month

    df["대표장르"] = (
        df[col_genre]
        .fillna("미상")
        .astype(str)
        .str.split("|")
        .str[0]
        .replace("", "미상")
    )

    def classify_release_timing(month: float) -> str:
        if pd.isna(month):
            return "미상"
        if month in {5, 6, 7, 8}:
            return "여름 성수기"
        if month in {11, 12}:
            return "연말 성수기"
        return "일반기"

    df["개봉시기"] = df["open_month"].apply(classify_release_timing)
    return df


def get_output_dir(data_file: Path) -> Path:
    project_dir = data_file.parents[2]
    return project_dir / "outputs" / "visuals"


def ensure_output_dir(output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)


def finish_plot(title: str, subtitle: str | None = None) -> None:
    plt.suptitle(title, x=0.06, y=0.98, ha="left", fontsize=20, fontweight="bold")
    if subtitle:
        plt.figtext(0.06, 0.93, subtitle, ha="left", fontsize=11, color="#5C6770")
    plt.tight_layout(rect=(0, 0, 1, 0.9))


def save_distribution_overview(df: pd.DataFrame, output_dir: Path) -> None:
    plot_df = df[["target_worldwide", "widest_theaters", "opening_theaters"]].copy()
    plot_df = plot_df[plot_df["target_worldwide"] > 0]
    plot_df = plot_df[plot_df["widest_theaters"] > 0]
    plot_df = plot_df[plot_df["opening_theaters"] > 0]

    fig, axes = plt.subplots(1, 3, figsize=(18, 5))
    chart_specs = [
        ("target_worldwide", "전세계 흥행수익", "#F4A261"),
        ("widest_theaters", "최대 상영 극장수", "#247BA0"),
        ("opening_theaters", "오픈 극장수", "#F25F5C"),
    ]

    for ax, (column, label, color) in zip(axes, chart_specs):
        sns.histplot(plot_df[column].map(lambda x: np.log1p(x)), bins=30, kde=True, color=color, ax=ax)
        ax.set_title(label, loc="left", fontsize=14, fontweight="bold")
        ax.set_xlabel(f"log1p({label})")
        ax.set_ylabel("영화 수")

    finish_plot("분포도 비교", "왜도가 큰 변수라 모두 log1p 변환 후 분포를 비교")
    plt.savefig(output_dir / "01_distribution_overview.png", dpi=220, bbox_inches="tight")
    plt.close()


def save_scatter_plot(
    df: pd.DataFrame,
    feature_col: str,
    feature_label: str,
    output_name: str,
    color: str,
    output_dir: Path,
) -> dict[str, float]:
    plot_df = df[[feature_col, "target_worldwide"]].dropna().copy()
    plot_df = plot_df[(plot_df[feature_col] > 0) & (plot_df["target_worldwide"] > 0)]
    plot_df["feature_log"] = plot_df[feature_col].map(lambda x: np.log1p(x))
    plot_df["target_log"] = plot_df["target_worldwide"].map(lambda x: np.log1p(x))

    correlation = plot_df["feature_log"].corr(plot_df["target_log"])

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
        f"Pearson r = {correlation:.3f}",
        transform=ax.transAxes,
        ha="left",
        va="top",
        fontsize=12,
        bbox={"facecolor": "white", "edgecolor": "#D9D9D9", "boxstyle": "round,pad=0.35"},
    )

    finish_plot(
        f"{feature_label}와 전세계 흥행수익의 관계",
        "수치형 피처는 산점도와 상관계수로 관계를 확인",
    )
    plt.savefig(output_dir / output_name, dpi=220, bbox_inches="tight")
    plt.close()

    return {
        "feature": feature_label,
        "pair_count": int(len(plot_df)),
        "pearson_r_log": round(float(correlation), 4),
    }


def save_genre_boxplot(df: pd.DataFrame, output_dir: Path) -> None:
    counts = df["대표장르"].value_counts().head(10)
    order = counts.index.tolist()

    plot_df = df[df["대표장르"].isin(order)][["대표장르", "target_worldwide"]].dropna().copy()
    plot_df = plot_df[plot_df["target_worldwide"] > 0]

    plt.figure(figsize=(14, 8))
    ax = sns.boxplot(
        data=plot_df,
        x="target_worldwide",
        y="대표장르",
        order=order,
        color="#247BA0",
        showfliers=False,
    )
    ax.set_xscale("log")
    ax.set_xlabel("전세계 흥행수익 (log scale)")
    ax.set_ylabel("대표장르")

    finish_plot(
        "대표장르별 전세계 흥행수익 분포",
        "범주형 피처는 그룹별 분포도를 비교",
    )
    plt.savefig(output_dir / "04_genre_boxplot.png", dpi=220, bbox_inches="tight")
    plt.close()

    summary = (
        plot_df.groupby("대표장르")["target_worldwide"]
        .agg(movie_count="size", mean_usd="mean", median_usd="median")
        .round(2)
        .sort_values("median_usd", ascending=False)
        .reset_index()
    )
    summary.to_csv(output_dir / "genre_summary.csv", index=False, encoding="utf-8-sig")


def save_release_timing_boxplot(df: pd.DataFrame, output_dir: Path) -> None:
    order = ["연말 성수기", "여름 성수기", "일반기"]
    plot_df = df[df["개봉시기"].isin(order)][["개봉시기", "target_worldwide"]].dropna().copy()
    plot_df = plot_df[plot_df["target_worldwide"] > 0]

    plt.figure(figsize=(12, 7))
    ax = sns.boxplot(
        data=plot_df,
        x="target_worldwide",
        y="개봉시기",
        hue="개봉시기",
        order=order,
        palette=["#BC4749", "#F4A261", "#6A994E"],
        dodge=False,
        showfliers=False,
        legend=False,
    )
    ax.set_xscale("log")
    ax.set_xlabel("전세계 흥행수익 (log scale)")
    ax.set_ylabel("개봉시기")

    finish_plot(
        "개봉시기별 전세계 흥행수익 분포",
        "개봉일을 여름 성수기, 연말 성수기, 일반기로 재분류",
    )
    plt.savefig(output_dir / "05_release_timing_boxplot.png", dpi=220, bbox_inches="tight")
    plt.close()

    summary = (
        plot_df.groupby("개봉시기")["target_worldwide"]
        .agg(movie_count="size", mean_usd="mean", median_usd="median")
        .round(2)
        .reindex(order)
        .reset_index()
    )
    summary.to_csv(output_dir / "release_timing_summary.csv", index=False, encoding="utf-8-sig")


def save_correlation_summary(correlations: list[dict[str, float]], data_file: Path, output_dir: Path) -> None:
    pd.DataFrame(correlations).to_csv(
        output_dir / "correlation_summary.csv",
        index=False,
        encoding="utf-8-sig",
    )

    lines = [
        f"source_file={data_file}",
        "target=전세계_흥행수익_USD",
        "features=최대_상영극장수, 오픈_극장수, 대표장르, 개봉시기",
        "release_timing=여름 성수기(5~8월), 연말 성수기(11~12월), 일반기(그 외)",
        "",
        "[correlation_summary]",
    ]
    for row in correlations:
        lines.append(
            f"{row['feature']}: pair_count={row['pair_count']}, pearson_r_log={row['pearson_r_log']}"
        )

    (output_dir / "overview.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    setup_style()
    data_file = find_main_dataset()
    output_dir = get_output_dir(data_file)
    ensure_output_dir(output_dir)
    df = load_data()

    save_distribution_overview(df, output_dir)
    correlations = [
        save_scatter_plot(
            df,
            "widest_theaters",
            "최대 상영 극장수",
            "02_widest_vs_worldwide.png",
            "#247BA0",
            output_dir,
        ),
        save_scatter_plot(
            df,
            "opening_theaters",
            "오픈 극장수",
            "03_opening_vs_worldwide.png",
            "#F25F5C",
            output_dir,
        ),
    ]
    save_genre_boxplot(df, output_dir)
    save_release_timing_boxplot(df, output_dir)
    save_correlation_summary(correlations, data_file, output_dir)

    print(f"saved_to={output_dir}")


if __name__ == "__main__":
    main()
