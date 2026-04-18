#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = PROJECT_ROOT / "data" / "분석데이터" / "미국일반극장영화_IMDb보강_분석데이터_2016_2025.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data" / "분석데이터" / "미국일반극장영화_IMDbTMDb보강_분석데이터_2016_2025.csv"
DEFAULT_REPORT = PROJECT_ROOT / "data" / "수집자료" / "미국일반극장영화_TMDb보강리포트_2016_2025.json"
DEFAULT_CACHE = PROJECT_ROOT / "data" / "수집자료" / "미국일반극장영화_TMDb보강캐시_2016_2025.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Enrich overseas US dataset with TMDB data.")
    parser.add_argument(
        "--input-csv",
        default=str(DEFAULT_INPUT),
        help="Path to imdb-enriched analysis CSV.",
    )
    parser.add_argument(
        "--output-csv",
        default=str(DEFAULT_OUTPUT),
        help="Path for final enriched output CSV.",
    )
    parser.add_argument(
        "--report-json",
        default=str(DEFAULT_REPORT),
        help="Path for enrichment report JSON.",
    )
    parser.add_argument(
        "--cache-json",
        default=str(DEFAULT_CACHE),
        help="Optional cache file to persist TMDB lookup results.",
    )
    parser.add_argument(
        "--api-key",
        required=False,
        help="TMDB API key (v3).",
    )
    parser.add_argument(
        "--access-token",
        required=False,
        help="TMDB Access Token (Bearer). Use this if API key is not available.",
    )
    parser.add_argument("--workers", type=int, default=6, help="Worker threads for TMDB requests.")
    parser.add_argument("--max-retries", type=int, default=5, help="Max request retries.")
    parser.add_argument("--request-delay-ms", type=int, default=50, help="Delay between requests per worker (ms).")
    parser.add_argument("--request-timeout", type=int, default=20, help="Request timeout seconds.")
    parser.add_argument("--resume", action="store_true", help="Reuse existing cache file if present.")
    return parser.parse_args()


NULL_TOKENS = {"", "\\N", "N/A", "NA", "null", None}


def is_null(value: str | None) -> bool:
    return value is None or str(value).strip() in NULL_TOKENS


class TmdbClient:
    BASE_URL = "https://api.themoviedb.org/3"

    def __init__(self, api_key: str | None, access_token: str | None, max_retries: int, timeout: int, delay_ms: int):
        self.api_key = api_key.strip() if api_key else None
        self.access_token = access_token.strip() if access_token else None
        self.max_retries = max(1, max_retries)
        self.timeout = timeout
        self.delay_sec = max(0.0, delay_ms / 1000.0)
        self._opener = urllib.request.build_opener()
        self._ssl_context = ssl.create_default_context()

    def _build_url(self, path: str, params: dict[str, Any] | None = None) -> str:
        full_url = f"{self.BASE_URL}/{path.lstrip('/')}"
        query = {}
        if params:
            query.update(params)
        if self.api_key and "api_key" not in query:
            query["api_key"] = self.api_key
        if not query and not self.access_token:
            return full_url
        if query:
            return f"{full_url}?{urllib.parse.urlencode(query)}"
        return full_url

    def _auth_headers(self) -> dict[str, str]:
        if self.access_token:
            return {"Authorization": f"Bearer {self.access_token}"}
        return {}

    def get(self, path: str, params: dict[str, Any] | None = None, label: str = "") -> dict[str, Any] | None:
        last_error = None
        wait = 1.0
        url = self._build_url(path, params)

        for attempt in range(1, self.max_retries + 1):
            try:
                request = urllib.request.Request(url, headers=self._auth_headers())
                with urllib.request.urlopen(request, timeout=self.timeout, context=self._ssl_context) as response:
                    if response.status == 204:
                        return None
                    body = response.read().decode("utf-8")
                    return json.loads(body)
            except urllib.error.HTTPError as exc:
                last_error = exc
                if exc.code == 429:
                    retry_after = exc.headers.get("Retry-After") if hasattr(exc, "headers") else None
                    sleep_seconds = int(retry_after) if retry_after and retry_after.isdigit() else wait
                    time.sleep(sleep_seconds)
                elif 500 <= exc.code < 600:
                    time.sleep(wait)
                else:
                    if exc.code == 401:
                        raise RuntimeError(
                            f"TMDB 401 Unauthorized on {label}. Check API key/access token."
                        ) from exc
                    if exc.code == 404:
                        return None
                    if attempt >= self.max_retries:
                        break
                    time.sleep(wait)
                wait = min(wait * 2, 10.0)
            except (urllib.error.URLError, TimeoutError) as exc:
                last_error = exc
                if attempt >= self.max_retries:
                    break
                time.sleep(wait)
                wait = min(wait * 2, 10.0)
            except json.JSONDecodeError as exc:
                raise RuntimeError(f"Invalid JSON response from TMDB on {label}") from exc
            finally:
                if self.delay_sec > 0:
                    time.sleep(self.delay_sec)
        if last_error is not None and isinstance(last_error, urllib.error.HTTPError):
            return None
        raise RuntimeError(f"Failed TMDB request {label} after {self.max_retries} retries")

    def lookup(self, imdb_id: str) -> dict[str, str]:
        result: dict[str, str] = {
            "imdb_id": imdb_id,
            "tmdb_movie_id": "",
            "tmdb_original_language": "",
            "tmdb_production_companies": "",
            "tmdb_production_countries": "",
            "tmdb_us_rating": "",
        }

        find_payload = self.get("find/" + imdb_id, {"external_source": "imdb_id"}, label=f"find:{imdb_id}")
        if not find_payload:
            return result

        movie_matches = find_payload.get("movie_results") or []
        if not movie_matches:
            return result

        movie_matches.sort(
            key=lambda x: (
                x.get("vote_count") or 0,
                x.get("popularity") or 0,
                x.get("release_date") or "",
            ),
            reverse=True,
        )
        tmdb_id = movie_matches[0].get("id")
        if not tmdb_id:
            return result

        movie_payload = self.get(
            f"movie/{tmdb_id}",
            {"append_to_response": "release_dates"},
            label=f"movie:{tmdb_id}",
        )
        if not movie_payload:
            return result

        result["tmdb_movie_id"] = str(tmdb_id)
        result["tmdb_original_language"] = str(movie_payload.get("original_language") or "")

        companies = movie_payload.get("production_companies") or []
        if isinstance(companies, list):
            names = [item.get("name", "") for item in companies if item.get("name")]
            result["tmdb_production_companies"] = "|".join([n for n in names if n])

        countries = movie_payload.get("production_countries") or []
        if isinstance(countries, list):
            names = [item.get("name", "") for item in countries if item.get("name")]
            result["tmdb_production_countries"] = "|".join([n for n in names if n])

        release_data = movie_payload.get("release_dates") or {}
        results = release_data.get("results") if isinstance(release_data, dict) else None
        if isinstance(results, list):
            us_entries = [r for r in results if r.get("iso_3166_1") == "US"]
            if us_entries:
                all_dates = us_entries[0].get("release_dates") if isinstance(us_entries[0].get("release_dates"), list) else []
                if isinstance(all_dates, list) and all_dates:
                    by_date = sorted(
                        all_dates,
                        key=lambda x: x.get("release_date") or "",
                        reverse=True,
                    )
                    for candidate in by_date:
                        cert = (candidate.get("certification") or "").strip()
                        if cert:
                            result["tmdb_us_rating"] = cert
                            break
        return result


def load_rows(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as fp:
        reader = csv.DictReader(fp)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])
    return rows, fieldnames


def load_cache(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as fp:
        data = json.load(fp)
    if isinstance(data, dict):
        return {k: v for k, v in data.items() if isinstance(v, dict)}
    return {}


def enrich(path: Path, output_path: Path, report_path: Path, cache_path: Path, client: TmdbClient, workers: int, resume: bool):
    rows, fieldnames = load_rows(path)
    unique_ids: list[str] = []
    seen = set()
    for row in rows:
        imdb_id = (row.get("imdb_title_id") or "").strip()
        if imdb_id and imdb_id not in seen:
            seen.add(imdb_id)
            unique_ids.append(imdb_id)

    cache = load_cache(cache_path) if resume else {}

    remaining = [imdb_id for imdb_id in unique_ids if imdb_id not in cache]
    print(f"input_rows={len(rows)} unique_imdb_ids={len(unique_ids)}")
    print(f"cache_hits={len(unique_ids) - len(remaining)} remaining={len(remaining)}")

    if remaining:
        results: dict[str, dict[str, str]] = {}
        for imdb_id, payload in cache.items():
            if imdb_id in unique_ids:
                results[imdb_id] = payload

        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            future_to_id = {
                executor.submit(client.lookup, imdb_id): imdb_id for imdb_id in remaining
            }
            for i, future in enumerate(as_completed(future_to_id), 1):
                imdb_id = future_to_id[future]
                try:
                    payload = future.result()
                except Exception as exc:
                    payload = {
                        "imdb_id": imdb_id,
                        "tmdb_movie_id": "",
                        "tmdb_original_language": "",
                        "tmdb_production_companies": "",
                        "tmdb_production_countries": "",
                        "tmdb_us_rating": "",
                    }
                    print(f"warn imdb_id={imdb_id} error={exc}")
                results[imdb_id] = payload
                if i % 200 == 0:
                    print(f"progress={i}/{len(remaining)} ({(i / len(remaining)) * 100:.1f}%)")

        cache.update(results)
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        results = cache

    extra_columns = [
        "tmdb_movie_id",
        "tmdb_original_language",
        "tmdb_production_companies",
        "tmdb_production_countries",
        "tmdb_us_rating",
    ]
    output_fieldnames = fieldnames + extra_columns

    stats = {
        "tmdb_movie_id": 0,
        "tmdb_original_language": 0,
        "tmdb_production_companies": 0,
        "tmdb_production_countries": 0,
        "tmdb_us_rating": 0,
    }

    for row in rows:
        imdb_id = (row.get("imdb_title_id") or "").strip()
        payload = results.get(imdb_id, {})
        for col in extra_columns:
            row[col] = payload.get(col, "")
            if not is_null(row[col]):
                stats[col] += 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=output_fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "input_csv": str(path),
        "output_csv": str(output_path),
        "cache_json": str(cache_path),
        "input_rows": len(rows),
        "input_unique_imdb_ids": len(unique_ids),
        "cache_hit_count": sum(1 for imdb_id in unique_ids if imdb_id in cache),
        "tmdb_query_count": len(unique_ids),
        "workers": workers,
        "coverage": {k: v for k, v in stats.items()},
    }
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        "tmdb_movie_id="
        f"{stats['tmdb_movie_id']} tmdb_original_language="
        f"{stats['tmdb_original_language']} production_companies="
        f"{stats['tmdb_production_companies']} production_countries="
        f"{stats['tmdb_production_countries']} us_rating={stats['tmdb_us_rating']}"
    )
    print(f"output={output_path}")
    print(f"report={report_path}")


def main():
    args = parse_args()

    input_path = Path(args.input_csv)
    output_path = Path(args.output_csv)
    report_path = Path(args.report_json)
    cache_path = Path(args.cache_json)

    if not args.api_key and not args.access_token:
        raise RuntimeError("Either --api-key or --access-token is required.")

    if args.workers < 1:
        raise ValueError("--workers must be >= 1")

    client = TmdbClient(
        api_key=args.api_key,
        access_token=args.access_token,
        max_retries=args.max_retries,
        timeout=args.request_timeout,
        delay_ms=args.request_delay_ms,
    )

    enrich(
        path=input_path,
        output_path=output_path,
        report_path=report_path,
        cache_path=cache_path,
        client=client,
        workers=args.workers,
        resume=args.resume,
    )


if __name__ == "__main__":
    main()

