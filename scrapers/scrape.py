import requests
import re
import time
import os
import psycopg2
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from dotenv import load_dotenv
from playwright.sync_api import sync_playwright

load_dotenv()
BASE = "https://www.boxofficemojo.com"

def get_conn():
    return psycopg2.connect(
        os.environ["DATABASE_URL"],
        connect_timeout=30,
        keepalives=1,
        keepalives_idle=30,
        keepalives_interval=10,
        keepalives_count=5
    )

def clean_money(raw):
    return int(re.sub(r"[^\d]", "", raw)) if raw and raw.strip() not in ("-", "") else None

def clean_int(raw):
    return int(re.sub(r"[^\d]", "", raw)) if raw and raw.strip() not in ("-", "") else None

def generate_weekend_urls(start_year=2015, end_year=2026):
    urls = []
    for year in range(start_year, end_year + 1):
        for week in range(1, 53):
            urls.append(f"{BASE}/weekend/{year}W{week:02d}/")
    return urls

def parse_weekend_date(url):
    match = re.search(r"(\d{4})W(\d{2})", url)
    if not match:
        return None
    year, week = int(match.group(1)), int(match.group(2))
    try:
        monday = datetime.strptime(f"{year}-W{week:02d}-1", "%G-W%V-%u").date()
        return monday - timedelta(days=3)
    except:
        return None

def scrape_weekend(page, url):
    page.goto(url)
    page.wait_for_load_state("networkidle")

    if not page.query_selector("table"):
        return []

    rows = page.eval_on_selector_all("table tr", """
        trs => trs.slice(1).map(tr => {
            const cols = tr.querySelectorAll('td');
            if (cols.length < 10) return null;
            return {
                title:       cols[2]?.innerText?.trim(),
                studio:      cols[10]?.innerText?.trim(),
                gross:       cols[3]?.innerText?.trim(),
                screens:     cols[5]?.innerText?.trim(),
                week_in_run: cols[9]?.innerText?.trim(),
            };
        }).filter(r => r && r.title)
    """)
    return rows

def upsert_film(cur, title, studio):
    cur.execute("""
        INSERT INTO films (title, studio)
        VALUES (%s, %s)
        ON CONFLICT (title) DO UPDATE SET studio = EXCLUDED.studio
        RETURNING id
    """, (title, studio))
    return cur.fetchone()[0]

def upsert_weekend(cur, date, total_gross):
    cur.execute("""
        INSERT INTO weekends (date, total_industry_gross)
        VALUES (%s, %s)
        ON CONFLICT (date) DO UPDATE SET total_industry_gross = EXCLUDED.total_industry_gross
        RETURNING id
    """, (date, total_gross))
    return cur.fetchone()[0]

def insert_entry(cur, film_id, weekend_id, gross, screens, week_in_run, market_share):
    cur.execute("""
        INSERT INTO weekend_entries (film_id, weekend_id, gross, screens, week_in_run, market_share)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (film_id, weekend_id) DO NOTHING
    """, (film_id, weekend_id, gross, screens, week_in_run, market_share))

def run():
    urls = generate_weekend_urls(2015, 2026)
    print(f"Generated {len(urls)} URLs to try")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        for i, url in enumerate(urls):
            date = parse_weekend_date(url)
            if not date:
                continue

            # check if already loaded
            try:
                conn = get_conn()
                cur = conn.cursor()
                cur.execute("SELECT id FROM weekends WHERE date = %s", (date,))
                exists = cur.fetchone()
                cur.close()
                conn.close()
            except Exception as e:
                print(f"  Checkpoint check failed for {date}: {e}")
                exists = False

            if exists:
                print(f"[{i+1}/{len(urls)}] {date} — already loaded, skipping")
                continue

            rows = scrape_weekend(page, url)
            if not rows:
                print(f"[{i+1}/{len(urls)}] {date} — no data, skipping")
                continue

            print(f"[{i+1}/{len(urls)}] {date} — {len(rows)} films")

            cleaned = []
            for r in rows:
                cleaned.append({
                    "title":       r["title"],
                    "studio":      r["studio"],
                    "gross":       clean_money(r["gross"]),
                    "screens":     clean_int(r["screens"]),
                    "week_in_run": clean_int(r["week_in_run"]),
                })

            total_gross = sum(r["gross"] for r in cleaned if r["gross"])
            if not total_gross:
                continue

            try:
                conn = get_conn()
                cur = conn.cursor()
                weekend_id = upsert_weekend(cur, date, total_gross)
                for r in cleaned:
                    film_id = upsert_film(cur, r["title"], r["studio"])
                    market_share = (r["gross"] / total_gross) if r["gross"] else None
                    insert_entry(cur, film_id, weekend_id, r["gross"], r["screens"], r["week_in_run"], market_share)
                conn.commit()
                print(f"  committed {len(cleaned)} entries")
            except Exception as e:
                print(f"  Error on {date}: {e}, skipping")
                conn.rollback()
            finally:
                cur.close()
                conn.close()

            time.sleep(0.5)

        browser.close()

    print("Done.")

if __name__ == "__main__":
    run()