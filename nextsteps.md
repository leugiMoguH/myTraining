Good - gap: 12px on .card-body handles spacing automatically. Everything looks correct.

Summary of changes:

Timer — default changed 90s → 60s. Header now has − and + buttons (±15s steps, range 15–300s). Value persists in localStorage. All timer triggers (set button, card button, header button) use the stored value.

Alternativas — every exercise has an alt field, rendered as a blue-tinted text block below the tip.

Imagens no live site — two fixes:

Added .nojekyll (prevents Jekyll from interfering with static files)
Re-added .github/workflows/pages.yml — the workflow was removed in commit f6fa5ab, which broke GitHub Pages deployment. After pushing this, go to GitHub repo → Settings → Pages and set source to "GitHub Actions"
Mais imagens — fetch_images.py rewritten to download up to 4 images per exercise (male + female angles) instead of 1. Run:


pip install requests
python fetch_images.py
After running, the new files (imgtric2.jpg, imgtric3.jpg, etc.) will exist in images/. Then update the imgs[] arrays in index.html to reference them, and push.