# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

```bash
npm start          # serve em http://localhost:8000 (http-server)
npm run smoke      # testa o grafo de módulos ES sem browser
```

`index.html` precisa de ser servido por HTTP — ES modules não carregam em `file://`.

## Architecture

No build, no bundler, no framework. HTML/CSS estáticos + **ES modules** nativos.

`index.html` = markup + CSS + `<script type="module" src="js/app.js">`. Todo o JS vive em `js/`:

| Módulo | Responsabilidade |
|---|---|
| `app.js` | ponto de entrada: constrói os separadores, primeiro `render`, regista o SW |
| `bridge.js` | põe os handlers inline no `window` — **ver aviso abaixo** |
| `state.js` | `ST` (localStorage `treino_v2`), `save()`, migrações, log de carga, séries feitas |
| `data.js` | `DAYS` — plano de treino (7 dias, exercícios hardcoded) |
| `ui.js` | `render(day)`, `buildCard`, `refreshCard`, `refreshProgress` |
| `loads.js` | UI de carga (kg × reps) e gráfico por exercício |
| `charts.js` | `chartSVG`, `MUSCLES`, `bodySVG` (mapa muscular frente/costas) |
| `progression.js` | `nextTarget` / `progHint` — sugestão de carga |
| `volume.js` | volume semanal planeado por grupo muscular |
| `timer.js` · `wake.js` · `notify.js` | descanso, ecrã ligado, notificações |
| `sliders.js` · `media.js` · `guide.js` | slider dos cartões, demos por URL, ficha técnica |
| `nutrition.js` | nutrição, diário de ingestão, scanner + Open Food Facts |
| `profile.js` | perfil, medidas, % gordura, macros |
| `workout.js` | modo de treino guiado |
| `backup.js` | ⚙ Definições, export/import JSON, exports CSV |

**Aviso crítico — `js/bridge.js`:** o HTML usa atributos `onclick="fn(...)"`. Em ES modules
nada é global, por isso todo o handler inline tem de estar no `Object.assign(window, {...})`
do `bridge.js`. Um handler em falta **falha em silêncio** (botão não faz nada, sem erro).
Se acrescentares um handler inline novo, acrescenta-o ao `bridge.js` e corre `npm run smoke`.

**Reatribuições em ESM:** um binding importado é imutável. `ST` e `REST_SEC` só podem ser
substituídos através de `setST()` (`state.js`) e `setRest()` (`timer.js`) — é o que o
`importBackup` faz.

**Testes:** `npm run smoke` avalia o grafo de módulos completo com um DOM mínimo, percorre
todos os ecrãs, dispara os handlers principais e confirma que cada import resolve e que
todos os handlers inline estão ligados ao `window`. Corre-o sempre antes de commit.

**Dados** (`data.js`): objeto por dia da semana (`"Segunda"`, `"Terça"`, …), cada valor um
array de `{ name, s, r, tip, alt }`. Caminhos de imagem são **relativos** (sem `/` inicial):
absolutos partem no subcaminho do GitHub Pages.

**Slider** (`sliders.js`): estado por `id` em `SL`; `slNext`/`slPrev`/`slTo` chamam `slSync`.
Swipe touch/rato ligado por slider depois do render, com limiar de 50px.

## Demonstrações de exercícios

Sem ficheiros de imagem no repo (a pasta `images/` foi removida). As demos vêm de CDN:
`DEMOS` em `js/media.js` mapeia nome de exercício → pasta do free-exercise-db, servido por
jsDelivr e guardado em cache pelo service worker (`sw.js`, cache-first para imagens de
qualquer origem). O utilizador pode ainda colar URLs próprios (`ST.media[exercício][]`).

## Adicionar ou mudar exercícios

Editar `DAYS` em `js/data.js`. Se o exercício for novo, acrescentar também:
- `MUSCLES` em `js/charts.js` (mapa muscular) — senão o cartão cai no fallback 💪
- `GUIDE` em `js/guide.js` (ficha técnica), opcional
- `DEMOS` em `js/media.js` (pasta do free-exercise-db), opcional

Correr `npm run smoke` no fim.

## Deployment

Push `main` para o GitHub → GitHub Pages faz deploy sozinho. Sem CI.

Ao acrescentar ou remover um ficheiro em `js/`, atualizar a lista `CORE` em `sw.js` **e**
subir a versão de `CACHE` (`treino-v3` → `v4`), senão os clientes ficam com o bundle antigo.
`scripts/build-www.mjs` copia `js/` e `data/` para o APK (Capacitor).
