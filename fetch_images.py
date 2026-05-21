"""
fetch_images.py — exercise image downloader for myTraining
Source: musclewiki.com (high-quality exercise photos, no API key needed)

Usage:
    pip install requests
    python fetch_images.py

Downloads up to MAX_PER_EXERCISE images per exercise (male + female views).
After running, update the imgs[] arrays in index.html to reference the new files.
"""

import re
import sys
import time
import requests
from pathlib import Path
from typing import NamedTuple

sys.stdout.reconfigure(encoding="utf-8")

MAX_PER_EXERCISE = 4  # target images per exercise (3-6 ideal)


class Exercise(NamedTuple):
    day: str
    prefix: str   # filename prefix, e.g. "imgtric" → imgtric1.jpg, imgtric2.jpg…
    slug: str     # musclewiki.com/exercise/{slug}


EXERCISES: list[Exercise] = [
    # segunda — Peito & Tríceps
    Exercise("segunda", "img",     "bench-press"),
    Exercise("segunda", "imgsi",   "barbell-incline-bench-press"),
    Exercise("segunda", "imgcru",  "dumbbell-chest-fly"),
    Exercise("segunda", "imgpar",  "dips"),
    Exercise("segunda", "imgtric", "cable-rope-pushdown"),
    Exercise("segunda", "imgtrit", "skull-crusher"),
    # terca — Costas & Bíceps
    Exercise("terca",   "imgpux",  "machine-pulldown"),
    Exercise("terca",   "imgrem",  "barbell-bent-over-row"),
    Exercise("terca",   "imgremu", "dumbbell-single-arm-row"),
    Exercise("terca",   "imgpull", "machine-pulldown"),
    Exercise("terca",   "imgrosc", "barbell-curl"),
    Exercise("terca",   "imgrosca","dumbbell-curl"),
    # quarta — Pernas
    Exercise("quarta",  "imgagac", "barbell-squat"),
    Exercise("quarta",  "imglegp", "machine-leg-press"),
    Exercise("quarta",  "imgsti",  "romanian-deadlift"),
    Exercise("quarta",  "imgmesa", "seated-leg-curl"),
    Exercise("quarta",  "imgcade", "machine-leg-extension"),
    Exercise("quarta",  "imgpantu","standing-calf-raise"),
    # quinta — Ombros & Core
    Exercise("quinta",  "imgdes",  "overhead-press"),
    Exercise("quinta",  "imgelv",  "lateral-raise"),
    Exercise("quinta",  "imgposto","rear-delt-fly"),
    Exercise("quinta",  "imgface", "face-pull"),
    Exercise("quinta",  "imgpranc","plank"),
    Exercise("quinta",  "imgabd",  "crunch"),
    # sexta — Full Body
    Exercise("sexta",   "imglevt", "barbell-deadlift"),
    Exercise("sexta",   "imgsup",  "dumbbell-bench-press"),
    Exercise("sexta",   "imgpuxa", "machine-pulldown"),
    Exercise("sexta",   "imgagacg","dumbbell-goblet-squat"),
    Exercise("sexta",   "imgelvel","lateral-raise"),
    Exercise("sexta",   "imgbra",  "barbell-curl"),
    # sabado — Cardio & Core
    Exercise("sabado",  "imgcard", "jump-rope"),
    Exercise("sabado",  "imgcore", "plank"),
    # domingo — Descanso Ativo
    Exercise("domingo", "imgabd",  "downward-dog"),
]

BASE = Path(__file__).parent / "images"
MW   = "https://musclewiki.com"
HDR  = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "RSC": "1",
}


def get_all_image_urls(slug: str, max_n: int = MAX_PER_EXERCISE) -> list[str]:
    """Fetch musclewiki exercise page and extract up to max_n photo URLs."""
    url = f"{MW}/exercise/{slug}"
    try:
        r = requests.get(url, headers={**HDR, "Next-Url": f"/exercise/{slug}"}, timeout=15)
        if r.status_code != 200:
            return []
        text = r.text.encode("ascii", errors="replace").decode("ascii")
        candidates = [
            u for u in re.findall(
                r"https://media[.]musclewiki[.]com/media/uploads/og-(?:male|female)-[a-zA-Z0-9/_.-]+",
                text,
            )
            if "bodymap" not in u and u.endswith(".jpg")
        ]
        return list(dict.fromkeys(candidates))[:max_n]
    except Exception:
        return []


def download(url: str, dest: Path) -> bool:
    try:
        r = requests.get(url, timeout=20, stream=True,
                         headers={"User-Agent": HDR["User-Agent"]})
        if r.status_code == 200 and len(r.content) > 2000:
            dest.write_bytes(r.content)
            return True
    except Exception:
        pass
    return False


def main() -> None:
    total_ex = len(EXERCISES)
    ok = 0
    failed: list[tuple[str, str]] = []

    for i, ex in enumerate(EXERCISES, 1):
        folder = BASE / ex.day
        folder.mkdir(parents=True, exist_ok=True)

        print(f"[{i:2}/{total_ex}] {ex.day}/{ex.prefix}* ({ex.slug}) … ", end="", flush=True)

        # Check how many already exist
        existing = sorted(folder.glob(f"{ex.prefix}*.jpg"))
        if len(existing) >= MAX_PER_EXERCISE:
            print(f"skip ({len(existing)} files exist)")
            ok += 1
            continue

        urls = get_all_image_urls(ex.slug)
        time.sleep(0.4)

        if not urls:
            print("FAIL (no URLs found)")
            failed.append((ex.day, ex.prefix))
            continue

        # Determine starting index (skip files that already exist)
        existing_nums = set()
        for f in existing:
            m = re.search(r"(\d+)\.jpg$", f.name)
            if m:
                existing_nums.add(int(m.group(1)))

        downloaded = 0
        for j, url in enumerate(urls, 1):
            if j in existing_nums:
                continue
            dest = folder / f"{ex.prefix}{j}.jpg"
            if dest.exists():
                continue
            if download(url, dest):
                downloaded += 1

        total_now = len(list(folder.glob(f"{ex.prefix}*.jpg")))
        print(f"OK ({total_now} files)")
        ok += 1

    print(f"\n{'-'*60}")
    print(f"Exercises {total_ex}  OK {ok}  Failed {len(failed)}")

    if failed:
        print("\nFailed:")
        for day, prefix in failed:
            print(f"  {day}/{prefix}*.jpg")

    print("\nNext steps:")
    print("  python update_imgs.py   ← (optional) auto-update imgs[] in index.html")
    print("  git add images/")
    print("  git commit -m 'feat: add exercise images'")
    print("  git push")


if __name__ == "__main__":
    main()
