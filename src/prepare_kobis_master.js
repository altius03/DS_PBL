const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const RAW_DIR = path.join(ROOT, "data", "raw");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");

const BOXOFFICE_PATTERN = /^kobis_boxoffice_yearly_(\d{4})\.xls$/i;
const METADATA_FILE = "kobis_korean_movie_metadata_2016_2025.csv";
const ANALYSIS_OPEN_DATE_START = 20160101;
const ANALYSIS_OPEN_DATE_END = 20251231;

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)));
}

function stripTags(value) {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function parseHtmlTable(filePath) {
  const html = fs.readFileSync(filePath, "utf8");
  const tableMatch = html.match(/<table[^>]*class="tbl_exc"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error(`Could not find data table in ${path.basename(filePath)}`);
  }

  const tableHtml = tableMatch[1];
  const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((match) =>
    stripTags(match[1]),
  );

  const rows = [];
  for (const rowMatch of tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) =>
      stripTags(match[1]),
    );
    if (cells.length === headers.length && cells.length > 0) {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = cells[index];
      });
      rows.push(row);
    }
  }

  return rows;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  const normalized = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(cell);
      cell = "";
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function toObjects(rows) {
  const [headers, ...records] = rows;
  return records.map((record) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = record[index] ?? "";
    });
    return obj;
  });
}

function normalizeMovieName(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDate(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length === 8 ? digits : "";
}

function isInAnalysisPeriod(openDate) {
  if (!/^\d{8}$/.test(String(openDate || ""))) {
    return false;
  }
  const numericDate = Number(openDate);
  return (
    Number.isFinite(numericDate) &&
    numericDate >= ANALYSIS_OPEN_DATE_START &&
    numericDate <= ANALYSIS_OPEN_DATE_END
  );
}

function numberOrNull(value) {
  const cleaned = String(value || "").replace(/,/g, "").trim();
  if (!cleaned) {
    return null;
  }
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
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

function writeCsv(filePath, rows, headers) {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  fs.writeFileSync(filePath, `\uFEFF${lines.join("\n")}`, "utf8");
}

function buildBoxofficeRows() {
  const files = fs
    .readdirSync(RAW_DIR)
    .filter((fileName) => BOXOFFICE_PATTERN.test(fileName))
    .sort();

  const combinedRows = [];
  for (const fileName of files) {
    const yearMatch = fileName.match(BOXOFFICE_PATTERN);
    const year = yearMatch[1];
    const filePath = path.join(RAW_DIR, fileName);
    const rows = parseHtmlTable(filePath);

    for (const row of rows) {
      combinedRows.push({
        boxoffice_year: year,
        rank: numberOrNull(row["순위"]),
        movie_name: row["영화명"] || "",
        open_date: normalizeDate(row["개봉일"]),
        sales_amount: numberOrNull(row["매출액"]),
        sales_share: numberOrNull(row["매출액 점유율"]),
        audience_count: numberOrNull(row["관객수"]),
        screen_count: numberOrNull(row["스크린수"]),
        show_count: numberOrNull(row["상영횟수"]),
        rep_nation: row["대표국적"] || "",
        nation: row["국적"] || "",
        distributor_boxoffice: row["배급사"] || "",
        match_key: `${normalizeMovieName(row["영화명"])}|${normalizeDate(row["개봉일"])}`,
        source_file: fileName,
      });
    }
  }

  return combinedRows;
}

function buildAggregatedBoxofficeRows(boxofficeRows) {
  const aggregated = new Map();

  for (const row of boxofficeRows) {
    const key = row.match_key;
    if (!aggregated.has(key)) {
      aggregated.set(key, {
        match_key: key,
        movie_name: row.movie_name,
        open_date: row.open_date,
        total_sales_amount: 0,
        total_audience_count: 0,
        screen_count_peak: 0,
        show_count_total: 0,
        sales_share_peak: 0,
        rep_nation: row.rep_nation,
        nation: row.nation,
        distributor_boxoffice: row.distributor_boxoffice,
        boxoffice_year_count: 0,
        boxoffice_years: [],
      });
    }

    const target = aggregated.get(key);
    target.total_sales_amount += row.sales_amount || 0;
    target.total_audience_count += row.audience_count || 0;
    target.screen_count_peak = Math.max(target.screen_count_peak, row.screen_count || 0);
    target.show_count_total += row.show_count || 0;
    target.sales_share_peak = Math.max(target.sales_share_peak, row.sales_share || 0);
    if (!target.boxoffice_years.includes(row.boxoffice_year)) {
      target.boxoffice_years.push(row.boxoffice_year);
      target.boxoffice_year_count += 1;
    }
    if (!target.distributor_boxoffice && row.distributor_boxoffice) {
      target.distributor_boxoffice = row.distributor_boxoffice;
    }
  }

  return [...aggregated.values()].map((row) => ({
    ...row,
    boxoffice_years: row.boxoffice_years.sort().join("|"),
  }));
}

function buildMetadataRows() {
  const filePath = path.join(RAW_DIR, METADATA_FILE);
  const text = fs.readFileSync(filePath, "utf8");
  const rows = toObjects(parseCsv(text));

  return rows.map((row) => ({
    movie_id: row["영화코드"] || "",
    movie_name: row["영화명"] || "",
    open_date: normalizeDate(row["개봉일"]),
    genre: row["장르"] || "",
    rating: row["관람등급"] || "",
    director: row["감독"] || "",
    production_company: row["제작사"] || "",
    distributor_meta: row["배급사"] || "",
    nation: row["국적"] || "",
    match_key: `${normalizeMovieName(row["영화명"])}|${normalizeDate(row["개봉일"])}`,
    name_only_key: normalizeMovieName(row["영화명"]),
  }));
}

function joinRows(aggregatedRows, metadataRows) {
  const metadataByExactKey = new Map();
  const metadataByName = new Map();
  const duplicateExactKeys = new Set();

  for (const row of metadataRows) {
    if (metadataByExactKey.has(row.match_key)) {
      duplicateExactKeys.add(row.match_key);
    } else {
      metadataByExactKey.set(row.match_key, row);
    }

    const nameRows = metadataByName.get(row.name_only_key) || [];
    nameRows.push(row);
    metadataByName.set(row.name_only_key, nameRows);
  }

  const masterRows = [];
  const unmatchedRows = [];
  let exactMatchCount = 0;
  let nameOnlyMatchCount = 0;

  for (const row of aggregatedRows) {
    let metadata = metadataByExactKey.get(row.match_key);
    let matchStrategy = "exact";

    if (metadata && duplicateExactKeys.has(row.match_key)) {
      matchStrategy = "exact_duplicate_first";
    }

    if (!metadata) {
      const candidates = metadataByName.get(normalizeMovieName(row.movie_name)) || [];
      if (candidates.length === 1) {
        [metadata] = candidates;
        matchStrategy = "name_only_unique";
      }
    }

    if (!metadata) {
      unmatchedRows.push({
        movie_name: row.movie_name,
        open_date: row.open_date,
        distributor_boxoffice: row.distributor_boxoffice,
        boxoffice_years: row.boxoffice_years,
      });
      masterRows.push({
        movie_id: "",
        movie_name: row.movie_name,
        open_date: row.open_date,
        genre: "",
        rating: "",
        director: "",
        production_company: "",
        distributor_meta: "",
        distributor_boxoffice: row.distributor_boxoffice,
        distributor_final: row.distributor_boxoffice,
        rep_nation: row.rep_nation,
        nation: row.nation,
        total_sales_amount: row.total_sales_amount,
        total_audience_count: row.total_audience_count,
        screen_count_peak: row.screen_count_peak,
        show_count_total: row.show_count_total,
        sales_share_peak: row.sales_share_peak,
        boxoffice_year_count: row.boxoffice_year_count,
        boxoffice_years: row.boxoffice_years,
        match_status: "unmatched",
        match_strategy: "none",
      });
      continue;
    }

    if (matchStrategy.startsWith("exact")) {
      exactMatchCount += 1;
    } else {
      nameOnlyMatchCount += 1;
    }

    masterRows.push({
      movie_id: metadata.movie_id,
      movie_name: row.movie_name,
      open_date: row.open_date,
      genre: metadata.genre,
      rating: metadata.rating,
      director: metadata.director,
      production_company: metadata.production_company,
      distributor_meta: metadata.distributor_meta,
      distributor_boxoffice: row.distributor_boxoffice,
      distributor_final: metadata.distributor_meta || row.distributor_boxoffice,
      rep_nation: row.rep_nation,
      nation: metadata.nation || row.nation,
      total_sales_amount: row.total_sales_amount,
      total_audience_count: row.total_audience_count,
      screen_count_peak: row.screen_count_peak,
      show_count_total: row.show_count_total,
      sales_share_peak: row.sales_share_peak,
      boxoffice_year_count: row.boxoffice_year_count,
      boxoffice_years: row.boxoffice_years,
      match_status: "matched",
      match_strategy: matchStrategy,
    });
  }

  return {
    masterRows,
    unmatchedRows,
    summary: {
      aggregated_movie_count: aggregatedRows.length,
      metadata_row_count: metadataRows.length,
      exact_match_count: exactMatchCount,
      name_only_match_count: nameOnlyMatchCount,
      unmatched_count: unmatchedRows.length,
      metadata_duplicate_exact_key_count: duplicateExactKeys.size,
    },
  };
}

function main() {
  ensureDir(PROCESSED_DIR);

  const boxofficeRows = buildBoxofficeRows();
  const aggregatedBoxofficeRows = buildAggregatedBoxofficeRows(boxofficeRows);
  const metadataRows = buildMetadataRows();
  const { masterRows, unmatchedRows, summary } = joinRows(
    aggregatedBoxofficeRows,
    metadataRows,
  );
  const filteredAggregatedBoxofficeRows = aggregatedBoxofficeRows.filter((row) =>
    isInAnalysisPeriod(row.open_date),
  );
  const filteredMasterRows = masterRows.filter((row) => isInAnalysisPeriod(row.open_date));
  const filteredUnmatchedRows = unmatchedRows.filter((row) => isInAnalysisPeriod(row.open_date));
  const finalSummary = {
    ...summary,
    analysis_period_start: String(ANALYSIS_OPEN_DATE_START),
    analysis_period_end: String(ANALYSIS_OPEN_DATE_END),
    aggregated_movie_count_in_analysis_period: filteredAggregatedBoxofficeRows.length,
    matched_count_in_analysis_period: filteredMasterRows.filter(
      (row) => row.match_status === "matched",
    ).length,
    unmatched_count_in_analysis_period: filteredUnmatchedRows.length,
  };

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_boxoffice_yearly_combined_2016_2025.csv"),
    boxofficeRows,
    [
      "boxoffice_year",
      "rank",
      "movie_name",
      "open_date",
      "sales_amount",
      "sales_share",
      "audience_count",
      "screen_count",
      "show_count",
      "rep_nation",
      "nation",
      "distributor_boxoffice",
      "match_key",
      "source_file",
    ],
  );

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_boxoffice_aggregated_2016_2025.csv"),
    aggregatedBoxofficeRows,
    [
      "movie_name",
      "open_date",
      "total_sales_amount",
      "total_audience_count",
      "screen_count_peak",
      "show_count_total",
      "sales_share_peak",
      "rep_nation",
      "nation",
      "distributor_boxoffice",
      "boxoffice_year_count",
      "boxoffice_years",
      "match_key",
    ],
  );

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_boxoffice_aggregated_release_2016_2025.csv"),
    filteredAggregatedBoxofficeRows,
    [
      "movie_name",
      "open_date",
      "total_sales_amount",
      "total_audience_count",
      "screen_count_peak",
      "show_count_total",
      "sales_share_peak",
      "rep_nation",
      "nation",
      "distributor_boxoffice",
      "boxoffice_year_count",
      "boxoffice_years",
      "match_key",
    ],
  );

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_metadata_2016_2025.csv"),
    metadataRows,
    [
      "movie_id",
      "movie_name",
      "open_date",
      "genre",
      "rating",
      "director",
      "production_company",
      "distributor_meta",
      "nation",
      "match_key",
      "name_only_key",
    ],
  );

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_master_boxoffice_scope_2016_2025.csv"),
    masterRows,
    [
      "movie_id",
      "movie_name",
      "open_date",
      "genre",
      "rating",
      "director",
      "production_company",
      "distributor_meta",
      "distributor_boxoffice",
      "distributor_final",
      "rep_nation",
      "nation",
      "total_sales_amount",
      "total_audience_count",
      "screen_count_peak",
      "show_count_total",
      "sales_share_peak",
      "boxoffice_year_count",
      "boxoffice_years",
      "match_status",
      "match_strategy",
    ],
  );

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_master_2016_2025.csv"),
    filteredMasterRows,
    [
      "movie_id",
      "movie_name",
      "open_date",
      "genre",
      "rating",
      "director",
      "production_company",
      "distributor_meta",
      "distributor_boxoffice",
      "distributor_final",
      "rep_nation",
      "nation",
      "total_sales_amount",
      "total_audience_count",
      "screen_count_peak",
      "show_count_total",
      "sales_share_peak",
      "boxoffice_year_count",
      "boxoffice_years",
      "match_status",
      "match_strategy",
    ],
  );

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_unmatched_movies_boxoffice_scope_2016_2025.csv"),
    unmatchedRows,
    ["movie_name", "open_date", "distributor_boxoffice", "boxoffice_years"],
  );

  writeCsv(
    path.join(PROCESSED_DIR, "kobis_unmatched_movies_2016_2025.csv"),
    filteredUnmatchedRows,
    ["movie_name", "open_date", "distributor_boxoffice", "boxoffice_years"],
  );

  fs.writeFileSync(
    path.join(PROCESSED_DIR, "kobis_processing_summary_2016_2025.json"),
    `${JSON.stringify(finalSummary, null, 2)}\n`,
    "utf8",
  );

  console.log(JSON.stringify(finalSummary, null, 2));
}

main();
