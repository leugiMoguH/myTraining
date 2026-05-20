# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

```bash
npm start          # serves on http://localhost:8000 via http-server
# or simply open index.html directly in a browser — no build step needed
```

No build, no bundler, no framework. Pure static HTML/CSS/JS.

## Architecture

Everything lives in a single `index.html` file — CSS in `<style>`, data and logic in `<script>`, markup rendered dynamically.

**Data layer** (`data` object, ~line 321): a plain JS object keyed by weekday (`"Segunda"`, `"Terça"`, …). Each value is an array of exercise objects:
```js
{ name: string, series: number|"-", reps: string, images: string[] }
```
Image paths are relative to the server root: `/images/<day>/<filename>.jpg`.

**Rendering** (`render(day, el)`): wipes `#content`, loops over the day's exercises, injects HTML cards with image sliders. Slider state (`currentIndex`, `touchStartX`, `touchEndX`) is keyed by exercise index within the current day — indices reset on every tab switch.

**Slider controls**: `next(exIdx)`, `prev(exIdx)`, `goToSlide(exIdx, slideIdx)` call `update(exIdx)` which moves the CSS transform and syncs dot indicators + counter.

**Touch/mouse swipe**: attached per slider after render, using a 50px threshold.

## Images

Stored under `images/<day>/` (e.g. `images/segunda/img1.jpg`). Image paths are hardcoded in the `data` object. Helper scripts in repo root (`download_images.py`, `auto_download_final.py`, etc.) assist with bulk downloading exercise images.

## Adding or Changing Exercises

Edit only the `data` object in `index.html`. Add image files to the matching `images/<day>/` folder and reference them in the `images` array for that exercise.

## Deployment

Push `main` to GitHub → GitHub Pages auto-deploys. No CI needed.
