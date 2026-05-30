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
