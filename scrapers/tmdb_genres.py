import requests
import psycopg2
import os
import time
from dotenv import load_dotenv

load_dotenv()

TMDB_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI4NWY2YTFiYzA0ZjBmN2FiYzMwNGY0MTVkNTdiMjRlMiIsIm5iZiI6MTc4MDQ5NTQ3Ni45OTUwMDAxLCJzdWIiOiI2YTIwMzQ3NDFjYmFmZmI4NTA2ZTU5ZTMiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.1_nEFkYZlT5lLpWdIVh78a_Of8wzPAEyvidBlqS8oqQ"
TMDB_BASE = "https://api.themoviedb.org/3"

GENRE_ID_MAP = {
    28:    "Action",
    12:    "Adventure",
    16:    "Animation",
    35:    "Comedy",
    80:    "Crime",
    99:    "Documentary",
    18:    "Drama",
    10751: "Family",
    14:    "Fantasy",
    36:    "History",
    27:    "Horror",
    10402: "Music",
    9648:  "Mystery",
    10749: "Romance",
    878:   "Sci-Fi",
    10770: "TV Movie",
    53:    "Thriller",
    10752: "War",
    37:    "Western",
}

def search_tmdb(title, year=None):
    headers = {
        "Authorization": f"Bearer {TMDB_TOKEN}",
        "accept": "application/json"
    }
    params = {
        "query": title,
        "language": "en-US",
        "page": 1,
    }
    if year:
        params["primary_release_year"] = year

    r = requests.get(
        f"{TMDB_BASE}/search/movie",
        headers=headers,
        params=params
    )

    if r.status_code != 200:
        print(f"  API error {r.status_code}: {r.text[:100]}")
        return None

    results = r.json().get("results", [])
    if not results:
        return None

    return results[0]

def get_genres(genre_ids):
    return [GENRE_ID_MAP[gid] for gid in genre_ids if gid in GENRE_ID_MAP]

def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])

def run():
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        ALTER TABLE films
        ADD COLUMN IF NOT EXISTS genre TEXT[]
    """)
    conn.commit()

    cur.execute("""
        SELECT id, title, release_date
        FROM films
        WHERE genre IS NULL OR genre = '{}'
        ORDER BY title
    """)
    films = cur.fetchall()
    print(f"Found {len(films)} films to tag")

    matched = 0
    unmatched = 0

    for i, (film_id, title, release_date) in enumerate(films):
        year = release_date.year if release_date else None

        clean_title = title.replace(" 2019 Re-release", "").replace(" 2020 Re-release", "")
        clean_title = clean_title.replace(" 2021 Re-release", "").replace(" 2022 Re-release", "")
        clean_title = clean_title.split("\n")[0].strip()

        result = search_tmdb(clean_title, year)

        if result and result.get("genre_ids"):
            genres = get_genres(result["genre_ids"])
            if genres:
                cur.execute("UPDATE films SET genre = %s WHERE id = %s", (genres, film_id))
                matched += 1
                print(f"[{i+1}/{len(films)}] {title} → {genres}")
            else:
                unmatched += 1
                print(f"[{i+1}/{len(films)}] {title} → no genres returned")
        else:
            # retry without year
            result = search_tmdb(clean_title)
            if result and result.get("genre_ids"):
                genres = get_genres(result["genre_ids"])
                cur.execute("UPDATE films SET genre = %s WHERE id = %s", (genres, film_id))
                matched += 1
                print(f"[{i+1}/{len(films)}] {title} → {genres} (retry)")
            else:
                unmatched += 1
                print(f"[{i+1}/{len(films)}] {title} → no match")

        if i % 50 == 0:
            conn.commit()

        time.sleep(0.26)

    conn.commit()
    cur.close()
    conn.close()
    print(f"\nDone. Matched: {matched}, Unmatched: {unmatched}")

if __name__ == "__main__":
    run()