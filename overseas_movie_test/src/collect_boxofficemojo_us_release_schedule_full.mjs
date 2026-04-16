import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://www.boxofficemojo.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 8;
const DEFAULT_CONCURRENCY = 2;

const RAW_COLUMNS = [
  "collected_at",
  "collection_status",
  "collection_note",
  "chart_year",
  "rank",
  "movie_name",
  "worldwide_gross_usd",
  "domestic_gross_usd",
  "domestic_share_pct",
  "foreign_gross_usd",
  "foreign_share_pct",
  "domestic_release_date_from_group",
  "domestic_opening_gross_from_group_usd",
  "domestic_total_gross_from_group_usd",
  "open_date",
  "genre",
  "rating",
  "distributor",
  "opening_gross_usd",
  "opening_theaters",
  "widest_release_theaters",
  "running_time",
  "release_scale",
  "release_note",
  "source_schedule_month_url",
  "source_chart_url",
  "source_release_group_url",
  "source_domestic_release_url",
];

const ANALYSIS_COLUMNS = [
  "movie_name",
  "open_date",
  "genre",
  "rating",
  "distributor",
  "worldwide_gross_usd",
  "domestic_gross_usd",
  "foreign_gross_usd",
  "opening_gross_usd",
  "opening_theaters",
  "widest_release_theaters",
  "running_time",
  "release_scale",
  "chart_year",
  "rank",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const SOURCE_DIR = path.join(DATA_DIR, "source_original", "boxofficemojo");
const CALENDAR_DIR = path.join(SOURCE_DIR, "calendars");
const RELEASE_DIR = path.join(SOURCE_DIR, "releases");
const RAW_DIR = path.join(DATA_DIR, "raw");
const ANALYSIS_READY_DIR = path.join(DATA_DIR, "analysis_ready");
const DEFAULT_CONFIG = path.join(PROJECT_ROOT, "configs", "us_general_theatrical_full_2016_2025.json");

function parseArgs(argv) {
  const args = {
    config: DEFAULT_CONFIG,
    execute: false,
    concurrency: DEFAULT_CONCURRENCY,
    refresh: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--config" && next) {
      args.config = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--concurrency" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        args.concurrency = Math.max(1, parsed);
      }
      index += 1;
      continue;
    }

    if (current === "--refresh") {
      args.refresh = true;
      continue;
    }

    if (current === "--execute") {
      args.execute = true;
    }
  }

  return args;
}

async function readJson(targetPath) {
  return JSON.parse(await readFile(targetPath, "utf8"));
}

async function saveJson(targetPath, payload) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function saveTextFile(targetPath, content) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function buildYears(start, end) {
  const first = Math.min(start, end);
  const last = Math.max(start, end);
  return Array.from({ length: last - first + 1 }, (_, offset) => first + offset);
}

function buildMonthStarts(years) {
  const urls = [];
  for (const year of years) {
    for (let month = 1; month <= 12; month += 1) {
      const monthText = String(month).padStart(2, "0");
      urls.push({
        year,
        month,
        isoDate: `${year}-${monthText}-01`,
        url: `${BASE_URL}/calendar/${year}-${monthText}-01/`,
      });
    }
  }
  return urls;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfterMs(headerValue) {
  if (!headerValue) {
    return null;
  }

  const numericSeconds = Number.parseInt(headerValue, 10);
  if (Number.isFinite(numericSeconds)) {
    return Math.max(1000, numericSeconds * 1000);
  }

  const retryDateMs = Date.parse(headerValue);
  if (Number.isFinite(retryDateMs)) {
    return Math.max(1000, retryDateMs - Date.now());
  }

  return null;
}

function decodeHtml(value) {
  const entityMap = new Map([
    ["amp", "&"],
    ["lt", "<"],
    ["gt", ">"],
    ["quot", '"'],
    ["apos", "'"],
    ["nbsp", " "],
    ["ndash", "-"],
    ["mdash", "-"],
    ["rsquo", "'"],
    ["lsquo", "'"],
    ["ldquo", '"'],
    ["rdquo", '"'],
    ["eacute", "e"],
    ["uuml", "u"],
    ["ouml", "o"],
    ["auml", "a"],
    ["egrave", "e"],
    ["agrave", "a"],
    ["iacute", "i"],
    ["ntilde", "n"],
  ]);

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (_, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return entityMap.get(entity) ?? `&${entity};`;
  });
}

function stripTags(value) {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function normalizeText(value) {
  return stripTags(value).replace(/\s+/g, " ").trim();
}

function normalizeCell(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePath(value) {
  return value ? value.split("?")[0] : null;
}

function parseMoney(value) {
  if (!value) {
    return null;
  }
  const cleaned = String(value).replace(/[$,\s]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "--") {
    return null;
  }
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTheaterCount(value) {
  if (!value) {
    return null;
  }
  const match = String(value).match(/([\d,]+)\s+theaters?/i);
  return match ? Number.parseInt(match[1].replace(/,/g, ""), 10) : null;
}

function parseFirstMoneyFromText(value) {
  if (!value) {
    return null;
  }
  const match = String(value).match(/\$[\d,]+/);
  return match ? parseMoney(match[0]) : null;
}

function parseFirstReleaseDate(value) {
  if (!value) {
    return null;
  }
  const normalized = normalizeText(value);
  const match = normalized.match(/[A-Z][a-z]{2} \d{1,2}, \d{4}/);
  return match ? match[0] : normalized;
}

function parseGenres(rawValue) {
  if (!rawValue) {
    return null;
  }

  const genreValues = rawValue
    .replace(/<[^>]+>/g, "\n")
    .split(/\r?\n/)
    .map((value) => decodeHtml(value).trim())
    .filter(Boolean)
    .filter((value) => !/^With:/i.test(value))
    .filter((value) => !/^\d+\s*hr/i.test(value))
    .filter((value) => !/^\d+\s*min/i.test(value));

  return genreValues.length > 0 ? genreValues.join("|") : null;
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

async function fetchText(url, targetPath, refresh = false) {
  if (!refresh && (await fileExists(targetPath))) {
    return readFile(targetPath, "utf8");
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });

      if (!response.ok) {
        const error = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        throw error;
      }

      const content = await response.text();
      await saveTextFile(targetPath, content);
      await sleep(REQUEST_DELAY_MS);
      return content;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const waitMs =
          error?.retryAfterMs ??
          (error?.status === 429 || error?.status === 503 ? 8000 * attempt : REQUEST_DELAY_MS * attempt * 4);
        await sleep(waitMs);
      }
    }
  }

  throw lastError;
}

function extractByLabel(html, label) {
  const pattern = new RegExp(`<span>${label}<\\/span><span>([\\s\\S]*?)<\\/span><\\/div>`, "i");
  const match = html.match(pattern);
  return match ? match[1] : null;
}

function extractReleaseGroupPathFromReleaseHtml(html) {
  const match =
    html.match(/<option value="(\/releasegroup\/gr\d+\/)" selected>/i) ??
    html.match(/<option value="(\/releasegroup\/gr\d+\/)">Original Release<\/option>/i) ??
    html.match(/\/releasegroup\/gr\d+\//i);

  if (!match) {
    return null;
  }

  const rawValue = Array.isArray(match) ? match[1] ?? match[0] : match[0];
  return normalizePath(rawValue);
}

function extractImdbTitleIdFromHtml(html) {
  const matches = Array.from(html.matchAll(/\btt\d{7,8}\b/g), (match) => match[0]);
  if (matches.length === 0) {
    return null;
  }

  const counts = new Map();
  for (const match of matches) {
    counts.set(match, (counts.get(match) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0][0];
}

function parseDomesticRelease(html) {
  const distributorRaw = extractByLabel(html, "Distributor");
  const openingRaw = extractByLabel(html, "Opening");
  const releaseDateRaw = extractByLabel(html, "Release Date");
  const mpaaRaw = extractByLabel(html, "MPAA");
  const runningTimeRaw = extractByLabel(html, "Running Time");
  const genresRaw = extractByLabel(html, "Genres");
  const widestReleaseRaw = extractByLabel(html, "Widest Release");
  const budgetRaw = extractByLabel(html, "Budget");

  return {
    distributor: distributorRaw ? normalizeText(distributorRaw.split(/<br\s*\/?>/i)[0]) : null,
    opening_gross_usd: parseFirstMoneyFromText(openingRaw),
    opening_theaters: parseTheaterCount(openingRaw),
    open_date: parseFirstReleaseDate(releaseDateRaw),
    rating: mpaaRaw ? normalizeText(mpaaRaw) : null,
    running_time: runningTimeRaw ? normalizeText(runningTimeRaw) : null,
    genre: parseGenres(genresRaw),
    widest_release_theaters: parseTheaterCount(widestReleaseRaw),
    release_budget_usd: parseMoney(budgetRaw),
  };
}

function parseRuntimeFromScheduleCell(cellHtml) {
  const divMatches = Array.from(
    cellHtml.matchAll(/<div class="a-section a-spacing-none[^"]*">([\s\S]*?)<\/div>/gi),
    (match) => normalizeText(match[1]),
  ).filter(Boolean);

  return divMatches.find((value) => /^\d+\s*hr(?:\s+\d+\s*min)?$/i.test(value) || /^\d+\s*min$/i.test(value)) ?? null;
}

function parseScheduleRow(cells, currentDate, monthUrl) {
  if (!currentDate || cells.length !== 3) {
    return null;
  }

  const releaseCell = cells[0];
  const distributorCell = cells[1];
  const scaleCell = cells[2];

  const releasePathMatch = releaseCell.match(/href="(\/release\/rl\d+\/)\?ref_=bo_rs_table_/i);
  const titleMatch = releaseCell.match(/<h3>([\s\S]*?)<\/h3>/i);
  const genresMatch = releaseCell.match(/<div class="a-section a-spacing-none mojo-schedule-genres">([\s\S]*?)<\/div>/i);
  const noteMatch = releaseCell.match(/<span class="a-size-base a-color-secondary">([\s\S]*?)<\/span>/i);
  const imdbMatch = releaseCell.match(/https:\/\/pro\.imdb\.com\/title\/(tt\d{7,8})/i);
  const distributorAnchorMatch = distributorCell.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);

  if (!releasePathMatch || !titleMatch) {
    return null;
  }

  const releasePath = normalizePath(releasePathMatch[1]);
  const distributorText = distributorAnchorMatch ? normalizeText(distributorAnchorMatch[1]) : normalizeText(distributorCell);
  const normalizedDistributor = distributorText === "N/A" ? null : distributorText;

  return {
    collected_at: null,
    collection_status: "schedule_only",
    collection_note: null,
    chart_year: null,
    rank: null,
    movie_name: normalizeText(titleMatch[1]),
    worldwide_gross_usd: null,
    domestic_gross_usd: null,
    domestic_share_pct: null,
    foreign_gross_usd: null,
    foreign_share_pct: null,
    domestic_release_date_from_group: currentDate,
    domestic_opening_gross_from_group_usd: null,
    domestic_total_gross_from_group_usd: null,
    open_date: currentDate,
    genre: genresMatch ? parseGenres(genresMatch[1]) : null,
    rating: null,
    distributor: normalizedDistributor,
    opening_gross_usd: null,
    opening_theaters: null,
    widest_release_theaters: null,
    running_time: parseRuntimeFromScheduleCell(releaseCell),
    release_scale: normalizeText(scaleCell),
    release_note: noteMatch ? normalizeText(noteMatch[1]) : null,
    schedule_imdb_title_id: imdbMatch ? imdbMatch[1] : null,
    source_schedule_month_url: monthUrl,
    source_chart_url: monthUrl,
    source_release_group_url: null,
    source_domestic_release_url: new URL(releasePath, BASE_URL).href,
  };
}

function parseSchedulePage(html, monthUrl) {
  const tableMatch = html.match(
    /<table class="a-bordered a-horizontal-stripes a-size-base a-span12 mojo-body-table mojo-table-annotated">([\s\S]*?)<\/table>/i,
  );
  const tableHtml = tableMatch ? tableMatch[1] : html;
  const rows = [];
  let currentDate = null;

  for (const match of tableHtml.matchAll(/<tr(?:\s+class="([^"]+)")?[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowClass = match[1] ?? "";
    const rowHtml = match[2];

    if (rowClass.includes("mojo-group-label")) {
      const dateText = normalizeText(rowHtml);
      currentDate = dateText || currentDate;
      continue;
    }

    const cells = Array.from(rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi), (cellMatch) => cellMatch[1]);
    const parsedRow = parseScheduleRow(cells, currentDate, monthUrl);
    if (parsedRow) {
      rows.push(parsedRow);
    }
  }

  return rows;
}

function dedupeRows(scheduleRows) {
  const uniqueRows = new Map();
  const duplicates = [];

  for (const row of scheduleRows) {
    const key = row.source_domestic_release_url;
    if (!uniqueRows.has(key)) {
      uniqueRows.set(key, {
        ...row,
        duplicate_source_schedule_month_urls: [row.source_schedule_month_url],
      });
      continue;
    }

    const existing = uniqueRows.get(key);
    existing.duplicate_source_schedule_month_urls.push(row.source_schedule_month_url);

    if (!existing.schedule_imdb_title_id && row.schedule_imdb_title_id) {
      existing.schedule_imdb_title_id = row.schedule_imdb_title_id;
    }
    if (!existing.genre && row.genre) {
      existing.genre = row.genre;
    }
    if (!existing.running_time && row.running_time) {
      existing.running_time = row.running_time;
    }
    if (!existing.distributor && row.distributor) {
      existing.distributor = row.distributor;
    }
    if (!existing.release_note && row.release_note) {
      existing.release_note = row.release_note;
    }

    duplicates.push({
      movie_name: row.movie_name,
      open_date: row.open_date,
      source_domestic_release_url: key,
      duplicate_month_url: row.source_schedule_month_url,
    });
  }

  return {
    uniqueRows: Array.from(uniqueRows.values()),
    duplicateRows: duplicates,
  };
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;

      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function enrichReleaseRow(row, refresh = false) {
  const releaseUrl = row.source_domestic_release_url;
  const releaseIdMatch = releaseUrl.match(/\/release\/(rl\d+)\//i);
  const releaseId = releaseIdMatch ? releaseIdMatch[1] : `${row.chart_year ?? "unknown"}_${row.movie_name}`;
  const releasePath = path.join(RELEASE_DIR, `${releaseId}.html`);

  try {
    const releaseHtml = await fetchText(releaseUrl, releasePath, refresh);
    const releaseData = parseDomesticRelease(releaseHtml);
    const releaseGroupPath = extractReleaseGroupPathFromReleaseHtml(releaseHtml);
    const imdbTitleId = extractImdbTitleIdFromHtml(releaseHtml) ?? row.schedule_imdb_title_id ?? null;

    return {
      ...row,
      collection_status: "success",
      collection_note: null,
      source_release_group_url: releaseGroupPath ? new URL(releaseGroupPath, BASE_URL).href : row.source_release_group_url,
      source_domestic_release_url: releaseUrl,
      source_chart_url: row.source_schedule_month_url,
      open_date: releaseData.open_date ?? row.open_date,
      domestic_release_date_from_group: releaseData.open_date ?? row.open_date,
      genre: releaseData.genre ?? row.genre,
      rating: releaseData.rating ?? row.rating,
      distributor: releaseData.distributor ?? row.distributor,
      opening_gross_usd: releaseData.opening_gross_usd ?? row.opening_gross_usd,
      opening_theaters: releaseData.opening_theaters ?? row.opening_theaters,
      widest_release_theaters: releaseData.widest_release_theaters ?? row.widest_release_theaters,
      running_time: releaseData.running_time ?? row.running_time,
      release_budget_usd: releaseData.release_budget_usd ?? null,
      extracted_imdb_title_id: imdbTitleId,
    };
  } catch (error) {
    return {
      ...row,
      collection_status: "release_fetch_failed",
      collection_note: error instanceof Error ? error.message : String(error),
      extracted_imdb_title_id: row.schedule_imdb_title_id ?? null,
      release_budget_usd: null,
    };
  }
}

function sortRows(rows) {
  rows.sort((left, right) => {
    const leftDate = left.open_date ?? "";
    const rightDate = right.open_date ?? "";
    if (leftDate !== rightDate) {
      return leftDate.localeCompare(rightDate);
    }
    return left.movie_name.localeCompare(right.movie_name);
  });
}

function assignYearAndRank(rows) {
  const counters = new Map();

  for (const row of rows) {
    const yearMatch = (row.open_date ?? row.domestic_release_date_from_group ?? "").match(/\b(\d{4})\b$/);
    const chartYear = yearMatch ? Number.parseInt(yearMatch[1], 10) : null;
    row.chart_year = chartYear;
    if (!Number.isFinite(chartYear)) {
      row.rank = null;
      continue;
    }
    const nextRank = (counters.get(chartYear) ?? 0) + 1;
    counters.set(chartYear, nextRank);
    row.rank = nextRank;
  }
}

function toAnalysisReadyRows(rows) {
  return rows.map((row) => ({
    movie_name: row.movie_name,
    open_date: row.open_date ?? row.domestic_release_date_from_group,
    genre: row.genre,
    rating: row.rating,
    distributor: row.distributor,
    worldwide_gross_usd: row.worldwide_gross_usd,
    domestic_gross_usd: row.domestic_gross_usd,
    foreign_gross_usd: row.foreign_gross_usd,
    opening_gross_usd: row.opening_gross_usd ?? row.domestic_opening_gross_from_group_usd,
    opening_theaters: row.opening_theaters,
    widest_release_theaters: row.widest_release_theaters,
    running_time: row.running_time,
    release_scale: row.release_scale,
    chart_year: row.chart_year,
    rank: row.rank,
  }));
}

function summarizeMissing(rows, fields) {
  const summary = {};
  for (const field of fields) {
    const missing = rows.filter((row) => {
      const value = row[field];
      return value === null || value === undefined || String(value).trim().length === 0;
    }).length;
    summary[field] = {
      missing_count: missing,
      missing_pct: Number(((missing / Math.max(rows.length, 1)) * 100).toFixed(2)),
    };
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = await readJson(args.config);
  const years = buildYears(config.years.start, config.years.end);
  const monthStarts = buildMonthStarts(years);
  const planOutput = path.resolve(PROJECT_ROOT, config.collector.planOutput);

  const plan = {
    dataset_id: config.datasetId,
    status: args.execute ? "executing" : "prepared_not_collected",
    source: config.source,
    years,
    month_page_count: monthStarts.length,
    first_five_urls: monthStarts.slice(0, 5).map((entry) => entry.url),
    last_five_urls: monthStarts.slice(-5).map((entry) => entry.url),
    planned_outputs: {
      raw_csv: path.resolve(PROJECT_ROOT, config.collector.rawOutputCsv),
      analysis_csv: path.resolve(PROJECT_ROOT, config.collector.analysisOutputCsv),
    },
    notes: [
      "The calendar collector works at monthly schedule pages, not daily pages.",
      "Monthly pages overlap, so release URLs are deduplicated after parsing.",
      "Execution mode fetches monthly schedule pages and domestic release pages, then writes a unique raw backbone CSV.",
    ],
    generated_at: new Date().toISOString(),
  };

  await saveJson(planOutput, plan);

  if (!args.execute) {
    console.log(`Saved collection plan: ${planOutput}`);
    console.log(`Years: ${years[0]}-${years[years.length - 1]}`);
    console.log(`Monthly schedule pages planned: ${monthStarts.length}`);
    return;
  }

  await Promise.all([
    mkdir(CALENDAR_DIR, { recursive: true }),
    mkdir(RELEASE_DIR, { recursive: true }),
    mkdir(RAW_DIR, { recursive: true }),
    mkdir(ANALYSIS_READY_DIR, { recursive: true }),
  ]);

  const collectedAt = new Date().toISOString();
  const scheduleRowsByMonth = [];

  for (const monthEntry of monthStarts) {
    const monthPath = path.join(CALENDAR_DIR, `${monthEntry.isoDate}.html`);
    console.log(`Fetching schedule month: ${monthEntry.url}`);
    const monthHtml = await fetchText(monthEntry.url, monthPath, args.refresh);
    const parsedRows = parseSchedulePage(monthHtml, monthEntry.url);
    scheduleRowsByMonth.push(...parsedRows);
  }

  const { uniqueRows, duplicateRows } = dedupeRows(scheduleRowsByMonth);
  sortRows(uniqueRows);
  assignYearAndRank(uniqueRows);
  const yearSet = new Set(years);
  const inRangeUniqueRows = uniqueRows.filter((row) => yearSet.has(row.chart_year));
  const outOfRangeRows = uniqueRows.filter((row) => !yearSet.has(row.chart_year));

  const enrichedRows = await mapWithConcurrency(inRangeUniqueRows, args.concurrency, (row, index) => {
    console.log(`[release ${index + 1}/${inRangeUniqueRows.length}] ${row.movie_name}`);
    return enrichReleaseRow(
      {
        ...row,
        collected_at: collectedAt,
      },
      args.refresh,
    );
  });

  sortRows(enrichedRows);
  assignYearAndRank(enrichedRows);

  const rawOutputPath = path.resolve(PROJECT_ROOT, config.collector.rawOutputCsv);
  const analysisOutputPath = path.resolve(PROJECT_ROOT, config.collector.analysisOutputCsv);
  const rawOutputBaseName = path.parse(rawOutputPath).name;
  const reportPath = path.join(RAW_DIR, `${rawOutputBaseName}_report.json`);

  await saveTextFile(rawOutputPath, `${toCsv(enrichedRows, RAW_COLUMNS)}\n`);
  await saveTextFile(analysisOutputPath, `${toCsv(toAnalysisReadyRows(enrichedRows), ANALYSIS_COLUMNS)}\n`);

  const yearCounts = {};
  for (const row of enrichedRows) {
    if (Number.isFinite(row.chart_year)) {
      yearCounts[row.chart_year] = (yearCounts[row.chart_year] ?? 0) + 1;
    }
  }

  const releaseFailures = enrichedRows.filter((row) => row.collection_status !== "success");
  const report = {
    dataset_id: config.datasetId,
    source: config.source,
    collected_at: collectedAt,
    years,
    month_page_count: monthStarts.length,
    parsed_schedule_rows_before_dedupe: scheduleRowsByMonth.length,
    out_of_range_rows_removed: outOfRangeRows.length,
    unique_release_rows: enrichedRows.length,
    duplicate_schedule_rows_removed: duplicateRows.length,
    release_fetch_failure_count: releaseFailures.length,
    year_counts: yearCounts,
    missing_summary: summarizeMissing(enrichedRows, [
      "open_date",
      "genre",
      "rating",
      "distributor",
      "opening_theaters",
      "widest_release_theaters",
      "source_release_group_url",
      "source_domestic_release_url",
    ]),
    release_failures_sample: releaseFailures.slice(0, 30).map((row) => ({
      chart_year: row.chart_year,
      movie_name: row.movie_name,
      source_domestic_release_url: row.source_domestic_release_url,
      collection_status: row.collection_status,
      collection_note: row.collection_note,
    })),
    out_of_range_sample: outOfRangeRows.slice(0, 30).map((row) => ({
      chart_year: row.chart_year,
      movie_name: row.movie_name,
      open_date: row.open_date,
      source_domestic_release_url: row.source_domestic_release_url,
    })),
    duplicate_sample: duplicateRows.slice(0, 30),
    generated_at: new Date().toISOString(),
  };

  await saveJson(reportPath, report);

  console.log(`Saved raw backbone CSV: ${rawOutputPath}`);
  console.log(`Saved analysis-ready backbone CSV: ${analysisOutputPath}`);
  console.log(`Saved collection report: ${reportPath}`);
  console.log(`Rows after dedupe: ${enrichedRows.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
