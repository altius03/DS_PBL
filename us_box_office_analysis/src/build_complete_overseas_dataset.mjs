import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = "https://www.boxofficemojo.com";
const WIKIDATA_QUERY_URL = "https://query.wikidata.org/sparql";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const REQUEST_DELAY_MS = 200;
const MAX_RETRIES = 8;

const INPUT_INT_FIELDS = new Set([
  "chart_year",
  "rank",
  "worldwide_gross_usd",
  "domestic_gross_usd",
  "foreign_gross_usd",
  "domestic_opening_gross_from_group_usd",
  "domestic_total_gross_from_group_usd",
  "opening_gross_usd",
  "opening_theaters",
  "widest_release_theaters",
]);

const INPUT_FLOAT_FIELDS = new Set(["domestic_share_pct", "foreign_share_pct"]);

const FULL_COLUMNS = [
  "collected_at",
  "collection_status",
  "collection_note",
  "chart_year",
  "rank",
  "movie_name",
  "imdb_title_id",
  "wikidata_item_id",
  "wikidata_item_label",
  "open_date",
  "domestic_release_date_from_group",
  "earliest_release_date",
  "genre",
  "rating",
  "distributor",
  "brand_name",
  "franchise_name",
  "director",
  "writer",
  "producer",
  "production_company",
  "production_country",
  "original_language",
  "running_time",
  "budget_usd",
  "worldwide_gross_usd",
  "domestic_gross_usd",
  "domestic_share_pct",
  "foreign_gross_usd",
  "foreign_share_pct",
  "opening_gross_usd",
  "opening_theaters",
  "widest_release_theaters",
  "source_chart_url",
  "source_release_group_url",
  "source_domestic_release_url",
  "source_bom_title_url",
  "source_bom_credits_url",
  "source_wikidata_item_url",
];

const ANALYSIS_COLUMNS = [
  "chart_year",
  "rank",
  "movie_name",
  "imdb_title_id",
  "open_date",
  "earliest_release_date",
  "genre",
  "rating",
  "distributor",
  "brand_name",
  "franchise_name",
  "director",
  "production_company",
  "production_country",
  "original_language",
  "running_time",
  "budget_usd",
  "worldwide_gross_usd",
  "domestic_gross_usd",
  "foreign_gross_usd",
  "opening_gross_usd",
  "opening_theaters",
  "widest_release_theaters",
];

const MAPPING_COLUMNS = [
  "chart_year",
  "rank",
  "movie_name",
  "release_group_id",
  "imdb_title_id",
  "imdb_id_extraction_status",
  "source_release_group_url",
];

const TITLE_ENRICHMENT_COLUMNS = [
  "imdb_title_id",
  "title_fetch_status",
  "credits_fetch_status",
  "domestic_distributor",
  "title_domestic_gross_usd",
  "title_domestic_share_pct",
  "title_foreign_gross_usd",
  "title_foreign_share_pct",
  "title_worldwide_gross_usd",
  "title_domestic_opening_usd",
  "earliest_release_date",
  "title_rating",
  "title_running_time",
  "title_genre",
  "title_budget_usd",
  "brand_name",
  "franchise_name",
  "director",
  "writer",
  "producer",
  "source_bom_title_url",
  "source_bom_credits_url",
];

const WIKIDATA_COLUMNS = [
  "imdb_title_id",
  "wikidata_item_id",
  "wikidata_item_label",
  "production_company",
  "production_country",
  "original_language",
  "source_wikidata_item_url",
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const RAW_DIR = path.join(DATA_DIR, "수집자료");
const ANALYSIS_READY_DIR = path.join(DATA_DIR, "분석데이터");
const SOURCE_DIR = path.join(DATA_DIR, "원본자료");
const BOXOFFICEMOJO_DIR = path.join(SOURCE_DIR, "boxofficemojo");
const RELEASEGROUP_DIR = path.join(BOXOFFICEMOJO_DIR, "releasegroups");
const RELEASE_DIR = path.join(BOXOFFICEMOJO_DIR, "releases");
const TITLE_DIR = path.join(BOXOFFICEMOJO_DIR, "titles");
const CREDITS_DIR = path.join(BOXOFFICEMOJO_DIR, "title_credits");
const WIKIDATA_DIR = path.join(SOURCE_DIR, "wikidata");
const DEFAULT_INPUT_CSV = path.join(RAW_DIR, "boxofficemojo_worldwide_2016_2025_top_100_per_year.csv");
const DEFAULT_OUTPUT_PREFIX = "overseas_movies_complete_2016_2025";

function parseArgs(argv) {
  const args = {
    inputCsv: DEFAULT_INPUT_CSV,
    outputPrefix: DEFAULT_OUTPUT_PREFIX,
    concurrency: 2,
    wikidataBatchSize: 50,
    refresh: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--input-csv" && next) {
      args.inputCsv = path.resolve(PROJECT_ROOT, next);
      index += 1;
      continue;
    }

    if (current === "--output-prefix" && next) {
      args.outputPrefix = String(next).trim();
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

    if (current === "--wikidata-batch-size" && next) {
      const parsed = Number.parseInt(next, 10);
      if (Number.isFinite(parsed)) {
        args.wikidataBatchSize = Math.max(1, parsed);
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

function buildOutputTargets(outputPrefix) {
  if (outputPrefix === DEFAULT_OUTPUT_PREFIX) {
    return {
      mappingCsv: path.join(RAW_DIR, "boxofficemojo_imdb_mapping_2016_2025.csv"),
      titleEnrichmentCsv: path.join(RAW_DIR, "boxofficemojo_title_enrichment_2016_2025.csv"),
      wikidataCsv: path.join(RAW_DIR, "wikidata_movie_metadata_2016_2025.csv"),
      fullCsv: path.join(ANALYSIS_READY_DIR, "overseas_movies_complete_2016_2025.csv"),
      analysisCsv: path.join(ANALYSIS_READY_DIR, "overseas_movies_complete_2016_2025_analysis_ready.csv"),
      reportJson: path.join(RAW_DIR, "overseas_movies_complete_2016_2025_report.json"),
    };
  }

  return {
    mappingCsv: path.join(RAW_DIR, `${outputPrefix}_imdb_mapping.csv`),
    titleEnrichmentCsv: path.join(RAW_DIR, `${outputPrefix}_title_enrichment.csv`),
    wikidataCsv: path.join(RAW_DIR, `${outputPrefix}_wikidata_movie_metadata.csv`),
    fullCsv: path.join(ANALYSIS_READY_DIR, `${outputPrefix}.csv`),
    analysisCsv: path.join(ANALYSIS_READY_DIR, `${outputPrefix}_analysis_ready.csv`),
    reportJson: path.join(RAW_DIR, `${outputPrefix}_report.json`),
  };
}

async function ensureDirectories() {
  await Promise.all([
    mkdir(TITLE_DIR, { recursive: true }),
    mkdir(CREDITS_DIR, { recursive: true }),
    mkdir(WIKIDATA_DIR, { recursive: true }),
    mkdir(RAW_DIR, { recursive: true }),
    mkdir(ANALYSIS_READY_DIR, { recursive: true }),
  ]);
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

function normalizeCell(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
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

function normalizeText(value) {
  if (!value) {
    return null;
  }
  const normalized = decodeHtml(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeMultivalueHtml(value) {
  if (!value) {
    return null;
  }

  const prepared = value.replace(/<br\s*\/?>/gi, "\n").replace(/<\/a>/gi, "\n");
  const parts = [];
  const seen = new Set();

  for (const part of prepared.split(/[\r\n]+/)) {
    const normalized = normalizeText(part);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      parts.push(normalized);
    }
  }

  return parts.length > 0 ? parts.join("|") : null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value === null || value === undefined) {
      continue;
    }
    if (typeof value === "string" && value.trim().length === 0) {
      continue;
    }
    return value;
  }
  return null;
}

function parseMoney(value) {
  if (!value) {
    return null;
  }
  const match = String(value).match(/\$([\d,]+)/);
  return match ? Number.parseInt(match[1].replace(/,/g, ""), 10) : null;
}

function extractSpanValue(html, label) {
  const pattern = new RegExp(`<span>\\s*${escapeRegExp(label)}\\s*<\\/span>\\s*<span>([\\s\\S]*?)<\\/span>`, "i");
  const match = html.match(pattern);
  return match ? match[1] : null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractIdFromUrl(url, prefix) {
  if (!url) {
    return null;
  }
  const match = url.match(new RegExp(`/${escapeRegExp(prefix)}([A-Za-z0-9]+)/?$`));
  return match ? `${prefix}${match[1]}` : null;
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
      if (INPUT_INT_FIELDS.has(key)) {
        entry[key] = rawValue === null ? null : Number.parseInt(rawValue, 10);
      } else if (INPUT_FLOAT_FIELDS.has(key)) {
        entry[key] = rawValue === null ? null : Number.parseFloat(rawValue);
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

async function readTextFile(targetPath) {
  return readFile(targetPath, "utf8");
}

async function fetchText(url, targetPath, refresh = false) {
  if (!refresh) {
    try {
      return await readTextFile(targetPath);
    } catch {
      // fall through to fetch
    }
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

async function postSparql(query, targetPath, refresh = false) {
  if (!refresh) {
    try {
      return JSON.parse(await readTextFile(targetPath));
    } catch {
      // fall through to fetch
    }
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const body = new URLSearchParams({ query, format: "json" });
      const response = await fetch(WIKIDATA_QUERY_URL, {
        method: "POST",
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/sparql-results+json",
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
      });

      if (!response.ok) {
        const error = new Error(`Failed SPARQL POST: ${response.status} ${response.statusText}`);
        error.status = response.status;
        error.retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        throw error;
      }

      const payload = await response.json();
      await saveJson(targetPath, payload);
      await sleep(1000);
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        const waitMs = error?.retryAfterMs ?? (error?.status === 429 || error?.status === 503 ? 12000 * attempt : 2000 * attempt);
        await sleep(waitMs);
      }
    }
  }

  throw lastError;
}

function extractImdbTitleId(releaseGroupHtml) {
  const matches = Array.from(releaseGroupHtml.matchAll(/\btt\d{7,8}\b/g), (match) => match[0]);
  if (matches.length === 0) {
    return null;
  }
  const counts = new Map();
  for (const match of matches) {
    counts.set(match, (counts.get(match) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0][0];
}

function parseTitlePerformanceSummary(html) {
  const summaryBlockMatch = html.match(
    /<div class="a-section a-spacing-none mojo-performance-summary">([\s\S]*?)<div class="a-section a-spacing-top-base mojo-mobile-title-summary-pro-cta">/i,
  );
  const block = summaryBlockMatch ? summaryBlockMatch[1] : html;

  const domesticMatch = block.match(
    /Domestic\s*\(<span class="percent">([\d.]+)%<\/span>\)[\s\S]*?<span class="money">(\$[\d,]+)<\/span>/i,
  );
  const foreignMatch = block.match(
    /International\s*\(<span class="percent">([\d.]+)%<\/span>\)[\s\S]*?<span class="money">(\$[\d,]+)<\/span>/i,
  );
  const worldwideMatch = block.match(/Worldwide[\s\S]*?<span class="money">(\$[\d,]+)<\/span>/i);

  return {
    title_domestic_gross_usd: domesticMatch ? parseMoney(domesticMatch[2]) : null,
    title_domestic_share_pct: domesticMatch ? Number.parseFloat(domesticMatch[1]) : null,
    title_foreign_gross_usd: foreignMatch ? parseMoney(foreignMatch[2]) : null,
    title_foreign_share_pct: foreignMatch ? Number.parseFloat(foreignMatch[1]) : null,
    title_worldwide_gross_usd: worldwideMatch ? parseMoney(worldwideMatch[1]) : null,
  };
}

function parseTitleSummary(html) {
  const domesticDistributorRaw = extractSpanValue(html, "Domestic Distributor");
  const performanceSummary = parseTitlePerformanceSummary(html);

  return {
    domestic_distributor: domesticDistributorRaw
      ? normalizeText(domesticDistributorRaw.split(/<br\s*\/?>/i)[0])
      : null,
    ...performanceSummary,
    title_domestic_opening_usd: parseMoney(extractSpanValue(html, "Domestic Opening")),
    earliest_release_date: normalizeText(extractSpanValue(html, "Earliest Release Date")),
    title_rating: normalizeText(extractSpanValue(html, "MPAA")),
    title_running_time: normalizeText(extractSpanValue(html, "Running Time")),
    title_genre: normalizeMultivalueHtml(extractSpanValue(html, "Genres")),
    title_budget_usd: parseMoney(extractSpanValue(html, "Budget")),
    brand_name: extractPopoverPrimaryLabel(html, "a-popover-brandPopover"),
    franchise_name: extractPopoverPrimaryLabel(html, "a-popover-franchisePopover"),
  };
}

function extractPopoverPrimaryLabel(html, popoverId) {
  const blockPattern = new RegExp(
    `<div class="a-popover-preload" id="${escapeRegExp(popoverId)}">([\\s\\S]*?)<\\/div>`,
    "i",
  );
  const blockMatch = html.match(blockPattern);
  if (!blockMatch) {
    return null;
  }

  const anchorMatch = blockMatch[1].match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
  return anchorMatch ? normalizeText(anchorMatch[1]) : null;
}

function parseTitleCredits(html) {
  const tableMatch = html.match(/<table id="principalCrew"[^>]*>([\s\S]*?)<\/table>/i);
  const directors = [];
  const writers = [];
  const producers = [];

  if (tableMatch) {
    const rows = Array.from(tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi), (match) => match[1]);
    for (const rowHtml of rows) {
      const cells = Array.from(rowHtml.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi), (match) => match[1]);
      if (cells.length < 2) {
        continue;
      }
      const name = normalizeText(cells[0]);
      const role = normalizeText(cells[1]);
      if (!name || !role) {
        continue;
      }
      if (role === "Director" && !directors.includes(name)) {
        directors.push(name);
      } else if (role === "Writer" && !writers.includes(name)) {
        writers.push(name);
      } else if (role === "Producer" && !producers.includes(name)) {
        producers.push(name);
      }
    }
  }

  return {
    director: directors.length > 0 ? directors.join("|") : null,
    writer: writers.length > 0 ? writers.join("|") : null,
    producer: producers.length > 0 ? producers.join("|") : null,
  };
}

function parseReleaseBudget(html) {
  return parseMoney(extractSpanValue(html, "Budget"));
}

const releaseGroupCache = new Map();
const releaseHtmlCache = new Map();

async function loadCachedReleaseGroup(releaseGroupId) {
  const targetPath = path.join(RELEASEGROUP_DIR, `${releaseGroupId}.html`);
  if (releaseGroupCache.has(targetPath)) {
    return releaseGroupCache.get(targetPath);
  }
  const content = await readTextFile(targetPath);
  releaseGroupCache.set(targetPath, content);
  return content;
}

async function loadCachedReleaseHtml(releaseId) {
  const targetPath = path.join(RELEASE_DIR, `${releaseId}.html`);
  if (releaseHtmlCache.has(targetPath)) {
    return releaseHtmlCache.get(targetPath);
  }
  const content = await readTextFile(targetPath);
  releaseHtmlCache.set(targetPath, content);
  return content;
}

async function buildImdbMappingAsync(rows) {
  const mappingRows = [];
  const keyToImdbId = new Map();

  for (const row of rows) {
    const releaseGroupId = extractIdFromUrl(row.source_release_group_url, "gr");
    const releaseId = extractIdFromUrl(row.source_domestic_release_url, "rl");
    let imdbTitleId = null;
    let status = "release_group_missing";

    if (releaseGroupId) {
      try {
        const releaseGroupHtml = await loadCachedReleaseGroup(releaseGroupId);
        imdbTitleId = extractImdbTitleId(releaseGroupHtml);
        status = imdbTitleId ? "ok" : "imdb_id_not_found";
      } catch {
        status = "release_group_missing";
      }
    }

    if (!imdbTitleId && releaseId) {
      try {
        const releaseHtml = await loadCachedReleaseHtml(releaseId);
        imdbTitleId = extractImdbTitleId(releaseHtml);
        status = imdbTitleId ? "release_page_ok" : "release_page_imdb_id_not_found";
      } catch {
        status = "release_page_missing";
      }
    }

    mappingRows.push({
      chart_year: row.chart_year,
      rank: row.rank,
      movie_name: row.movie_name,
      release_group_id: releaseGroupId,
      imdb_title_id: imdbTitleId,
      imdb_id_extraction_status: status,
      source_release_group_url: row.source_release_group_url,
    });

    if (imdbTitleId) {
      keyToImdbId.set(`${row.chart_year}:${row.rank}`, imdbTitleId);
    }
  }

  return { mappingRows, keyToImdbId };
}

async function collectTitlePackage(imdbTitleId, refresh = false) {
  const titleUrl = `${BASE_URL}/title/${imdbTitleId}/`;
  const creditsUrl = `${BASE_URL}/title/${imdbTitleId}/credits/`;
  const titlePath = path.join(TITLE_DIR, `${imdbTitleId}.html`);
  const creditsPath = path.join(CREDITS_DIR, `${imdbTitleId}.html`);

  let titleFetchStatus = "missing";
  let creditsFetchStatus = "missing";
  let summary = {};
  let credits = {};

  try {
    const titleHtml = await fetchText(titleUrl, titlePath, refresh);
    summary = parseTitleSummary(titleHtml);
    titleFetchStatus = "ok";
  } catch (error) {
    titleFetchStatus = `failed:${error?.name ?? "Error"}`;
  }

  try {
    const creditsHtml = await fetchText(creditsUrl, creditsPath, refresh);
    credits = parseTitleCredits(creditsHtml);
    creditsFetchStatus = "ok";
  } catch (error) {
    creditsFetchStatus = `failed:${error?.name ?? "Error"}`;
  }

  return {
    imdb_title_id: imdbTitleId,
    title_fetch_status: titleFetchStatus,
    credits_fetch_status: creditsFetchStatus,
    source_bom_title_url: titleUrl,
    source_bom_credits_url: creditsUrl,
    ...summary,
    ...credits,
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

async function collectTitlePackages(imdbTitleIds, concurrency, refresh = false) {
  const rows = await mapWithConcurrency(imdbTitleIds, concurrency, (imdbTitleId) =>
    collectTitlePackage(imdbTitleId, refresh),
  );
  rows.sort((left, right) => left.imdb_title_id.localeCompare(right.imdb_title_id));
  return rows;
}

function chunked(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function buildWikidataQuery(imdbTitleIds) {
  const values = imdbTitleIds.map((imdbTitleId) => `"${imdbTitleId}"`).join(" ");
  return `
SELECT ?imdb_title_id ?item ?itemLabel
       (GROUP_CONCAT(DISTINCT ?countryLabel; separator="|") AS ?production_country)
       (GROUP_CONCAT(DISTINCT ?languageLabel; separator="|") AS ?original_language)
       (GROUP_CONCAT(DISTINCT ?companyLabel; separator="|") AS ?production_company)
WHERE {
  VALUES ?imdb_title_id { ${values} }
  ?item wdt:P345 ?imdb_title_id .
  OPTIONAL { ?item wdt:P495 ?country . }
  OPTIONAL { ?item wdt:P364 ?language . }
  OPTIONAL { ?item wdt:P272 ?company . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
GROUP BY ?imdb_title_id ?item ?itemLabel
`.trim();
}

function parseWikidataPayload(payload) {
  const results = payload?.results?.bindings ?? [];
  return results.map((binding) => {
    const itemUrl = binding?.item?.value ?? null;
    return {
      imdb_title_id: binding?.imdb_title_id?.value ?? null,
      wikidata_item_id: itemUrl ? itemUrl.split("/").pop() : null,
      wikidata_item_label: normalizeCell(binding?.itemLabel?.value ?? null),
      production_company: normalizeCell(binding?.production_company?.value ?? null),
      production_country: normalizeCell(binding?.production_country?.value ?? null),
      original_language: normalizeCell(binding?.original_language?.value ?? null),
      source_wikidata_item_url: itemUrl,
    };
  });
}

async function collectWikidataMetadata(imdbTitleIds, batchSize, refresh = false) {
  const rows = [];
  const batches = chunked(imdbTitleIds, batchSize);
  for (let index = 0; index < batches.length; index += 1) {
    const query = buildWikidataQuery(batches[index]);
    const targetPath = path.join(WIKIDATA_DIR, `wikidata_movie_metadata_batch_${String(index + 1).padStart(3, "0")}.json`);
    const payload = await postSparql(query, targetPath, refresh);
    rows.push(...parseWikidataPayload(payload));
  }
  rows.sort((left, right) => left.imdb_title_id.localeCompare(right.imdb_title_id));
  return rows;
}

async function buildReleaseBudgetMap(rows) {
  const releaseBudgetMap = new Map();
  const releaseCache = new Map();

  for (const row of rows) {
    const releaseId = extractIdFromUrl(row.source_domestic_release_url, "rl");
    if (!releaseId) {
      continue;
    }

    if (!releaseCache.has(releaseId)) {
      const releasePath = path.join(RELEASE_DIR, `${releaseId}.html`);
      try {
        const releaseHtml = await readTextFile(releasePath);
        releaseCache.set(releaseId, parseReleaseBudget(releaseHtml));
      } catch {
        releaseCache.set(releaseId, null);
      }
    }

    const budgetValue = releaseCache.get(releaseId);
    if (budgetValue !== null && budgetValue !== undefined) {
      releaseBudgetMap.set(`${row.chart_year}:${row.rank}`, budgetValue);
    }
  }

  return releaseBudgetMap;
}

function buildFinalRows(rows, keyToImdbId, titleMap, wikidataMap, releaseBudgetMap) {
  return rows.map((row) => {
    const rowKey = `${row.chart_year}:${row.rank}`;
    const imdbTitleId = keyToImdbId.get(rowKey) ?? null;
    const titleEnrichment = imdbTitleId ? titleMap.get(imdbTitleId) ?? {} : {};
    const wikidataEnrichment = imdbTitleId ? wikidataMap.get(imdbTitleId) ?? {} : {};

    return {
      collected_at: row.collected_at,
      collection_status: row.collection_status,
      collection_note: row.collection_note,
      chart_year: row.chart_year,
      rank: row.rank,
      movie_name: row.movie_name,
      imdb_title_id: imdbTitleId,
      wikidata_item_id: wikidataEnrichment.wikidata_item_id ?? null,
      wikidata_item_label: wikidataEnrichment.wikidata_item_label ?? null,
      open_date: firstNonEmpty(row.open_date, row.domestic_release_date_from_group),
      domestic_release_date_from_group: row.domestic_release_date_from_group,
      earliest_release_date: titleEnrichment.earliest_release_date ?? null,
      genre: firstNonEmpty(row.genre, titleEnrichment.title_genre),
      rating: firstNonEmpty(row.rating, titleEnrichment.title_rating),
      distributor: firstNonEmpty(row.distributor, titleEnrichment.domestic_distributor),
      brand_name: titleEnrichment.brand_name ?? null,
      franchise_name: titleEnrichment.franchise_name ?? null,
      director: titleEnrichment.director ?? null,
      writer: titleEnrichment.writer ?? null,
      producer: titleEnrichment.producer ?? null,
      production_company: wikidataEnrichment.production_company ?? null,
      production_country: wikidataEnrichment.production_country ?? null,
      original_language: wikidataEnrichment.original_language ?? null,
      running_time: firstNonEmpty(row.running_time, titleEnrichment.title_running_time),
      budget_usd: firstNonEmpty(releaseBudgetMap.get(rowKey), titleEnrichment.title_budget_usd),
      worldwide_gross_usd: firstNonEmpty(row.worldwide_gross_usd, titleEnrichment.title_worldwide_gross_usd),
      domestic_gross_usd: firstNonEmpty(row.domestic_gross_usd, titleEnrichment.title_domestic_gross_usd),
      domestic_share_pct: firstNonEmpty(row.domestic_share_pct, titleEnrichment.title_domestic_share_pct),
      foreign_gross_usd: firstNonEmpty(row.foreign_gross_usd, titleEnrichment.title_foreign_gross_usd),
      foreign_share_pct: firstNonEmpty(row.foreign_share_pct, titleEnrichment.title_foreign_share_pct),
      opening_gross_usd: firstNonEmpty(
        row.opening_gross_usd,
        row.domestic_opening_gross_from_group_usd,
        titleEnrichment.title_domestic_opening_usd,
      ),
      opening_theaters: row.opening_theaters,
      widest_release_theaters: row.widest_release_theaters,
      source_chart_url: row.source_chart_url,
      source_release_group_url: row.source_release_group_url,
      source_domestic_release_url: row.source_domestic_release_url,
      source_bom_title_url: titleEnrichment.source_bom_title_url ?? null,
      source_bom_credits_url: titleEnrichment.source_bom_credits_url ?? null,
      source_wikidata_item_url: wikidataEnrichment.source_wikidata_item_url ?? null,
    };
  });
}

function summarizeMissing(rows, fields) {
  const summary = {};
  for (const field of fields) {
    summary[field] = rows.filter((row) => {
      const value = row[field];
      return value === null || value === undefined || (typeof value === "string" && value.trim().length === 0);
    }).length;
  }
  return summary;
}

function summarizePresent(rows, fields) {
  const summary = {};
  for (const field of fields) {
    summary[field] = rows.filter((row) => {
      const value = row[field];
      return !(value === null || value === undefined || (typeof value === "string" && value.trim().length === 0));
    }).length;
  }
  return summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputTargets = buildOutputTargets(args.outputPrefix);
  await ensureDirectories();

  const inputCsvContent = await readTextFile(args.inputCsv);
  const rows = parseCsv(inputCsvContent).sort((left, right) => {
    if (left.chart_year !== right.chart_year) {
      return left.chart_year - right.chart_year;
    }
    return left.rank - right.rank;
  });

  const { mappingRows, keyToImdbId } = await buildImdbMappingAsync(rows);
  await saveTextFile(outputTargets.mappingCsv, toCsv(mappingRows, MAPPING_COLUMNS));

  const imdbTitleIds = Array.from(new Set(Array.from(keyToImdbId.values()))).sort();

  const titleEnrichmentRows = await collectTitlePackages(imdbTitleIds, args.concurrency, args.refresh);
  await saveTextFile(outputTargets.titleEnrichmentCsv, toCsv(titleEnrichmentRows, TITLE_ENRICHMENT_COLUMNS));

  const wikidataRows = await collectWikidataMetadata(imdbTitleIds, args.wikidataBatchSize, args.refresh);
  await saveTextFile(outputTargets.wikidataCsv, toCsv(wikidataRows, WIKIDATA_COLUMNS));

  const titleMap = new Map(titleEnrichmentRows.filter((row) => row.imdb_title_id).map((row) => [row.imdb_title_id, row]));
  const wikidataMap = new Map(wikidataRows.filter((row) => row.imdb_title_id).map((row) => [row.imdb_title_id, row]));
  const releaseBudgetMap = await buildReleaseBudgetMap(rows);

  const finalRows = buildFinalRows(rows, keyToImdbId, titleMap, wikidataMap, releaseBudgetMap);
  const fullOutputPath = outputTargets.fullCsv;
  const analysisOutputPath = outputTargets.analysisCsv;

  await saveTextFile(fullOutputPath, toCsv(finalRows, FULL_COLUMNS));
  await saveTextFile(analysisOutputPath, toCsv(finalRows, ANALYSIS_COLUMNS));

  const report = {
    source_backbone: "Box Office Mojo",
    supplementary_source: "Wikidata",
    input_rows: rows.length,
    unique_imdb_title_ids: imdbTitleIds.length,
    title_enrichment_rows: titleEnrichmentRows.length,
    wikidata_rows: wikidataRows.length,
    nonempty_counts: summarizePresent(finalRows, [
      "budget_usd",
      "brand_name",
      "franchise_name",
      "director",
      "production_company",
      "production_country",
      "original_language",
    ]),
    missing_counts: summarizeMissing(finalRows, [
      "imdb_title_id",
      "genre",
      "rating",
      "distributor",
      "brand_name",
      "franchise_name",
      "director",
      "production_company",
      "production_country",
      "original_language",
      "running_time",
      "budget_usd",
    ]),
    notes: [
      "Audience count and show count remain unavailable from the selected trustworthy public sources.",
      "Theaters are kept from Box Office Mojo and are not equivalent to KOBIS screen count.",
      "Brand and franchise labels come from Box Office Mojo title pages and are helpful proxies for studio IP grouping.",
      "Wikidata successfully matched many IMDb IDs to item pages, but production company, country, and original language were not populated consistently enough to improve this sample.",
    ],
    output_prefix: args.outputPrefix,
    generated_at: new Date().toISOString(),
  };
  await saveJson(outputTargets.reportJson, report);

  console.log(`Saved full dataset: ${fullOutputPath}`);
  console.log(`Saved analysis-ready dataset: ${analysisOutputPath}`);
  console.log(`Saved report: ${outputTargets.reportJson}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

