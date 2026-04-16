import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DEFAULT_INPUT_FILE = path.join(
  PROJECT_ROOT,
  "data",
  "analysis_ready",
  "overseas_movies_general_only_2016_2025_analysis_ready.csv",
);
const DEFAULT_OUTPUT_DIR = path.join(PROJECT_ROOT, "outputs", "visuals", "overseas_analysis");

const INT_FIELDS = new Set([
  "chart_year",
  "rank",
  "worldwide_gross_usd",
  "domestic_gross_usd",
  "foreign_gross_usd",
  "opening_gross_usd",
  "opening_theaters",
  "widest_release_theaters",
  "budget_usd",
]);

const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAME = new Map([
  ["Jan", "January"],
  ["Feb", "February"],
  ["Mar", "March"],
  ["Apr", "April"],
  ["May", "May"],
  ["Jun", "June"],
  ["Jul", "July"],
  ["Aug", "August"],
  ["Sep", "September"],
  ["Oct", "October"],
  ["Nov", "November"],
  ["Dec", "December"],
]);

const NON_GENRE_TOKENS = new Set(["IMAX", "3D IMAX", "News", "Short", "Talk-Show"]);

function parseArgs(argv) {
  const args = {
    inputFile: DEFAULT_INPUT_FILE,
    outputDir: DEFAULT_OUTPUT_DIR,
    summaryTitle: "Overseas Analysis Summary",
    extraNote: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--input-file" && next) {
      args.inputFile = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--output-dir" && next) {
      args.outputDir = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--summary-title" && next) {
      args.summaryTitle = String(next);
      index += 1;
      continue;
    }

    if (current === "--extra-note" && next) {
      args.extraNote = String(next);
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
    return [];
  }

  const header = rows[0].map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, "") : value));

  return rows.slice(1).filter((row) => row.length > 1 || row[0] !== "").map((row) => {
    const entry = {};
    for (let index = 0; index < header.length; index += 1) {
      const key = header[index];
      const rawValue = normalizeCell(row[index] ?? "");
      if (INT_FIELDS.has(key)) {
        entry[key] = rawValue === null ? null : Number.parseInt(rawValue, 10);
      } else {
        entry[key] = rawValue;
      }
    }
    return entry;
  });
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

async function saveTextFile(targetPath, content) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function saveJson(targetPath, payload) {
  await saveTextFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`);
}

function average(values) {
  if (values.length === 0) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function sum(values) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0);
}

function pearsonCorrelation(pairs) {
  if (pairs.length < 2) {
    return null;
  }

  const xs = pairs.map((pair) => pair[0]);
  const ys = pairs.map((pair) => pair[1]);
  const xMean = xs.reduce((total, value) => total + value, 0) / xs.length;
  const yMean = ys.reduce((total, value) => total + value, 0) / ys.length;

  let numerator = 0;
  let xDenominator = 0;
  let yDenominator = 0;

  for (let index = 0; index < pairs.length; index += 1) {
    const xDiff = xs[index] - xMean;
    const yDiff = ys[index] - yMean;
    numerator += xDiff * yDiff;
    xDenominator += xDiff * xDiff;
    yDenominator += yDiff * yDiff;
  }

  const denominator = Math.sqrt(xDenominator * yDenominator);
  if (denominator === 0) {
    return null;
  }

  return Number((numerator / denominator).toFixed(4));
}

function groupBy(rows, keyBuilder) {
  const grouped = new Map();
  for (const row of rows) {
    const key = keyBuilder(row);
    if (key === null || key === undefined || key === "") {
      continue;
    }
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(row);
  }
  return grouped;
}

function numericValues(rows, field) {
  return rows
    .map((row) => row[field])
    .filter((value) => typeof value === "number" && Number.isFinite(value));
}

function makePerformanceRow(label, rows, extra = {}) {
  const worldwide = numericValues(rows, "worldwide_gross_usd");
  const domestic = numericValues(rows, "domestic_gross_usd");
  const opening = numericValues(rows, "opening_gross_usd");
  const budget = numericValues(rows, "budget_usd");
  const widest = numericValues(rows, "widest_release_theaters");

  return {
    label,
    movie_count: rows.length,
    total_worldwide_gross_usd: sum(worldwide),
    average_worldwide_gross_usd: average(worldwide),
    average_domestic_gross_usd: average(domestic),
    average_opening_gross_usd: average(opening),
    average_budget_usd: average(budget),
    budget_count: budget.length,
    average_widest_release_theaters: average(widest),
    ...extra,
  };
}

function getMonthCode(openDate) {
  if (!openDate) {
    return null;
  }
  const match = String(openDate).match(/^[A-Z][a-z]{2}/);
  return match ? match[0] : null;
}

function getQuarter(monthCode) {
  const monthIndex = MONTH_ORDER.indexOf(monthCode);
  if (monthIndex === -1) {
    return null;
  }
  return `Q${Math.floor(monthIndex / 3) + 1}`;
}

function getCovidPeriod(year) {
  if (year >= 2016 && year <= 2019) {
    return "pre_covid_2016_2019";
  }
  if (year >= 2020 && year <= 2022) {
    return "covid_2020_2022";
  }
  if (year >= 2023 && year <= 2025) {
    return "post_covid_2023_2025";
  }
  return null;
}

function getTheaterBand(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  if (value < 1000) {
    return "under_1000";
  }
  if (value < 2000) {
    return "1000_1999";
  }
  if (value < 3000) {
    return "2000_2999";
  }
  if (value < 4000) {
    return "3000_3999";
  }
  return "4000_plus";
}

function normalizeGenreTokens(rawGenreValue) {
  if (!rawGenreValue) {
    return [];
  }

  return rawGenreValue
    .split("|")
    .map((genre) => genre.trim())
    .filter(Boolean)
    .filter((genre) => !NON_GENRE_TOKENS.has(genre));
}

function isTop100Sample(inputFile) {
  return /top_100/i.test(path.basename(inputFile));
}

function buildGenreSummary(rows) {
  const exploded = [];

  for (const row of rows) {
    const genres = normalizeGenreTokens(row.genre);
    for (const genre of genres) {
      exploded.push({ ...row, __genre: genre });
    }
  }

  const grouped = groupBy(exploded, (row) => row.__genre);
  return Array.from(grouped.entries())
    .map(([genre, groupRows]) => makePerformanceRow(genre, groupRows, { genre }))
    .sort((left, right) => (right.average_worldwide_gross_usd ?? 0) - (left.average_worldwide_gross_usd ?? 0));
}

function buildMonthSummary(rows) {
  const grouped = groupBy(rows, (row) => getMonthCode(row.open_date));
  return MONTH_ORDER.filter((monthCode) => grouped.has(monthCode)).map((monthCode) =>
    makePerformanceRow(monthCode, grouped.get(monthCode), {
      release_month_code: monthCode,
      release_month_name: MONTH_NAME.get(monthCode),
      release_quarter: getQuarter(monthCode),
    }),
  );
}

function buildRatingSummary(rows) {
  const grouped = groupBy(rows, (row) => row.rating);
  return Array.from(grouped.entries())
    .map(([rating, groupRows]) => makePerformanceRow(rating, groupRows, { rating }))
    .sort((left, right) => right.movie_count - left.movie_count);
}

function buildTheaterBandSummary(rows) {
  const grouped = groupBy(rows, (row) => getTheaterBand(row.widest_release_theaters));
  const bandOrder = ["under_1000", "1000_1999", "2000_2999", "3000_3999", "4000_plus"];
  return bandOrder.filter((band) => grouped.has(band)).map((band) =>
    makePerformanceRow(band, grouped.get(band), {
      widest_release_band: band,
      average_opening_theaters: average(numericValues(grouped.get(band), "opening_theaters")),
      average_widest_release_theaters: average(numericValues(grouped.get(band), "widest_release_theaters")),
    }),
  );
}

function buildTheaterCorrelationSummary(rows) {
  const widestWorldwidePairs = rows
    .filter((row) => typeof row.widest_release_theaters === "number" && typeof row.worldwide_gross_usd === "number")
    .map((row) => [row.widest_release_theaters, row.worldwide_gross_usd]);
  const openingWorldwidePairs = rows
    .filter((row) => typeof row.opening_theaters === "number" && typeof row.worldwide_gross_usd === "number")
    .map((row) => [row.opening_theaters, row.worldwide_gross_usd]);
  const widestDomesticPairs = rows
    .filter((row) => typeof row.widest_release_theaters === "number" && typeof row.domestic_gross_usd === "number")
    .map((row) => [row.widest_release_theaters, row.domestic_gross_usd]);
  const openingDomesticPairs = rows
    .filter((row) => typeof row.opening_theaters === "number" && typeof row.domestic_gross_usd === "number")
    .map((row) => [row.opening_theaters, row.domestic_gross_usd]);

  return {
    widest_release_vs_worldwide_gross: {
      pair_count: widestWorldwidePairs.length,
      pearson_correlation: pearsonCorrelation(widestWorldwidePairs),
    },
    opening_theaters_vs_worldwide_gross: {
      pair_count: openingWorldwidePairs.length,
      pearson_correlation: pearsonCorrelation(openingWorldwidePairs),
    },
    widest_release_vs_domestic_gross: {
      pair_count: widestDomesticPairs.length,
      pearson_correlation: pearsonCorrelation(widestDomesticPairs),
    },
    opening_theaters_vs_domestic_gross: {
      pair_count: openingDomesticPairs.length,
      pearson_correlation: pearsonCorrelation(openingDomesticPairs),
    },
  };
}

function buildCovidSummary(rows) {
  const grouped = groupBy(rows, (row) => getCovidPeriod(row.chart_year));
  const order = ["pre_covid_2016_2019", "covid_2020_2022", "post_covid_2023_2025"];
  return order.filter((period) => grouped.has(period)).map((period) =>
    makePerformanceRow(period, grouped.get(period), {
      covid_period: period,
      average_opening_theaters: average(numericValues(grouped.get(period), "opening_theaters")),
      average_widest_release_theaters: average(numericValues(grouped.get(period), "widest_release_theaters")),
    }),
  );
}

function topLabel(rows, labelField, metricField) {
  if (rows.length === 0) {
    return null;
  }
  const topRow = [...rows].sort((left, right) => (right[metricField] ?? 0) - (left[metricField] ?? 0))[0];
  return topRow ? topRow[labelField] : null;
}

function buildMarkdownSummary(datasetRows, genreRows, monthRows, ratingRows, theaterBands, theaterCorrelation, covidRows, options) {
  const lines = [];
  lines.push(`# ${options.summaryTitle}`);
  lines.push("");
  lines.push("## Dataset");
  lines.push(`- source file: \`${options.inputFile}\``);
  lines.push(`- row count: \`${datasetRows.length}\``);
  lines.push(`- year range: \`2016-2025\``);
  lines.push(`- filter: \`general_movie_only\``);
  lines.push("");
  lines.push("## Analysis Questions");
  lines.push("1. 장르별 흥행 성과");
  lines.push(`- highest average worldwide gross genre: \`${topLabel(genreRows, "genre", "average_worldwide_gross_usd")}\``);
  lines.push("2. 개봉 시기별 흥행 성과");
  lines.push(`- highest average worldwide gross month: \`${topLabel(monthRows, "release_month_name", "average_worldwide_gross_usd")}\``);
  lines.push("3. 관람등급별 흥행 성과");
  lines.push(`- most frequent rating: \`${topLabel(ratingRows, "rating", "movie_count")}\``);
  lines.push("4. 극장 수와 흥행의 관계");
  lines.push(
    `- widest release theaters vs worldwide gross correlation: \`${theaterCorrelation.widest_release_vs_worldwide_gross.pearson_correlation}\``,
  );
  lines.push(
    `- opening theaters vs domestic gross correlation: \`${theaterCorrelation.opening_theaters_vs_domestic_gross.pearson_correlation}\``,
  );
  lines.push(`- highest average worldwide gross theater band: \`${topLabel(theaterBands, "widest_release_band", "average_worldwide_gross_usd")}\``);
  lines.push("5. 코로나 전·중·후 패턴 변화");
  lines.push(
    `- highest average worldwide gross period: \`${topLabel(covidRows, "covid_period", "average_worldwide_gross_usd")}\``,
  );
  lines.push("");
  lines.push("## Notes");
  lines.push("- This sample keeps general movies only and excludes obvious re-releases and event-cinema titles.");
  if (isTop100Sample(options.inputFile)) {
    lines.push("- This sample is still yearly top 100, not the full population of all released movies.");
  } else {
    lines.push("- This dataset covers the full U.S. theatrical release schedule in the configured year range, not just top-grossing titles.");
  }
  lines.push("- Genre summaries exclude non-genre formatting tokens such as IMAX and 3D IMAX.");
  lines.push("- Theater counts are not direct equivalents of KOBIS screen counts.");
  lines.push("- Audience count and show count are unavailable in this overseas sample.");
  lines.push("- Rating is interpreted with U.S.-centered MPAA labels where present.");
  if (options.extraNote) {
    lines.push(`- ${options.extraNote}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const content = await readFile(args.inputFile, "utf8");
  const rows = parseCsv(content).sort((left, right) => {
    if (left.chart_year !== right.chart_year) {
      return left.chart_year - right.chart_year;
    }
    return left.rank - right.rank;
  });

  const genreRows = buildGenreSummary(rows);
  const monthRows = buildMonthSummary(rows);
  const ratingRows = buildRatingSummary(rows);
  const theaterBands = buildTheaterBandSummary(rows);
  const theaterCorrelation = buildTheaterCorrelationSummary(rows);
  const covidRows = buildCovidSummary(rows);
  const markdown = buildMarkdownSummary(
    rows,
    genreRows,
    monthRows,
    ratingRows,
    theaterBands,
    theaterCorrelation,
    covidRows,
    {
      inputFile: args.inputFile,
      summaryTitle: args.summaryTitle,
      extraNote: args.extraNote,
    },
  );

  await mkdir(args.outputDir, { recursive: true });
  await saveTextFile(path.join(args.outputDir, "q1_genre_summary.csv"), toCsv(genreRows, [
    "genre",
    "movie_count",
    "total_worldwide_gross_usd",
    "average_worldwide_gross_usd",
    "average_domestic_gross_usd",
    "average_opening_gross_usd",
    "average_budget_usd",
    "budget_count",
    "average_widest_release_theaters",
  ]));
  await saveTextFile(path.join(args.outputDir, "q2_release_month_summary.csv"), toCsv(monthRows, [
    "release_month_code",
    "release_month_name",
    "release_quarter",
    "movie_count",
    "total_worldwide_gross_usd",
    "average_worldwide_gross_usd",
    "average_domestic_gross_usd",
    "average_opening_gross_usd",
    "average_widest_release_theaters",
  ]));
  await saveTextFile(path.join(args.outputDir, "q3_rating_summary.csv"), toCsv(ratingRows, [
    "rating",
    "movie_count",
    "total_worldwide_gross_usd",
    "average_worldwide_gross_usd",
    "average_domestic_gross_usd",
    "average_opening_gross_usd",
    "average_widest_release_theaters",
  ]));
  await saveTextFile(path.join(args.outputDir, "q4_theater_band_summary.csv"), toCsv(theaterBands, [
    "widest_release_band",
    "movie_count",
    "average_opening_theaters",
    "average_widest_release_theaters",
    "total_worldwide_gross_usd",
    "average_worldwide_gross_usd",
    "average_domestic_gross_usd",
    "average_opening_gross_usd",
  ]));
  await saveJson(path.join(args.outputDir, "q4_theater_correlation_summary.json"), theaterCorrelation);
  await saveTextFile(path.join(args.outputDir, "q5_covid_period_summary.csv"), toCsv(covidRows, [
    "covid_period",
    "movie_count",
    "total_worldwide_gross_usd",
    "average_worldwide_gross_usd",
    "average_domestic_gross_usd",
    "average_opening_gross_usd",
    "average_opening_theaters",
    "average_widest_release_theaters",
  ]));
  await saveTextFile(path.join(args.outputDir, "analysis_question_summary.md"), markdown);

  console.log(`Saved outputs to: ${args.outputDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
