import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const ANALYSIS_READY_DIR = path.join(PROJECT_ROOT, "data", "분석데이터");
const RAW_DIR = path.join(PROJECT_ROOT, "data", "수집자료");

const DEFAULT_INPUT_FULL_FILE = path.join(ANALYSIS_READY_DIR, "미국극장개봉일정_보강전체데이터_2016_2025.csv");
const DEFAULT_INPUT_ANALYSIS_FILE = path.join(
  ANALYSIS_READY_DIR,
  "미국극장개봉일정_보강분석데이터_2016_2025.csv",
);
const DEFAULT_OUTPUT_FULL_FILE = path.join(ANALYSIS_READY_DIR, "미국일반극장영화_전체데이터_2016_2025.csv");
const DEFAULT_OUTPUT_ANALYSIS_FILE = path.join(
  ANALYSIS_READY_DIR,
  "미국일반극장영화_분석데이터_2016_2025.csv",
);
const DEFAULT_REPORT_FILE = path.join(RAW_DIR, "미국일반극장영화_필터링리포트_2016_2025.json");
const DEFAULT_MINIMUM_RUNTIME_MINUTES = 40;

const EVENT_DISTRIBUTORS = new Set([
  "trafalgar releasing",
  "shortstv",
  "iconic events releasing",
  "imax",
]);

const TITLE_PATTERNS = [
  {
    reason: "re_release_or_anniversary",
    regex: /\b(?:re-?release|reissue|anniversary|restoration|remaster(?:ed)?)\b/i,
  },
  {
    reason: "event_or_serial_programming",
    regex:
      /\b(?:episodes?\s*\d|season\s*\d|short films?|concert|fanmeeting|eras tour|live on stage|live viewing|ballet(?: in cinema)?|opera|ghibli fest|in cinemas|live in cinemas?)\b/i,
  },
];

function parseArgs(argv) {
  const args = {
    inputFullCsv: DEFAULT_INPUT_FULL_FILE,
    inputAnalysisCsv: DEFAULT_INPUT_ANALYSIS_FILE,
    outputFullCsv: DEFAULT_OUTPUT_FULL_FILE,
    outputAnalysisCsv: DEFAULT_OUTPUT_ANALYSIS_FILE,
    reportFile: DEFAULT_REPORT_FILE,
    minimumRuntimeMinutes: DEFAULT_MINIMUM_RUNTIME_MINUTES,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (!next && current !== "--help") {
      continue;
    }

    if (current === "--input-full-csv" && next) {
      args.inputFullCsv = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--input-analysis-csv" && next) {
      args.inputAnalysisCsv = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--output-full-csv" && next) {
      args.outputFullCsv = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--output-analysis-csv" && next) {
      args.outputAnalysisCsv = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--report-file" && next) {
      args.reportFile = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--minimum-runtime-minutes" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        args.minimumRuntimeMinutes = Math.max(1, parsed);
      }
      index += 1;
    }
  }

  return args;
}

function normalizeCell(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseCsv(content) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const current = content[index];
    const next = content[index + 1];

    if (inQuotes) {
      if (current === '"' && next === '"') {
        currentCell += '"';
        index += 1;
      } else if (current === '"') {
        inQuotes = false;
      } else {
        currentCell += current;
      }
      continue;
    }

    if (current === '"') {
      inQuotes = true;
      continue;
    }

    if (current === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (current === "\n") {
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    if (current !== "\r") {
      currentCell += current;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = rows[0].map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, "") : value));
  const entries = rows
    .slice(1)
    .filter((row) => row.length > 1 || row[0] !== "")
    .map((row) => {
      const entry = {};
      for (let index = 0; index < columns.length; index += 1) {
        entry[columns[index]] = normalizeCell(row[index] ?? "");
      }
      return entry;
    });

  return { columns, rows: entries };
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return "";
  }
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function toCsv(rows, columns) {
  const header = columns.join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(row[column])).join(","));
  return [header, ...body].join("\n");
}

function parseRuntimeMinutes(value) {
  const normalized = normalizeCell(value);
  if (!normalized) {
    return null;
  }

  let totalMinutes = 0;
  const hoursMatch = normalized.match(/(\d+)\s*hr/i);
  const minutesMatch = normalized.match(/(\d+)\s*min/i);

  if (hoursMatch) {
    totalMinutes += Number.parseInt(hoursMatch[1], 10) * 60;
  }
  if (minutesMatch) {
    totalMinutes += Number.parseInt(minutesMatch[1], 10);
  }

  return totalMinutes > 0 ? totalMinutes : null;
}

function getFilterDecision(row, minimumRuntimeMinutes) {
  const reasons = [];
  const title = row.movie_name ?? "";
  const distributor = (row.distributor ?? "").toLowerCase();
  const runtimeMinutes = parseRuntimeMinutes(row.running_time);

  for (const pattern of TITLE_PATTERNS) {
    if (pattern.regex.test(title)) {
      reasons.push(pattern.reason);
    }
  }

  if (EVENT_DISTRIBUTORS.has(distributor)) {
    reasons.push("event_cinema_distributor");
  }

  if (runtimeMinutes !== null && runtimeMinutes < minimumRuntimeMinutes) {
    reasons.push("short_form_runtime");
  }

  return {
    isGeneralMovie: reasons.length === 0,
    reasons: [...new Set(reasons)],
    runtimeMinutes,
  };
}

async function saveTextFile(targetPath, content) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fullParsed = parseCsv(await readFile(args.inputFullCsv, "utf8"));
  const analysisParsed = parseCsv(await readFile(args.inputAnalysisCsv, "utf8"));

  const decisionByKey = new Map();
  const excludedExamples = [];
  const excludedByReason = {};

  for (const row of fullParsed.rows) {
    const decision = getFilterDecision(row, args.minimumRuntimeMinutes);
    const key = row.imdb_title_id ?? `${row.chart_year ?? ""}::${row.rank ?? ""}::${row.movie_name ?? ""}`;
    decisionByKey.set(key, decision);

    if (!decision.isGeneralMovie) {
      for (const reason of decision.reasons) {
        excludedByReason[reason] = (excludedByReason[reason] ?? 0) + 1;
      }

      if (excludedExamples.length < 30) {
        excludedExamples.push({
          chart_year: row.chart_year,
          movie_name: row.movie_name,
          distributor: row.distributor,
          running_time: row.running_time,
          exclusion_reasons: decision.reasons,
        });
      }
    }
  }

  const filteredFullRows = fullParsed.rows.filter((row) => {
    const key = row.imdb_title_id ?? `${row.chart_year ?? ""}::${row.rank ?? ""}::${row.movie_name ?? ""}`;
    return decisionByKey.get(key)?.isGeneralMovie === true;
  });

  const filteredAnalysisRows = analysisParsed.rows.filter((row) => {
    const key = row.imdb_title_id ?? `${row.chart_year ?? ""}::${row.rank ?? ""}::${row.movie_name ?? ""}`;
    return decisionByKey.get(key)?.isGeneralMovie === true;
  });

  const report = {
    input_full_file: args.inputFullCsv,
    input_analysis_file: args.inputAnalysisCsv,
    output_full_file: args.outputFullCsv,
    output_analysis_file: args.outputAnalysisCsv,
    total_rows: fullParsed.rows.length,
    included_rows: filteredFullRows.length,
    excluded_rows: fullParsed.rows.length - filteredFullRows.length,
    inclusion_rate_pct: Number(((filteredFullRows.length / Math.max(fullParsed.rows.length, 1)) * 100).toFixed(2)),
    filter_rules: {
      title_patterns: TITLE_PATTERNS.map((pattern) => pattern.reason),
      event_distributors: [...EVENT_DISTRIBUTORS],
      minimum_runtime_minutes: args.minimumRuntimeMinutes,
    },
    excluded_by_reason: excludedByReason,
    excluded_examples: excludedExamples,
  };

  await saveTextFile(args.outputFullCsv, `${toCsv(filteredFullRows, fullParsed.columns)}\n`);
  await saveTextFile(args.outputAnalysisCsv, `${toCsv(filteredAnalysisRows, analysisParsed.columns)}\n`);
  await saveTextFile(args.reportFile, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`Saved filtered full dataset: ${args.outputFullCsv}`);
  console.log(`Saved filtered analysis dataset: ${args.outputAnalysisCsv}`);
  console.log(`Saved filter report: ${args.reportFile}`);
  console.log(`Included ${filteredFullRows.length} of ${fullParsed.rows.length} rows.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

