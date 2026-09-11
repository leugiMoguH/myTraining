# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running Locally

```bash
npm start          # serve em http://localhost:8000 (http-server)
npm run smoke        # testes rápidos, sem browser (~1s)
npm run test:browser # app real em Chromium headless: clica em tudo, falha em qualquer erro de consola
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
| `data.js` | `DEFAULT_DAYS` — plano original, só a **semente** da rotina |
| `routine.js` | `ST.routine`: a rotina editável. Exporta `DAYS` (Proxy) para os módulos antigos |
| `schedule.js` | `ST.sched`: treino atual, dias de descanso, reset semanal, trocas |
| `editor.js` | modo de edição de um dia: reordenar, apagar, séries/reps, descanso |
| `catalog-ui.js` | ecrã de pesquisa do catálogo (modo `add` e modo `swap`) |
| `catalog.js` | catálogo de 1324 exercícios: load lazy, pesquisa, filtros, URLs de media |
| `labels.js` | traduções PT da taxonomia EN + mapa músculo → id do `bodySVG` |
| `ui.js` | `render(alvo)`, ecrãs Hoje/Semana/dia, `buildCard`, `refreshCard` |
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

**Testes** (correr os dois antes de commit):
- `npm run smoke` — DOM mínimo, avalia o grafo de módulos, percorre os ecrãs, valida
  imports↔exports e a ponte dos handlers. ~1 segundo, sem browser.
- `npm run test:browser` — Chromium headless a 412px: serve o site, clica em separadores,
  séries, slider, ficha, treino guiado e definições, confirma que o progresso sobrevive ao
  reload, carrega o catálogo e verifica que o GIF do CDN responde. **Falha se aparecer um
  único erro na consola ou um pedido falhado.** Screenshots em `test-results/`.

**Dados:** `js/data.js` só guarda o plano original. O que a app lê é `ST.routine`
(`js/routine.js`), semeado a partir dele na primeira utilização. Cada dia é
`{ label, ex: [{ name, s, r, tip, alt, catalogId?, m?, mus? }] }`. Os três últimos campos
existem nos exercícios vindos do catálogo e guardam o GIF e os músculos na própria entrada,
para o cartão não ter de esperar pelo `catalog.json`.

**`ST.sets` / `ST.done` são indexados por `dia:índice`.** Qualquer alteração à ordem ou
remoção tem de passar por `setDayExercises()` (`routine.js`), que reindexa o progresso —
senão as séries marcadas saltam para o exercício errado.

**O nome do exercício é a chave do histórico** (`ST.log[name]`). Por isso o editor deixa
mudar séries, reps e a etiqueta do dia, mas nunca o nome. Trocar por outro exercício
(`replaceExercise`) é diferente de mudar o nome: é outro exercício, com outro histórico.

**Progressão (`js/progression.js`):** `evaluate(nome)` lê o histórico e diz o que fazer
a seguir. A configuração por exercício (esquema, salto de peso) está em `ST.prog[nome]` —
também indexada pelo nome. O 3.º argumento `prog` só existe para os testes poderem
injetar configurações sem tocar no estado. As sessões estagnadas são **contadas a partir
do log**, nunca guardadas: não há contador para ficar dessincronizado.

**Agenda (`js/schedule.js`):** o treino atual não é o dia da semana — é o **primeiro dia
ainda por fazer** (`currentDay()`). Um dia falhado fica pendente em vez de ser saltado.
Dias com `rest: true` (ou com "Descanso" na etiqueta) saem da fila. `ST.sched.week` é a
semana ISO; quando muda, `ensureWeek()` limpa `ST.sets`/`ST.done` e repõe as trocas
temporárias guardadas em `ST.sched.swaps`. `ST.log` nunca é tocado por nada disto.

**`ST.view` é o ecrã (`__hoje`, `__semana`, `__dia`, `__perfil`, `__nutri`); `ST.day` tem
de continuar a ser um dia real da rotina**, porque o progresso indexa por `dia:índice`.

Caminhos de ficheiros são **relativos** (sem `/` inicial): absolutos partem no subcaminho
do GitHub Pages.

**Slider** (`sliders.js`): estado por `id` em `SL`; `slNext`/`slPrev`/`slTo` chamam `slSync`.
Swipe touch/rato ligado por slider depois do render, com limiar de 50px.

## Catálogo de exercícios (exercises-dataset)

`data/catalog.json` (173 KB) e `data/instructions.en.json` (610 KB) são **gerados**, não
editados à mão: `node scripts/build-catalog.mjs` descarrega o dataset de 17,4 MB do jsDelivr
e escreve só o que a app precisa. O SHA do dataset está **fixado** no script — as URLs de
media derivam dele, por isso mudar de SHA invalida a cache das imagens.

O catálogo só é descarregado quando o utilizador abre a pesquisa; as instruções só ao abrir
uma ficha. Ambos ficam em cache pelo service worker.

**Idioma:** o dataset não tem português. As instruções são EN; a taxonomia (grupo,
equipamento, alvo) é traduzida por `js/labels.js`. Os 30 exercícios originais mantêm os
`tip`/`alt` PT escritos à mão em `js/data.js`.

**Licenças:** dataset `hasaneyldrm/exercises-dataset` é MIT; a media é **© Gym visual**
(gymvisual.com) e exige atribuição visível. `emilfunk/opengym` é AGPL v3 — serviu de
referência de funcionalidades, **nenhum código dele está neste repo**.

## Demonstrações de exercícios

Sem ficheiros de imagem no repo (a pasta `images/` foi removida). As demos vêm de CDN:
`DEMOS` em `js/media.js` mapeia nome de exercício → pasta do free-exercise-db, servido por
jsDelivr e guardado em cache pelo service worker (`sw.js`, cache-first para imagens de
qualquer origem). O utilizador pode ainda colar URLs próprios (`ST.media[exercício][]`).

## Adicionar ou mudar exercícios

Normalmente **não é preciso mexer no código**: ✎ Editar num dia → ＋ Adicionar exercício
do catálogo (1324 disponíveis, com GIF e instruções EN).

Para mudar o plano *original* (a semente), editar `DEFAULT_DAYS` em `js/data.js`. Se o
exercício for novo, acrescentar também:
- `MUSCLES` em `js/charts.js` (mapa muscular) — senão o cartão cai no fallback 💪
- `GUIDE` em `js/guide.js` (ficha técnica), opcional
- `DEMOS` em `js/media.js` (pasta do free-exercise-db), opcional

Correr `npm run smoke` no fim.

## Deployment

Push `main` para o GitHub → GitHub Pages faz deploy sozinho. Sem CI.

Ao acrescentar ou remover um ficheiro em `js/`, atualizar a lista `CORE` em `sw.js` **e**
subir a versão de `CACHE` (`treino-v3` → `v4`), senão os clientes ficam com o bundle antigo.
`scripts/build-www.mjs` copia `js/` e `data/` para o APK (Capacitor).
