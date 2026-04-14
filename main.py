from src.build_filtered_analysis_ready_data import main as build_filtered_data
from src.load_analysis_ready_data import main as run_analysis


def main() -> None:
    build_filtered_data()
    run_analysis()


if __name__ == "__main__":
    main()
