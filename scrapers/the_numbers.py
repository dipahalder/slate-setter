import requests
from bs4 import BeautifulSoup
import psycopg2
import os
import re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

def scrape_year(year):
    r = requests.get(
        f"https://www.the-numbers.com/movies/release-schedule/{year}",
        headers=headers
    )
    soup = BeautifulSoup(r.text, "html.parser")
    table = soup.find("table")
    if not table:
        return []

    releases = []
    current_date = None

    for row in table.find_all("tr"):
        cols = row.find_all("td")
        if not cols:
            continue

        text = cols[0].get_text(strip=True)

        # month header row e.g. "January 2023" — skip
        if re.match(r"^[A-Za-z]+ \d{4}$", text):
            continue

        # date row e.g. "January 4"
        if re.match(r"^[A-Za-z]+ \d{1,2}$", text):
            try:
                current_date = datetime.strptime(f"{text} {year}", "%B %d %Y").date()
            except:
                pass
            # title might be in same row
            if len(cols) >= 2 and cols[1].get_text(strip=True):
                raw_title = cols[1].get_text(strip=True)
                distributor = cols[2].get_text(strip=True) if len(cols) > 2 else None
                is_wide = "(Wide)" in raw_title
                title = re.sub(r"\s*\(.*?\)\s*$", "", raw_title).strip()
                if current_date and title:
                    releases.append({
                        "title": title,
                        "release_date": current_date,
                        "is_wide": is_wide,
                        "distributor": distributor,
                    })
            continue

        # continuation row — first col is empty, title in col[1]
        if text == "" and len(cols) >= 2:
            raw_title = cols[1].get_text(strip=True)
            if not raw_title or not current_date:
                continue
            distributor = cols[2].get_text(strip=True) if len(cols) > 2 else None
            is_wide = "(Wide)" in raw_title
            title = re.sub(r"\s*\(.*?\)\s*$", "", raw_title).strip()
            if title:
                releases.append({
                    "title": title,
                    "release_date": current_date,
                    "is_wide": is_wide,
                    "distributor": distributor,
                })

    return releases

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def load_releases(releases):
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        ALTER TABLE films
        ADD COLUMN IF NOT EXISTS release_date DATE,
        ADD COLUMN IF NOT EXISTS is_wide BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS distributor TEXT
    """)
    conn.commit()

    matched = 0
    unmatched = 0

    for r in releases:
        if not r["is_wide"]:
            continue

        cur.execute("""
            UPDATE films
            SET release_date = %s,
                is_wide = TRUE,
                distributor = %s
            WHERE LOWER(title) = LOWER(%s)
            RETURNING id
        """, (r["release_date"], r["distributor"], r["title"]))

        if cur.fetchone():
            matched += 1
        else:
            cur.execute("""
                INSERT INTO films (title, release_date, is_wide, distributor)
                VALUES (%s, %s, TRUE, %s)
                ON CONFLICT (title) DO UPDATE
                SET release_date = EXCLUDED.release_date,
                    is_wide = TRUE,
                    distributor = EXCLUDED.distributor
            """, (r["title"], r["release_date"], r["distributor"]))
            unmatched += 1

    conn.commit()
    cur.close()
    conn.close()
    return matched, unmatched

def run():
    all_releases = []
    for year in range(2015, 2027):
        print(f"Scraping {year}...")
        releases = scrape_year(year)
        wide = [r for r in releases if r["is_wide"]]
        print(f"  {len(releases)} total, {len(wide)} wide releases")
        all_releases.extend(releases)

    wide_only = [r for r in all_releases if r["is_wide"]]
    print(f"\nLoading {len(wide_only)} wide releases to DB...")
    matched, unmatched = load_releases(all_releases)
    print(f"  Matched to existing films: {matched}")
    print(f"  New films inserted: {unmatched}")
    print("Done.")

if __name__ == "__main__":
    run()