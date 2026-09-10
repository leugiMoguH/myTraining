# myTraining — Progresso

App pessoal de treino (single-file `index.html` + PWA). Tudo local em `localStorage`.

## Fase 1 — Fundação App ✅
- [x] Histórico de carga (kg×reps) + gráfico de progressão (1RM Epley)
- [x] Backup export/import JSON
- [x] PWA instalável (`manifest.json`, `sw.js`, `icon.svg`, offline)
- [x] Wake lock (ecrã ligado) + bottom-sheet de Definições (⚙)

## Fase 2 — Imagens → Diagramas (mapa muscular) ✅
- [x] `MUSCLES` (30 exercícios) + `MUSCLE_NAMES`; `bodySVG(P,S)` frente+costas (15 grupos)
- [x] Slide 1 = mapa (primário vermelho / secundário laranja) + chips; slots `ex.dia` p/ futuros
- [x] Cardio/descanso → fallback 💪; fotos `imgs` legacy (não renderizadas)

## Fase 3 — Nutrição ✅
- [x] Tab 🥗 Nutrição: preferências (refeições, cozinhar, favoritos, restrições, suplementos, evitar)
- [x] Sugestão de refeições dos favoritos + timing pré/pós-treino + lista de compras

## Fase 4 — Perfil / Dados + Medidas ✅
- [x] Tab 👤 Perfil = fonte única de dados do corpo (sexo, idade, altura, objetivo, atividade)
- [x] **Centralização**: Nutrição lê do Perfil (peso = última medida); campos do corpo removidos do form de nutrição
- [x] Medidas no tempo: peso (obrigatório) + cintura/pescoço/anca/peito/braço/coxa (opcionais)
- [x] **% gordura calculada** (fórmula US Navy de cintura/pescoço/anca + altura) — não pedida
- [x] Gráficos por métrica (chips para alternar) — `chartSVG` extraído e reutilizado
- [x] Resumo de macros/metas (kcal/proteína/água + hidratos/gordura) no Perfil
- [x] Migração segura: dados antigos da nutrição → Perfil + 1ª medida
- [x] Verificado: BF 16.4%, peso lido das medidas, metas, gráficos, render sem erros

## Fase 5 — Diário de ingestão ✅
- [x] `ST.intake[]` (id, ts, date, name, kcal, protein) — múltiplos por dia
- [x] Add manual + 12 alimentos quick-pick (preenchem valores, editáveis)
- [x] "Hoje": barras de progresso kcal/proteína vs metas (do Perfil)
- [x] Lista de hoje com hora por item + remover; gráfico de kcal/dia ao longo do tempo
- [x] Secção no topo do plano da tab 🥗 Nutrição

## Fase 6 — Demos (movimento/animado) ✅
- [x] `ST.media[exercicio][]` — links de imagem/GIF/vídeo por exercício
- [x] Botão "＋ demo" no cartão → cola link → vira slide(s) no slider
- [x] Deteta vídeo (`.mp4/.webm/.mov`) → `<video>` autoloop; resto → `<img>`; ✕ remove
- [x] Ordem dos slides: mapa muscular → demos → `ex.dia`

## Timestamps (transversal) ✅
- [x] Cada registo guarda `ts` (ISO data+hora) na gravação/edição: carga, medidas, ingestão
- [x] Visível: hora por item no diário, "último registo: …" nas medidas, "últ. …" no gráfico de carga
- [x] Tudo entra no backup export/import → comparável ao longo do tempo

## Fase 7 — Editar histórico + Exportar CSV ✅
- [x] Medidas: "Histórico de medidas" no Perfil com ✎ editar (form vira "a editar ‹data›") e ✕ apagar
- [x] `MEASURE_EDIT_DATE` controla destino do save (data antiga vs hoje); cancelar edição
- [x] Diário: "Dias anteriores" (últimos 7 dias) com totais + itens + ✕ remover
- [x] CSV no ⚙ Definições: Medidas, Diário, Cargas (com data+hora; BOM p/ Excel)
- [x] Verificado: editar/apagar medidas, histórico do diário, escaping CSV, exports sem erro

## Fase 8 — Demos reais de exercício ✅
Decisão (após pesquisa): **free-exercise-db** (yuhonas, domínio público/Unlicense, 873
exercícios, 2 frames início/fim) via **CDN jsDelivr**. Melhor que IA (forma inconsistente,
40× esforço, alojamento) e que bonecos (crus). Claude não gera imagens raster — e mesmo
podendo, esta é a melhor opção de engenharia (real, consistente, grátis, offline após 1ª vez).
- [x] Mapeados 30 exercícios → pasta exata (validado contra o JSON de 873; inclinado corrigido)
- [x] URLs CDN validados live (HTTP 200, image/jpeg) em 16+ exercícios
- [x] `DEMOS` (por nome, sem tocar no DATA) + `demoSlide` (frames 0/1 alternam = movimento)
- [x] Demo = slide 1 (realista); mapa muscular = slide 2; depois media do user; depois ex.dia
- [x] SW v2 cacheia imagens cross-origin (CDN) → offline após 1ª vez
- [x] Fallback: sem demo (descanso) → mapa muscular / ícone; onerror → painel "liga-te à net"
- [x] Verificado: smoke-test (30 demos, ordem, fallback), sintaxe sw.js, URLs live

## Fase 9 — Editar data + APK scaffolding ✅
- [x] Medidas: campo Data no form (editar move o registo p/ nova data; futuro → clamp a hoje)
- [x] Capacitor: capacitor.config.json, scripts/build-www.mjs, package.json scripts, APK.md
- [x] .gitignore restaurado (tinha sido substituído) + www/ e android/
- [x] Verificado: move 2026-05-01→2026-05-15, clamp de data futura, mjs/JSON válidos

## Fase 10 — Modularização em ES modules ✅
Fundação para o salto seguinte (catálogo de 1324 exercícios + motor de progressão): o
`index.html` de 1924 linhas não aguentava mais.
- [x] `index.html` 1924 → 669 linhas (só markup + CSS) + `<script type="module" src="js/app.js">`
- [x] 19 módulos em `js/` (máx. 262 linhas: `nutrition.js`); split por secção, código inalterado
- [x] `js/bridge.js` — 45 handlers inline `onclick=` postos no `window` (em ESM nada é global;
      sem isto todos os botões falhavam **em silêncio**)
- [x] ESM: bindings importados são imutáveis → `setST()` (`state.js`) e `setRest()` (`timer.js`)
      para o `importBackup` poder substituir `ST` e `REST_SEC`
- [x] `sw.js`: `CACHE` → `treino-v3`, os 19 módulos no `CORE`
- [x] `scripts/build-www.mjs`: `js/` e `data/` copiados para o APK
- [x] `scripts/smoke.mjs` (`npm run smoke`): DOM mínimo, avalia o grafo todo, percorre os 9
      ecrãs, dispara 9 ações, valida imports↔exports e a ponte dos handlers
- [x] Verificado: 19/19 `node --check`; smoke verde; teste negativo (handler removido + throw
      injetado no render) → o smoke apanhou os dois
- [ ] **Falta confirmar no browser** (`npm start`) — clicar tab a tab; o smoke não substitui isto

## Fase 11 — Catálogo de 1324 exercícios (camada de dados) ✅
- [x] `scripts/build-catalog.mjs`: 17,4 MB → `data/catalog.json` **173 KB** + `instructions.en.json` 610 KB
- [x] SHA do dataset fixado (`7455efae…`) — `@main` invalidaria a cache das URLs de media
- [x] `js/labels.js`: PT para 10 grupos / 28 equipamentos / 19 alvos + 50 músculos → ids do `bodySVG`
      (1295/1324 pintam músculo primário; os 29 restantes são cardio, sem músculo — correto)
- [x] `js/catalog.js`: load lazy com dedupe de promessas, pesquisa sem acentos, filtros, ranking
      (nome começado pela query > palavra começada pelo termo > contém), `thumbUrl`/`gifUrl`
- [x] `sw.js` → `treino-v4`, catalog.json no `CORE` (instructions fica para runtime cache)
- [x] Smoke alargado: 1324 exercícios, facets 10/28/19, ranking, media URLs com SHA, instruções
- [ ] **Falta a UI**: ecrã de pesquisa + editor de rotinas (`js/routine.js`, `ST.routine`)

## Roadmap (restante do plano aprovado)
- [ ] Fase 11b — UI de pesquisa + editor de rotinas (substitui os 7 dias fixos de `data.js`)
- [ ] Fase 12 — motor de progressão: linear / Greyskull LP / dupla, com stalls e deload −10%
- [ ] Fase 13 — log de sessão a sério: séries individuais, PRs, RIR/RPE, supersets
- [ ] Fase 14 — dashboard: heatmap, volume real (feito, não planeado)
Licenças: dataset MIT, media © Gym visual (atribuição obrigatória). OpenGym é AGPL v3 —
**nenhum código dele entra no repo**, só o conceito.

## Próximo / fora de âmbito
- [ ] Escapar texto livre do utilizador no HTML (robustez — ver análise)
- [ ] Modo "Treino de hoje" guiado (maior upgrade de UX para o ginásio)
- [ ] Notificações nativas (rest/hidratação) via @capacitor/local-notifications
- [ ] Diário: scan de código de barras + macros via Open Food Facts (grátis)
- [ ] (opcional) GIFs animados via ExerciseDB/RapidAPI (precisa de API key)

## Notas técnicas
- Migração: estado antigo sem `log`/`nutri`/`profile`/`measures` → defaults no load (nada se perde)
- `render()` guarda a tab atual (volta à última aba no reload)
- Texto livre (favoritos/evitar) inserido sem escape HTML — aceitável (tool pessoal, local)
- Deploy: GitHub Pages (HTTPS) — necessário para SW + instalação no Android
