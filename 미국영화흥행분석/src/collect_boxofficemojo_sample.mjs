import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://www.boxofficemojo.com";
const DEFAULT_YEAR = 2024;
const DEFAULT_LIMIT = 100;
const DEFAULT_CONCURRENCY = 2;
const REQUEST_DELAY_MS = 150;
const MAX_RETRIES = 5;

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
  "chart_year",
  "rank",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const SOURCE_DIR = path.join(DATA_DIR, "원본자료", "boxofficemojo");
const RELEASEGROUP_DIR = path.join(SOURCE_DIR, "releasegroups");
const RELEASE_DIR = path.join(SOURCE_DIR, "releases");
const RAW_DIR = path.join(DATA_DIR, "수집자료");
const ANALYSIS_READY_DIR = path.join(DATA_DIR, "분석데이터");

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if ((current === "--year" || current === "--start-year" || current === "--end-year") && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        if (current === "--year") {
          args.year = parsed;
        } else if (current === "--start-year") {
          args.startYear = parsed;
        } else {
          args.endYear = parsed;
        }
      }
      index += 1;
      continue;
    }

    if ((current === "--limit" || current === "--concurrency") && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        if (current === "--limit") {
          args.limit = parsed;
        } else {
          args.concurrency = parsed;
        }
      }
      index += 1;
      continue;
    }

    if (current === "--refresh") {
      args.refresh = true;
    }
  }

  return args;
}

function buildYears(args) {
  if (Number.isFinite(args.year)) {
    return [args.year];
  }

  if (Number.isFinite(args.startYear) && Number.isFinite(args.endYear)) {
    const start = Math.min(args.startYear, args.endYear);
    const end = Math.max(args.startYear, args.endYear);
    return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
  }

  return [DEFAULT_YEAR];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fileExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
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

function normalizePath(value) {
  return value ? value.split("?")[0] : null;
}

function parseMoney(value) {
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "--") {
    return null;
  }

  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePercent(value) {
  const cleaned = value.replace(/[%\s]/g, "");
  if (!cleaned || cleaned === "-") {
    return null;
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseTheaterCount(value) {
  if (!value) {
    return null;
  }

  const match = value.match(/([\d,]+)\s+theaters?/i);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1].replace(/,/g, ""), 10);
}

function parseFirstMoneyFromText(value) {
  if (!value) {
    return null;
  }

  const match = value.match(/\$[\d,]+/);
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
    .filter(Boolean);

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

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    const error = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response.text();
}

async function fetchHtmlWithRetry(url) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const html = await fetchHtml(url);
      await sleep(REQUEST_DELAY_MS);
      return html;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const waitMs =
          error?.status === 503 || error?.status === 429
            ? 5000 * attempt
            : REQUEST_DELAY_MS * attempt * 4;
        console.warn(`Retrying ${url} (${attempt}/${MAX_RETRIES}) after ${waitMs}ms`);
        await sleep(waitMs);
      }
    }
  }

  throw lastError;
}

async function saveTextFile(targetPath, content) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
}

async function readOrFetchHtml(url, targetPath, refresh = false) {
  if (!refresh && (await fileExists(targetPath))) {
    return readFile(targetPath, "utf8");
  }

  const html = await fetchHtmlWithRetry(url);
  await saveTextFile(targetPath, html);
  return html;
}

function parseYearChart(html, year) {
  const tableMatch = html.match(
    /<table class="a-bordered a-horizontal-stripes a-size-base a-span12 mojo-body-table mojo-table-annotated">([\s\S]*?)<\/table>/,
  );
  const tableHtml = tableMatch ? tableMatch[1] : html;
  const rowPattern = /<tr>([\s\S]*?)<\/tr>/g;
  const rows = [];
  let match = rowPattern.exec(tableHtml);

  while (match) {
    const cellHtml = match[1];
    const cells = Array.from(cellHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g), (cellMatch) => cellMatch[1]);

    if (cells.length === 7) {
      const titleMatch = cells[1].match(/href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
      const rank = Number.parseInt(normalizeText(cells[0]), 10);

      if (titleMatch && Number.isFinite(rank)) {
        const releaseGroupPath = normalizePath(titleMatch[1]);
        rows.push({
          chart_year: Number.parseInt(year, 10),
          rank,
          movie_name: normalizeText(titleMatch[2]),
          release_group_path: releaseGroupPath,
          release_group_url: new URL(releaseGroupPath, BASE_URL).href,
          worldwide_gross_usd: parseMoney(normalizeText(cells[2])),
          domestic_gross_usd: parseMoney(normalizeText(cells[3])),
          domestic_share_pct: parsePercent(normalizeText(cells[4])),
          foreign_gross_usd: parseMoney(normalizeText(cells[5])),
          foreign_share_pct: parsePercent(normalizeText(cells[6])),
        });
      }
    }

    match = rowPattern.exec(tableHtml);
  }

  return rows;
}

function parseReleaseGroup(html) {
  const domesticReleaseMatch =
    html.match(/<option value="(\/release\/rl\d+\/)">Domestic<\/option>/) ??
    html.match(/href="(\/release\/rl\d+\/)\?ref_=bo_gr_su">Domestic/) ??
    html.match(/href="(\/release\/rl\d+\/)\?ref_=bo_gr_rls">Domestic/);

  const domesticRowMatch = html.match(
    /<tr><td class="a-align-center"><a class="a-link-normal" href="\/release\/rl\d+\/\?ref_=bo_gr_rls">Domestic<\/a><\/td><td class="a-align-center">([^<]+)<\/td><td class="a-text-right a-align-center">([\s\S]*?)<\/td><td class="a-text-right a-align-center"><span class="money">([^<]+)<\/span><\/td><\/tr>/,
  );

  const openingRaw = domesticRowMatch ? normalizeText(domesticRowMatch[2]) : null;
  const domesticReleasePath = domesticReleaseMatch ? normalizePath(domesticReleaseMatch[1]) : null;

  return {
    domestic_release_path: domesticReleasePath,
    domestic_release_url: domesticReleasePath ? new URL(domesticReleasePath, BASE_URL).href : null,
    domestic_release_date_from_group: domesticRowMatch ? domesticRowMatch[1].trim() : null,
    domestic_opening_gross_from_group_usd: openingRaw && openingRaw !== "-" ? parseMoney(openingRaw) : null,
    domestic_total_gross_from_group_usd: domesticRowMatch ? parseMoney(domesticRowMatch[3]) : null,
  };
}

function extractByLabel(html, label) {
  const pattern = new RegExp(`<span>${label}<\\/span><span>([\\s\\S]*?)<\\/span><\\/div>`);
  const match = html.match(pattern);
  return match ? match[1] : null;
}

function parseDomesticRelease(html) {
  const distributorRaw = extractByLabel(html, "Distributor");
  const openingRaw = extractByLabel(html, "Opening");
  const releaseDateRaw = extractByLabel(html, "Release Date");
  const mpaaRaw = extractByLabel(html, "MPAA");
  const runningTimeRaw = extractByLabel(html, "Running Time");
  const genresRaw = extractByLabel(html, "Genres");
  const widestReleaseRaw = extractByLabel(html, "Widest Release");

  return {
    distributor: distributorRaw ? normalizeText(distributorRaw.split("<br/>")[0]) : null,
    opening_gross_usd: parseFirstMoneyFromText(openingRaw),
    opening_theaters: parseTheaterCount(openingRaw),
    open_date: parseFirstReleaseDate(releaseDateRaw),
    rating: mpaaRaw ? normalizeText(mpaaRaw) : null,
    running_time: runningTimeRaw ? normalizeText(runningTimeRaw) : null,
    genre: parseGenres(genresRaw),
    widest_release_theaters: parseTheaterCount(widestReleaseRaw),
  };
}

function getIdFromPath(value, prefix) {
  if (!value) {
    return null;
  }

  const match = value.match(new RegExp(`/${prefix}(\\w+)/?$`));
  return match ? `${prefix}${match[1]}` : null;
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
    chart_year: row.chart_year,
    rank: row.rank,
  }));
}

function countMissingDomesticDetail(rows) {
  return rows.filter((row) => !row.source_domestic_release_url || !row.distributor).length;
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

function buildYearBaseName(year, limit) {
  return `boxofficemojo_worldwide_${year}_top_${limit}`;
}

function buildRangeBaseName(years, limit) {
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  return `boxofficemojo_worldwide_${firstYear}_${lastYear}_top_${limit}_per_year`;
}

async function writeYearOutputs(year, limit, rows, collectedAt, chartUrl) {
  const baseName = buildYearBaseName(year, limit);
  const analysisReadyRows = toAnalysisReadyRows(rows);

  const rawCsvPath = path.join(RAW_DIR, `${baseName}.csv`);
  const analysisCsvPath = path.join(ANALYSIS_READY_DIR, `${baseName}_analysis_ready.csv`);
  const metadataPath = path.join(RAW_DIR, `${baseName}_metadata.json`);

  await saveTextFile(rawCsvPath, toCsv(rows, RAW_COLUMNS));
  await saveTextFile(analysisCsvPath, toCsv(analysisReadyRows, ANALYSIS_COLUMNS));
  await saveTextFile(
    metadataPath,
    JSON.stringify(
      {
        source: "Box Office Mojo",
        chart_url: chartUrl,
        collected_at: collectedAt,
        chart_year: year,
        requested_limit: limit,
        collected_rows: rows.length,
        missing_domestic_detail_rows: countMissingDomesticDetail(rows),
        notes: [
          "Data was collected from the yearly worldwide chart and domestic release detail pages.",
          "Some titles do not have a domestic release page, so distributor/rating/genre/theater fields may be blank.",
          "Box Office Mojo provides theaters but not show-count, so this dataset cannot reproduce show-count analysis.",
        ],
      },
      null,
      2,
    ),
  );

  console.log(`Saved raw CSV: ${rawCsvPath}`);
  console.log(`Saved analysis-ready CSV: ${analysisCsvPath}`);
  console.log(`Saved metadata: ${metadataPath}`);
}

async function writeCombinedOutputs(years, limit, rows, collectedAt) {
  if (years.length <= 1) {
    return;
  }

  const baseName = buildRangeBaseName(years, limit);
  const analysisReadyRows = toAnalysisReadyRows(rows);

  const rawCsvPath = path.join(RAW_DIR, `${baseName}.csv`);
  const analysisCsvPath = path.join(ANALYSIS_READY_DIR, `${baseName}_analysis_ready.csv`);
  const metadataPath = path.join(RAW_DIR, `${baseName}_metadata.json`);

  await saveTextFile(rawCsvPath, toCsv(rows, RAW_COLUMNS));
  await saveTextFile(analysisCsvPath, toCsv(analysisReadyRows, ANALYSIS_COLUMNS));
  await saveTextFile(
    metadataPath,
    JSON.stringify(
      {
        source: "Box Office Mojo",
        collected_at: collectedAt,
        years,
        requested_limit_per_year: limit,
        collected_rows: rows.length,
        missing_domestic_detail_rows: countMissingDomesticDetail(rows),
        notes: [
          "Each year contributes up to the requested top-N rows from the yearly worldwide chart.",
          "This is a top-per-year sample, not the full population of all released movies.",
          "The dataset includes distributor, MPAA rating, opening theaters, and widest release theaters when a domestic release detail page exists.",
        ],
      },
      null,
      2,
    ),
  );

  console.log(`Saved combined raw CSV: ${rawCsvPath}`);
  console.log(`Saved combined analysis-ready CSV: ${analysisCsvPath}`);
  console.log(`Saved combined metadata: ${metadataPath}`);
}

async function collectMovieRow(row, index, total, year, collectedAt, chartUrl, refresh) {
  console.log(`[${year} ${index + 1}/${total}] ${row.movie_name}`);

  const baseRow = {
    collected_at: collectedAt,
    collection_status: "success",
    collection_note: null,
    source_chart_url: chartUrl,
    source_release_group_url: row.release_group_url,
    ...row,
  };

  const emptyReleaseGroupData = {
    domestic_release_path: null,
    domestic_release_url: null,
    domestic_release_date_from_group: null,
    domestic_opening_gross_from_group_usd: null,
    domestic_total_gross_from_group_usd: null,
  };

  const emptyDomesticReleaseData = {
    distributor: null,
    opening_gross_usd: null,
    opening_theaters: null,
    open_date: null,
    rating: null,
    running_time: null,
    genre: null,
    widest_release_theaters: null,
  };

  try {
    const releaseGroupId = getIdFromPath(row.release_group_path, "gr");
    const releaseGroupPath = releaseGroupId
      ? path.join(RELEASEGROUP_DIR, `${releaseGroupId}.html`)
      : path.join(RELEASEGROUP_DIR, `unknown_${year}_${row.rank}.html`);
    const releaseGroupHtml = await readOrFetchHtml(row.release_group_url, releaseGroupPath, refresh);
    const releaseGroupData = parseReleaseGroup(releaseGroupHtml);

    let domesticReleaseData = { ...emptyDomesticReleaseData };
    let collectionStatus = "success";
    let collectionNote = null;

    if (releaseGroupData.domestic_release_url) {
      try {
        const releaseId = getIdFromPath(releaseGroupData.domestic_release_path, "rl");
        const releasePath = releaseId
          ? path.join(RELEASE_DIR, `${releaseId}.html`)
          : path.join(RELEASE_DIR, `unknown_${year}_${row.rank}.html`);
        const releaseHtml = await readOrFetchHtml(releaseGroupData.domestic_release_url, releasePath, refresh);
        domesticReleaseData = parseDomesticRelease(releaseHtml);
      } catch (error) {
        collectionStatus = "release_detail_failed";
        collectionNote = error instanceof Error ? error.message : String(error);
      }
    } else {
      collectionStatus = "release_detail_missing";
      collectionNote = "Domestic release detail page was not available from the release group page.";
    }

    return {
      ...baseRow,
      collection_status: collectionStatus,
      collection_note: collectionNote,
      source_domestic_release_url: releaseGroupData.domestic_release_url,
      ...releaseGroupData,
      ...domesticReleaseData,
    };
  } catch (error) {
    return {
      ...baseRow,
      collection_status: "release_group_failed",
      collection_note: error instanceof Error ? error.message : String(error),
      source_domestic_release_url: null,
      ...emptyReleaseGroupData,
      ...emptyDomesticReleaseData,
    };
  }
}

async function collectYear(year, limit, concurrency, refresh, collectedAt) {
  const chartUrl = `${BASE_URL}/year/world/${year}/`;
  const chartPath = path.join(SOURCE_DIR, `year_world_${year}.html`);

  console.log(`Fetching yearly chart: ${chartUrl}`);
  const yearChartHtml = await readOrFetchHtml(chartUrl, chartPath, refresh);
  const chartRows = parseYearChart(yearChartHtml, year).slice(0, limit);

  if (chartRows.length === 0) {
    throw new Error(`Could not parse any rows from the yearly chart for ${year}.`);
  }

  const enrichedRows = await mapWithConcurrency(chartRows, concurrency, (row, index) =>
    collectMovieRow(row, index, chartRows.length, year, collectedAt, chartUrl, refresh),
  );

  enrichedRows.sort((left, right) => left.rank - right.rank);
  await writeYearOutputs(year, limit, enrichedRows, collectedAt, chartUrl);

  return enrichedRows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const years = buildYears(args);
  const limit = Number.isFinite(args.limit) ? args.limit : DEFAULT_LIMIT;
  const concurrency = Number.isFinite(args.concurrency)
    ? Math.max(1, args.concurrency)
    : DEFAULT_CONCURRENCY;
  const refresh = args.refresh ?? false;
  const collectedAt = new Date().toISOString();

  await mkdir(RELEASEGROUP_DIR, { recursive: true });
  await mkdir(RELEASE_DIR, { recursive: true });
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(ANALYSIS_READY_DIR, { recursive: true });

  const allRows = [];

  for (const year of years) {
    const rows = await collectYear(year, limit, concurrency, refresh, collectedAt);
    allRows.push(...rows);
  }

  allRows.sort((left, right) => {
    if (left.chart_year !== right.chart_year) {
      return left.chart_year - right.chart_year;
    }
    return left.rank - right.rank;
  });

  await writeCombinedOutputs(years, limit, allRows, collectedAt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

