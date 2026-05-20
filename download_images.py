"""
Download exercise images for myTraining.

Sources (priority order):
  1. wger.de        — free, no API key
  2. Pixabay        — free tier, requires free API key (see PIXABAY_KEY below)

Usage:
  pip install requests
  python download_images.py

  # Pixabay key (optional, better results):
  # Register free at https://pixabay.com/api/docs/ → copy API key
  # Set PIXABAY_KEY = "your_key_here" below
"""

import os
import time
import urllib.parse
from pathlib import Path

import requests

PIXABAY_KEY = ""   # optional — leave empty to skip Pixabay

# ─── EXERCISE MAP ─────────────────────────────────────────────────────────────
# key: (day_folder, filename_without_ext)
# val: [wger_search_term, pixabay_search_term]
EXERCISES: dict[tuple[str, str], list[str]] = {
    # Segunda — Peito & Tríceps
    ("segunda", "img1"):     ["bench press",            "barbell bench press gym"],
    ("segunda", "img2"):     ["bench press barbell",    "barbell chest press strength"],
    ("segunda", "img3"):     ["bench press barbell",    "chest workout powerlifting"],
    ("segunda", "img4"):     ["bench press",            "weightlifting chest press"],
    ("segunda", "imgsi1"):   ["incline bench press",    "incline bench press dumbbell"],
    ("segunda", "imgsi2"):   ["incline bench press",    "incline chest press gym"],
    ("segunda", "imgsi3"):   ["incline bench press",    "upper chest workout gym"],
    ("segunda", "imgcru1"):  ["dumbbell flyes",         "dumbbell chest fly gym"],
    ("segunda", "imgcru2"):  ["cable crossover",        "cable chest fly fitness"],
    ("segunda", "imgcru3"):  ["dumbbell flyes",         "pec fly exercise gym"],
    ("segunda", "imgpar1"):  ["dips",                   "parallel bar dips gym"],
    ("segunda", "imgpar2"):  ["dips",                   "chest dips triceps bodyweight"],
    ("segunda", "imgtric1"): ["triceps pushdown",       "cable triceps pushdown gym"],
    ("segunda", "imgtrit1"): ["skull crusher",          "skull crusher triceps barbell"],

    # Terça — Costas & Bíceps
    ("terca", "imgpux1"):   ["lat pulldown",            "lat pulldown machine gym"],
    ("terca", "imgrem1"):   ["barbell row",             "barbell bent over row back"],
    ("terca", "imgremu1"):  ["dumbbell row",            "single arm dumbbell row gym"],
    ("terca", "imgpull1"):  ["lat pulldown",            "cable pulldown back exercise"],
    ("terca", "imgrosc1"):  ["barbell curl",            "barbell bicep curl gym"],
    ("terca", "imgrosca1"): ["dumbbell curl",           "alternating dumbbell curl biceps"],

    # Quarta — Pernas
    ("quarta", "imgagac1"): ["barbell squat",           "barbell squat gym legs"],
    ("quarta", "imgagac2"): ["barbell squat",           "back squat powerlifting"],
    ("quarta", "imglegp1"): ["leg press",               "leg press machine gym"],
    ("quarta", "imgsti1"):  ["stiff-legged deadlift",   "romanian deadlift hamstrings"],
    ("quarta", "imgmesa1"): ["leg curl",                "hamstring curl machine gym"],
    ("quarta", "imgcade1"): ["leg extension",           "leg extension machine quadriceps"],
    ("quarta", "imgpantu1"):["calf raise",              "standing calf raise gym"],

    # Quinta — Ombros & Core
    ("quinta", "imgdes1"):  ["shoulder press",          "dumbbell shoulder press gym"],
    ("quinta", "imgelv1"):  ["lateral raise",           "lateral raise shoulders dumbbell"],
    ("quinta", "imgposto1"):["reverse flyes",           "reverse fly rear deltoid gym"],
    ("quinta", "imgface1"): ["face pull",               "cable face pull rope shoulders"],
    ("quinta", "imgpranc1"):["plank",                   "plank exercise core fitness"],
    ("quinta", "imgabd1"):  ["crunch",                  "ab crunch situp workout"],

    # Sexta — Full Body
    ("sexta", "imglevt1"):  ["deadlift",                "barbell deadlift gym strength"],
    ("sexta", "imgsup1"):   ["bench press",             "dumbbell bench press chest"],
    ("sexta", "imgpuxa1"):  ["lat pulldown",            "overhead pull back workout"],
    ("sexta", "imgagacg1"): ["goblet squat",            "goblet squat dumbbell legs"],
    ("sexta", "imgelvel1"): ["lateral raise",           "lateral raise shoulder gym"],
    ("sexta", "imgbra1"):   ["bicep curl",              "arm workout biceps triceps gym"],

    # Sábado — Cardio & Core
    ("sabado", "imgcard1"): ["running",                 "treadmill cardio gym running"],
    ("sabado", "imgcore1"): ["plank",                   "core exercise abs training"],

    # Domingo — Descanso Ativo
    ("domingo", "imgabd1"): ["stretching",              "stretching yoga mobility fitness"],
}

BASE_DIR   = Path(__file__).parent / "images"
WGER_BASE  = "https://wger.de/api/v2"
PIX_BASE   = "https://pixabay.com/api/"
HEADERS    = {"User-Agent": "myTraining-downloader/1.0"}


def download_file(url: str, dest: Path) -> bool:
    try:
        r = requests.get(url, timeout=15, stream=True, headers=HEADERS)
        if r.status_code == 200 and len(r.content) > 2000:
            dest.write_bytes(r.content)
            return True
    except Exception as e:
        print(f"    ✗ {e}")
    return False


def wger_image(search_term: str, dest: Path) -> bool:
    try:
        r = requests.get(f"{WGER_BASE}/exercise/",
                         params={"format": "json", "name": search_term, "language": 2},
                         timeout=10, headers=HEADERS)
        results = r.json().get("results", [])
        if not results:
            return False
        base_id = results[0].get("exercise_base") or results[0].get("id")
        if not base_id:
            return False

        r2 = requests.get(f"{WGER_BASE}/exerciseimage/",
                          params={"format": "json", "exercise_base": base_id},
                          timeout=10, headers=HEADERS)
        imgs = r2.json().get("results", [])
        if not imgs:
            return False
        url = imgs[0]["image"]
        if not url.startswith("http"):
            url = "https://wger.de" + url
        return download_file(url, dest)
    except Exception as e:
        print(f"    wger: {e}")
        return False


def pixabay_image(search_term: str, dest: Path) -> bool:
    if not PIXABAY_KEY:
        return False
    try:
        r = requests.get(PIX_BASE, params={
            "key": PIXABAY_KEY,
            "q": search_term,
            "image_type": "photo",
            "safesearch": "true",
            "per_page": 3,
            "orientation": "horizontal",
        }, timeout=10)
        hits = r.json().get("hits", [])
        if not hits:
            return False
        return download_file(hits[0]["webformatURL"], dest)
    except Exception as e:
        print(f"    pixabay: {e}")
        return False


def main() -> None:
    total = len(EXERCISES)
    success = 0
    failed: list[str] = []

    for idx, ((folder, fname), (wger_q, pix_q)) in enumerate(EXERCISES.items(), 1):
        dest_dir = BASE_DIR / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / f"{fname}.jpg"

        if dest.exists():
            print(f"[{idx:2}/{total}] {folder}/{fname}.jpg — skip (já existe)")
            success += 1
            continue

        print(f"[{idx:2}/{total}] {folder}/{fname}.jpg … ", end="", flush=True)

        if wger_image(wger_q, dest):
            print("✓ wger")
            success += 1
        elif pixabay_image(pix_q, dest):
            print("✓ pixabay")
            success += 1
        else:
            print("✗ falhou")
            failed.append(f"{folder}/{fname}.jpg  →  '{pix_q}'")

        time.sleep(0.5)

    print(f"\n{'─' * 52}")
    print(f"Total: {total}  |  OK: {success}  |  Falhas: {len(failed)}")

    if failed:
        print("\nDownload manual necessário (Unsplash / Google Images):")
        for f in failed:
            print(f"  • {f}")

    if not failed:
        print("\n✅ Concluído! Próximos passos:")
        print("   git add images/")
        print("   git commit -m 'feat: Add exercise images'")
        print("   git push")


if __name__ == "__main__":
    main()
