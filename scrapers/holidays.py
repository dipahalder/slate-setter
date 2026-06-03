# run once against neon
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

HOLIDAYS = {
    1:  "New Year's",
    7:  "Valentine's Day",
    14: "Easter",       # approximate — Easter moves, but ISO week 14-16
    20: "Memorial Day",
    27: "July 4th",
    45: "Halloween",
    47: "Veterans Day",
    48: "Thanksgiving",
    52: "Christmas",
}

conn = psycopg2.connect(os.environ["DATABASE_URL"])
cur = conn.cursor()

for week, name in HOLIDAYS.items():
    cur.execute("""
        UPDATE weekends
        SET holiday_flag = TRUE,
            holiday_name = %s
        WHERE EXTRACT(WEEK FROM date) = %s
    """, (name, week))
    print(f"Tagged week {week} as {name}")

conn.commit()
cur.close()
conn.close()
print("Done.")