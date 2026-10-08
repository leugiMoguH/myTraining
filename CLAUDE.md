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
| `custom.js` · `suggest.js` | treino personalizado de um dia (`ST.custom`, dia `Personalizado`): ecrãs + estado · sugestão pura por grupo muscular |
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
| `workout.js` | treino guiado: série num toque, desfazer, pausa; `openWorkout` retoma uma sessão |
| `session.js` | `ST.session`: máquina de estados do treino (NOT_STARTED/ACTIVE/PAUSED/COMPLETED/ABANDONED), tempo por timestamps, `reconcileSession` |
| `nav.js` | barra inferior (Início · Evolução · **Treino** · Histórico · Opções; a Semana vive dentro do Histórico, ecrã `__hist`) e faixa "treino em curso" |
| `backup.js` | ⚙ Definições, export/import JSON, exports CSV |

**Sessão de treino (`js/session.js`):** só o utilizador muda o estado — nada fecha, pausa ou descarta uma sessão sozinho (fechar a app, mudar de dia/semana/plano só a **preserva**). Terminadas ficam em `ST.workouts`. O botão central só controla a sessão, nunca o descanso (`timer.js`, persistido em `localStorage.rest_timer` como fim absoluto). A sessão do personalizado só acaba quando o utilizador conclui/descarta o personalizado (`endSessionOf`; o personalizado não caduca enquanto ela viver).

**Tempo (sem limiares escondidos):** `decorrido` (relógio) − `pausado` (pausas pedidas) = `duração` (medida, é o relógio mostrado). `confirmado` = tempo ACTIVE com a app visível e a dar sinal (batimento de 15 s, séries; ≤30 s por sinal, nunca o intervalo escondido/fechado) — é um mínimo medido. `sem registo` = duração − confirmado, derivado e mostrado à parte. `IDLE_HINT_MS` (30 min) só AVISA ("Sem atividade há…") e liga a faixa com ✓ *encerrar à hora da última atividade* e ✕ *descartar*; não altera dados. Sem sinal recente a sessão não reabre sozinha: a faixa oferece abrir/encerrar/descartar.

**Data e semana:** a sessão fixa a data civil de **início** (`date`) e a semana (`wk`): as cargas feitas durante ela (`logDate(dia)`) ficam nessa data, numa só entrada de `ST.log`, mesmo depois da meia-noite; cada série leva `sid`. `ensureWeek` guarda marcas e trocas do dia da sessão viva; saem quando ela termina (`clearDayMarks`). Sessão cujo dia o plano já não mostra: a faixa oferece encerrar/descartar com confirmação.

**`ST.log[nome]` — uma entrada por dia**: `{date, ts, w, r, sets?:[{w,r,ts,k?}]}`. `w/r` = série representativa, **sempre uma série realmente executada**: a de maior peso e, nesse peso, a de **menos** reps (leitura conservadora, igual à antiga "última série"). `sets[].k` (`dia:série`) e `sets[].sid` ligam a carga à marca em `ST.sets`; `toggleSet` ao desmarcar retira essa carga. `logSet` (botão Registar) corrige a última série do dia. Greyskull usa a última série de `sets` (até à falha).

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

**Treino personalizado (`js/custom.js`):** vale só para hoje e vive em `ST.custom`, servido como o dia `CUSTOM_DAY` por `routine.js` (`getDay`/`DAYS`/`setDayExercises`) — **nunca** em `ST.routine` nem em `dayNames()`, por isso a agenda não o vê. Ecrã próprio `ST.view = '__pers'` (`render('Personalizado')` redireciona); `ST.day` continua a ser um dia real. Séries em `ST.sets['Personalizado:i']`; caduca no dia seguinte. Concluir grava `ST.sessions` e marca as cargas `c:1` em `ST.log`. Ao concluir, `replaceCurrent()` (`schedule.js`) marca o 1.º dia pendente `<=` hoje em `ST.sched.replaced` (estado `swapped`: sai da fila, **não** conta como feito; Reabrir desfaz); um por dia, nunca dias futuros; o reset semanal limpa-o.

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
