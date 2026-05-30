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

## Próximo / fora de âmbito
- [ ] Sourcing real de GIFs/diagramas de movimento (ou colar links via ＋ demo)
- [ ] APK via Capacitor (quando alertas em background forem precisos)
- [ ] Editar a data de um registo antigo (hoje edita-se valores, a data fica fixa)

## Notas técnicas
- Migração: estado antigo sem `log`/`nutri`/`profile`/`measures` → defaults no load (nada se perde)
- `render()` guarda a tab atual (volta à última aba no reload)
- Texto livre (favoritos/evitar) inserido sem escape HTML — aceitável (tool pessoal, local)
- Deploy: GitHub Pages (HTTPS) — necessário para SW + instalação no Android
