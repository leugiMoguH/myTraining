# myTraining V2 — Redesign UX/UI: relatório (diagnóstico + demonstração)

Estado: **só diagnóstico e mockups. Produção não modificada.** Nada implementado, nada publicado. Evidência: capturas da app real (treino-v43) com dados de demonstração isolados (contexto de browser vazio, sem tocar nos dados do dono) e um protótipo estático. Sem testes com utilizadores: nenhum tempo medido nem inventado.

## A. Diagnóstico (comum às duas auditorias)
1. **Hoje com blocos a competir antes da ação**: tira + Plano + sugestão de adaptação + aviso de atraso + cartão; «Segunda pendente» aparece 3×; «Versão rápida» e «Pouco tempo» são o mesmo; o CTA fica a ~y=600 (800 px).
2. **Dois CTA vermelhos iguais** («Começar treino» + «Iniciar» central), e o central muda de função (iniciar/pausar/retomar/ir à Semana) — `nav.js`.
3. **Nutrição e Plano escondidos em Opções** (Hoje→diário = 2 toques; Perfil→alterar→voltar = 5; preferência de treino→aplicar = 10−k).
4. **Semana = Histórico** (o mesmo ecrã; começa pelo futuro, depois recentes) e Histórico/Evolução sobrepostos.
5. **Evolução com 2688 px** (conquistas antes das cargas; «volume planeado» é do Plano; 18 chips de músculos).
6. **Nutrição: resumo de 7 nutrientes antes da 1.ª refeição**, 0 botões «Adicionar» no 1.º ecrã (2024 px).
7. **Folha de Opções sem altura máxima/scroll** (topo cortado), 10 ações misturadas com 3 destinos; z-index 400 vs 700 documentado. *(achado do Codex)*
8. **Plano mostra gestão (criar/reorganizar/backup) antes da rotina**; diz «6 treinos» mas a agenda tem 4 pendentes (dias «Descanso» contados). *(Codex)*
9. **Cabeçalho com − ⏱60s + em todos os ecrãs** (também Nutrição/Perfil), ~50 px sem relação com a tarefa. *(Claude)*
10. Legibilidade: textos 11 px, chips <44 px de largura, gráficos sem nome acessível, ícones emoji misturados. *(ambos)*

Preservar: guiado (limpo), temas, tokens, alvos ≥44 px, folha de alimento, edição por toque.

## B. Análise independente
**Codex** (`codex-auditoria.md`, guardado antes da comparação): barra «Hoje·Semana·Evolução·Nutrição·Mais» **sem botão central**; faixa de sessão com Abrir/Pausar/Retomar/Descartar a 1 toque; Histórico dentro de Evolução; discorda da premissa («não esconder indiscriminadamente; o guiado já está bem»).
**Claude** (`claude-auditoria.md`, escrito antes de ler o Codex): barra «Hoje·Plano·▶·Nutrição·Progresso» **com** botão central, ⚙ no cabeçalho, Progresso com 4 separadores (Resumo/Cargas/Corpo/Histórico).
**Concordâncias:** problemas 1–8; Nutrição direta na barra; Semana/agenda própria; Histórico junto da evolução; volume planeado → Plano; resumo compacto + refeições primeiro; Hoje = 1 cartão + 1 linha de exceção; Perfil/Definições agrupados.
**Discordâncias (mantidas):**
- *Botão central*: Claude propunha mantê-lo (já testado, pausa em qualquer ecrã). Codex: é comando, não destino; ambíguo; o guiado já esconde a barra; a faixa já cobre a sessão. **Claude aceita o argumento** (a duplicação de CTA e as 4 funções do mesmo botão são o defeito; «já testado» não valida a nova composição). Condição: faixa com Abrir/Pausar·Retomar/Descartar a 1 toque (hoje exige mudança na faixa).
- *⚙ no cabeçalho vs «Mais»*: Codex «Mais» (rótulo visível; critério do dono «onde estão as definições» → rótulo vence ícone). Claude aceita; custo: uma posição da barra.
- *Separadores em Evolução*: Claude sim; Codex prefere reordenar (cargas primeiro). Aceite como híbrido: separadores **só se evitarem scroll**, abrindo em **Cargas**, com separador/posição preservados; reconhece-se +1 toque (Hoje→Evolução→Histórico→Resumo = 3 contra 2 hoje).
- *Premissa do dono*: Codex lembra que esconder mais gera passos. Concordância: não se esconde nenhum percurso diário; o resumo nutricional completo fica a 1 toque.

Revisão cruzada do Codex à proposta do Claude (correções aceites): tabela de destinos tinha de ser por **ações e estados**; «Nutrição antes 3» estava errado (**2** toques); Plano misturava **esta semana** e **plano habitual**; Personalizado/rápido e aulas pendentes ficavam menos visíveis; mockups com limites (abaixo).

## C. Alternativas
| | **Proposta 1 · Estável** (Codex; recomendada) | **Proposta 2 · Central** (Claude) |
|---|---|---|
| Barra | Hoje · Semana · Evolução · Nutrição · Mais | Hoje · Plano · ▶ · Nutrição · Progresso (+⚙) |
| Prós | 5 destinos iguais, 1 CTA por ecrã, Definições com rótulo, menos migração conceptual de sessão | pausa/retoma em qualquer ecrã sem faixa nova; menos reescrita de testes de `#navMain` |
| Contras | exige faixa de sessão completa; perde atalho central | CTA duplicado e botão de função variável permanecem; ⚙ menos descobrível |
**Recomendação (híbrida, concordada nas duas auditorias):** barra da Proposta 1 + do Claude: **Hoje compacto**, **Mais organizado por secções** (Perfil · Aplicação · Dados), separadores em Evolução só onde cortam scroll. **Decisão do dono: barra com ou sem botão central.**

## D. Demonstração
- Comparativos Antes | Proposta 1 | Proposta 2 (390 e 360 px, claro e escuro): `capturas/comparativos/` — Hoje, Nutrição, Guiado, Descanso, Semana/Plano, Evolução/Progresso, Mais/Perfil. Capturas soltas: `capturas/antes/` (app real, 320/360/390/412/1280 × claro/escuro, 12 ecrãs + acolhimento) e `capturas/depois/` (protótipo, mesmas larguras).
- Publicação: `docs/ux-v2/index.html` (página de entrada), `proto/`, `capturas/comparativos/` e os `.md`. As pastas `capturas/antes` e `capturas/depois` (11 MB) ficam só locais.
- Protótipo navegável: `docs/ux-v2/proto/index.html`. Local (servir por HTTP, p. ex. `npx http-server docs/ux-v2/proto` ou `npm start` e abrir `/docs/ux-v2/proto/index.html?alt=a`); não está publicado nem ligado à app. Parâmetros: `alt=a|b`, `theme=dark|light`, `screen=hoje|treino|nutri|plano|prog|eu`.
- **Limites dos mockups (declarados, apontados pelo Codex):** guiado e descanso são **simplificados** (a app real mantém ±, séries e «A seguir»; **não se propõe mudá-los**); sem sessão persistente nem faixa; Nutrição agregada (a edição por alimento mantém-se como hoje) e dados do Depois ≠ perfil incompleto do Antes (ver «ref. indisponível» no Antes); Cargas/Corpo/Volume são esboços; 1280 px mostra moldura móvel, não desktop validado. As imagens **não demonstram ausência de regressões**.

## E. Impacto (por ação/estado, Proposta 1 híbrida)
| Hoje | Passa a | Toques |
|---|---|---|
| Começar treino | Hoje (cartão), igual | 1 → 1 |
| Pausar/retomar/abrir sessão | faixa de sessão (a criar/estender) | 1 → 1 |
| Versão rápida / pouco tempo | 1 entrada no cartão (+ na sugestão) | = |
| Treino personalizado, lista manual | Hoje (linha «Ver exercícios e registar»; personalizado ao lado) — **não escondidos** | = |
| Adaptação | 1 linha contextual com Desfazer; folha existente | = |
| Aulas hoje e **pendentes da semana**, Fiz/Cancelada/Substituída/Reabrir/outro dia/conflitos | Hoje (linha) + Semana (ocorrências); modelos/edição em Plano habitual | = ou −1 |
| Semana vs rotina | Semana = **esta semana** (trocas «só esta semana»); «Plano habitual» claramente separado (edição permanente) | Semana 1 → 1 |
| Diário alimentar | barra Nutrição | **2 → 1** |
| Pesquisar→quantidade→guardar, editar/eliminar, manual, código de barras, fontes ⓘ, «Sem refeição» | inalterados dentro da folha/diário | = |
| Resumo nutricional completo | 2 nutrientes no topo + «Resumo completo» (7 + ⓘ) | +1 só para o detalhe |
| Histórico/Resumo de treino | em Evolução | 2 → 3 (**regressão assumida**) |
| Exercício (cargas/gráfico/editar), medidas (edição, rascunhos) | Evolução → Cargas (abre aqui) / Corpo | 2 → 2–3 |
| Conquistas, mapa muscular | secundários em Evolução | = |
| Volume planeado | Plano habitual | — |
| Perfil, preferências, tema, ecrã ligado, notificações, backup, CSV | Mais (secções) | Perfil 2 → 2; Plano 2 → 1–2 |
| Revisão de preferência | «Rever preferência e proposta» → direto à proposta → regressa à origem | 10−k → menos (a medir) |
| Guiado, descanso, acolhimento | inalterados | = |
**Riscos:** ids de vista (`__perfil`=Evolução, `__hist`, `__semana`, `__eu`, `__plano`) mantêm-se como aliases; `bnav/navRow/navMain/navLive/woBg/hdr/content` tornam o fundo inerte; testes que dependem da barra (`browser`: 5 botões; `b6`: Plano/Perfil sob Opções; `ux`, `rest`, `a11y`: `#navMain`, `#navRow button:last-child`; `hoje`, `cards`, `smoke`). Alterações **deliberadas** de expectativa, nunca enfraquecer garantias. Invariantes: nada em `ST.day`, não reindexar séries, navegar nunca fecha sessões, «só esta semana» ≠ permanente. Dados e armazenamento não mudam.
**Decisões do dono:** (1) barra com ou sem botão central; (2) «Mais» vs ⚙; (3) aceitar Histórico a 3 toques; (4) Evolução: separadores vs só reordenar.

## F. Plano de blocos (cada um: âmbito fechado, funcionalidades preservadas, testes de navegação+regressão, capturas 320/360/390/412/1280 × 2 temas, revisão Codex, publicação após validação)
1. **Opções + legibilidade** (altura/scroll/fecho, z-index, chips 44 px, texto 11 px, nomes de gráficos). *Sem mexer na navegação.* Critério: folha inteira visível a 320×640.
2. **Hoje**: cartão primeiro; atraso numa linha; 1 «rápido»; aulas; lista manual direta. Critério: ação primária visível a 360×640; percursos de treino ≤ toques atuais; descanso/atraso/em curso testados.
3. **Nutrição**: resumo compacto + refeições primeiro; «Adicionar» no 1.º ecrã. Critério: `test:nutri-*` verdes; sem «0» para dados em falta.
4. **Destinos estáveis**: Semana própria, Nutrição na barra, Mais; faixa de sessão com Abrir/Pausar/Descartar. Critério: `ux`, `rest`, `a11y`, `b6` atualizados; sessão preservada ao navegar.
5. **Agenda / rotina / registos**: Semana (esta semana + aulas), Plano habitual (rotina primeiro), Histórico em Evolução; uniformizar «Descanso» vs «treino». Critério: `hoje-semana`, `classes*`, `adapt*`, `plan`.
6. **Evolução e Perfil**: cargas primeiro, volume → Plano; revisão de preferência direta. Critério: `motiv*`, `drafts`, `onb-choices`, `dialogs`.
7. **Validação mobile do conjunto** (teclado real, áreas seguras, nomes longos, várias aulas, sessão ativa/pausada, reload) e comparação de toques/scroll com a base desta auditoria.
Prioridade: 1 → 2 → 3 → 4 → 5 → 6 → 7 (maior frequência/confusão primeiro).

## G. Estado
- **Criados** (todos novos, não commitados): `docs/ux-v2/{claude-auditoria,codex-auditoria,RELATORIO}.md`, `docs/ux-v2/proto/index.html`, `docs/ux-v2/capturas/{antes,depois,comparativos}/`, `scripts/_ux-before.mjs`, `_ux-after.mjs`, `_ux-compare.mjs` (prefixo `_`, nunca commitados).
- **Produção:** nenhum ficheiro rastreado alterado por esta etapa (só `todolist_tommorow.md`, pré-existente). Sem push, sem SW/estado/regras/dependências novas.
- **Claude vs Codex:** Claude — capturas, auditoria, protótipo, comparativos, síntese; Codex — auditoria independente (só leitura) e crítica da proposta do Claude (só leitura).
- **Próxima decisão:** escolher entre Proposta 1 e 2 (e as decisões 2–4 acima). Só depois começa o Bloco 1.

## Bloco 1 — implementado

Separador «Mais» com SVG de três pontos; folha com scroll interno (88dvh), cabeçalho fixo, Fechar e grupos Ir para/Aparência/Aplicação/Dados. Mantidos ids, handlers, gestão de foco e botão central. Mensagens corrigidas; o acolhimento indica apenas a exportação disponível. Cache: treino-v45.

Legibilidade: `.nutri-wrap .ndisc` passa a 13px normal; passam a 12px `.nutri-wrap .ntar-l`, `.nutri-wrap .qfood`, `.nutri-wrap .iitem-t`, `.today-top .wk-row-st`, `.nutri-wrap .wk-row-st`, `#content:has(.today-plan) .cl-st`, `.nutri-wrap .hx-k`, `.nutri-wrap .hx-day-h small`, `.nutri-wrap .mm-ex small`, `.nutri-wrap .lc-next-s`, `.nutri-wrap .lc-prog-t`. Títulos da folha: `#sheetBg .sheet-title` (18px) e `#sheetBg .sheet-sub` (12px). Descanso sem opacidade global, com cor explícita nos descendentes; badge «hoje» com fundo transparente só na linha de descanso. Contraste mínimo medido: claro 7,58:1; escuro 7,65:1. Gráficos com nome escapado, métrica, unidade, extremos e contagem; mapa muscular mantém o nome existente.

Validação em série: smoke, test:mais-sheet (quatro viewports × dois temas, foco/teclado, alvos, scroll, texto e gráficos), test:a11y e test:b6 passaram. test:ux e test:onboarding falharam apenas na agregação de erros de consola por pedidos `net::ERR_FAILED`, sem falhas funcionais reportadas. test:browser não executado. CRLF confirmado com `file` nos ficheiros de código alterados. Sem commit/push.

Pendências: chips de 7 dias; z-index 400 da folha. Nenhuma alteração ao protótipo neste bloco.

## Bloco 2 — Hoje (implementado)
- **Antes → Depois (390 px, atraso + adaptação + aula anterior):** blocos acima do botão principal 5 → 1 (tira + cartão); o botão «Começar treino» passou de y=694 (fora do ecrã a 360×640) para y=275 (visível), medido com o mesmo estado — treino em atraso, adaptação e aula anterior — a 360×640 e 390×844; «Segunda pendente» repetido 3× → 1×; ações de «versão rápida» 3 → 1; saudação, linha «Ver o plano» e banner de descanso eliminados (a informação passou para o estado do cartão).
- **Nova ordem:** tira dos 7 dias → cartão do treino (estado, nome, duração, CTA único, «Pouco tempo? Versão rápida» · «Ver plano ›») → «Ver exercícios e registar» → atenção compacta (treino movido · Desfazer; sugestão de adaptação) → aulas (hoje + pendentes) → treino personalizado (linha discreta).
- **Temporizador do cabeçalho** (− ⏱60s +): só em dia/personalizado/ficha, ou no Hoje com sessão viva ou lista aberta.
- **Pendências transitórias:** botão central «Iniciar» continua a duplicar o CTA do Hoje até ao Bloco 4; a lista de exercícios aberta empurra a atenção/aulas para baixo; chips dos 7 dias <44 px de largura a 320 (Bloco 5).
- Capturas: `capturas/bloco2/{antes,depois,comparativos}` (11 estados × 320/360/390/412/1280 × claro/escuro; relógio fixo, dados de demonstração).

## Registo de ordem (2026-10-25)
Por decisão do dono, o **Bloco 4 (navegação global)** foi antecipado antes do Bloco 3 (Nutrição). Entregue em `treino-v48`: barra Hoje · Semana · Evolução · Nutrição · Mais, sem botão central; pausar/retomar/abrir/descartar na faixa de sessão; Histórico via Evolução ou Mais (2 toques).

## Bloco 3 — Nutrição compacta (2026-10-26, treino-v49)
1.º ecrã: dia · resumo compacto (Energia + Proteína) · «＋ Adicionar alimento» · refeições com contagem. Os 7 nutrientes ficam em «Resumo completo» (1 toque, `<details>`); ⓘ sempre visível; aviso científico dentro do resumo completo. Cálculos e dados inalterados.

## Bloco 5 — Semana, Plano e Histórico (treino-v50, 3e1faae)
Semana «Esta semana» com intervalo de datas; chips ≥44 px a 320 px em todas as tiras (regra única em `.week-strip`), com `aria-label` de estado; Plano → «Plano habitual» com alterações permanentes explícitas (reorganizar, substituir, «✎ Editar rotina»); atalhos Histórico e Plano habitual. Teste: `test:b5`.

## Bloco 6 — Evolução e Perfil (treino-v51, a7eb6f0)
Evolução em separadores Resumo · Cargas · Corpo (estado só em módulo); Histórico «Ver todos (N)» (só leitura; a app guarda os últimos 300 treinos e avisa); Perfil em secções recolhíveis com resumo. Altura a 390 px: Evolução 2807 → 743/1231/1402 px; Perfil 1200 → 465 px. Teste: `test:b6b`.

## Bloco 7 — Validação final (treino-v52)
- Painel «Sobre»: botão «Fechar» substituído por «X» (ícone 18 px, alvo 44 px, `closeX` em `dialog.js`); foco volta ao separador Mais; Tab preso; Escape. Teste: `test:sobre` (320/360/390/412 × claro/escuro).
- Temas: a app usa `treino_theme` (por omissão **escuro**); as validações visuais fixam-no de facto e confirmam `data-theme` e o fundo. Claro, escuro e automático (sistema claro/escuro) testados e persistentes.
- Varredura objetiva (`test:consist`, 9 ecrãs × 320/390/1280): corrigidos «hoje» (9 → 11 px) e intervalo de datas da Semana (<11 px).
- Revisão Codex (só leitura, diff dos Blocos 5–7): 2 achados corrigidos — `aria-controls` só no separador ativo; «Evolução por exercício» abre Cargas. O Codex não conseguiu correr browsers (EPERM): UI verificada só pelos testes do Claude.
- Histórico/retenção: `ST.workouts` guarda os últimos 300 (`session.js`); `ST.log` (cargas) e medidas não são cortados; conquistas têm limites ≤10 dias e estado `seen` persistente — sem contagens históricas enganosas; o backup exporta o que existe.
- Bateria: 42 suites em série, mesma revisão, 0 falhas. Não verificado: leitor de ecrã real, telemóvel físico (feito pelo dono em v51), safe areas reais.
