import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_CONFIG = path.join(PROJECT_ROOT, "configs", "us_general_theatrical_full_2016_2025.json");

function parseArgs(argv) {
  const args = {
    config: DEFAULT_CONFIG,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--config" && next) {
      args.config = path.resolve(PROJECT_ROOT, next);
      index += 1;
    }
  }

  return args;
}

async function readJson(targetPath) {
  const raw = await readFile(targetPath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

async function saveJson(targetPath, payload) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readJson(args.config);
  const collectorStatus = config.collector?.status ?? "configured";
  const manifestPath = path.join(
    PROJECT_ROOT,
    "data",
    "수집자료",
    "pipeline_manifests",
    `${config.datasetId}_manifest.json`,
  );

  const configRelative = path.relative(PROJECT_ROOT, args.config).replace(/\\/g, "/");
  const manifest = {
    dataset_id: config.datasetId,
    status: collectorStatus,
    source: config.source,
    years: config.years,
    commands: [
      {
        step: "plan_collection",
        command: `node src/collect_boxofficemojo_us_release_schedule_full.mjs --config ${configRelative}`,
        status: "ready",
      },
      {
        step: "collect_raw_backbone",
        command: `node src/collect_boxofficemojo_us_release_schedule_full.mjs --config ${configRelative} --execute`,
        status: collectorStatus === "completed" ? "already_completed_in_repo" : "manual_gate",
      },
      {
        step: "enrich_metadata",
        command: `node src/build_complete_overseas_dataset.mjs --input-csv ${config.enrichment.inputCsv} --output-prefix ${config.enrichment.outputPrefix}`,
        status: "ready_after_collection",
      },
      {
        step: "filter_general_movies",
        command:
          `node src/filter_overseas_general_movies.mjs ` +
          `--input-full-csv ${config.generalMovieFilter.inputFullCsv} ` +
          `--input-analysis-csv ${config.generalMovieFilter.inputAnalysisCsv} ` +
          `--output-full-csv ${config.generalMovieFilter.outputFullCsv} ` +
          `--output-analysis-csv ${config.generalMovieFilter.outputAnalysisCsv} ` +
          `--report-file ${config.generalMovieFilter.reportFile} ` +
          `--minimum-runtime-minutes ${config.generalMovieFilter.minimumRuntimeMinutes}`,
        status: "ready_after_enrichment",
      },
      {
        step: "build_analysis_summaries",
        command:
          `node src/build_overseas_analysis_summaries.mjs ` +
          `--input-file ${config.analysis.inputFile} ` +
          `--output-dir ${config.analysis.outputDir} ` +
          `--summary-title "${config.analysis.summaryTitle}"`,
        status: "ready_after_filter",
      },
      {
        step: "build_assignment1_visuals",
        command:
          `powershell -NoProfile -ExecutionPolicy Bypass -File src/build_overseas_assignment1_visuals.ps1 ` +
          `-InputFile ${config.assignment1Visuals.inputFile} ` +
          `-OutputDir ${config.assignment1Visuals.outputDir}`,
        status: "ready_after_filter",
      },
    ],
    planned_outputs: {
      collector_plan: config.collector.planOutput,
      raw_backbone_csv: config.collector.rawOutputCsv,
      enriched_analysis_csv: config.generalMovieFilter.inputAnalysisCsv,
      filtered_analysis_csv: config.generalMovieFilter.outputAnalysisCsv,
      analysis_output_dir: config.analysis.outputDir,
      assignment1_output_dir: config.assignment1Visuals.outputDir,
    },
    notes: [
      "This manifest records the current U.S. theatrical general-movie pipeline configuration.",
      `Collector status from config: ${collectorStatus}.`,
      "Run these commands from the us_box_office_analysis project root.",
    ],
    generated_at: new Date().toISOString(),
  };

  await saveJson(manifestPath, manifest);

  console.log(`Saved pipeline manifest: ${manifestPath}`);
  console.log(`Collector status: ${collectorStatus}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


