# Auditoria UX/UI — Codex (independente, só leitura; texto guardado antes da comparação)

Conclusão do Codex: a app precisa de **hierarquia mais clara e destinos estáveis**; não de perder funcionalidades nem de reescrita. A sobrecarga vem da ordem dos conteúdos, da mistura agenda/histórico e da concorrência entre ações. **Discorda parcialmente da premissa:** o treino guiado já concentra bem a tarefa diária; já há detalhes recolhidos (exercícios, medidas, preferências alimentares); esconder mais ações indiscriminadamente acrescentaria passos. Contagens feitas pelo código e capturas 390×800; sem tempos nem testes com utilizadores.

## 1. Top 8 problemas
1. **Barra mistura destinos com comando de sessão**: o centro inicia/pausa/retoma; sem treino selecionado abre Histórico; para abrir sessão existente usa-se a faixa «Abrir» → 4 comportamentos na mesma posição (`nav.js:62,105,151`). → Barra só de destinos estáveis; comandos da sessão no cartão, guiado e faixa; manter pausar/retomar a 1 toque.
2. **«Histórico» começa pelo futuro**: `renderHistory()` chama `renderWeek()` (7 dias) antes dos recentes; `__semana` redireciona para o mesmo ecrã (`ui.js:317,340,432`). → Semana com destino próprio; registos concluídos junto da Evolução.
3. **Hoje põe exceções antes da tarefa e repete-as**: «Segunda pendente» ×3 (sugestão, aviso, cartão); «Versão rápida hoje» vs «Hoje tenho pouco tempo» (`ui.js:272`, `adapt-ui.js:19,32`). → Cartão do treino primeiro; atraso numa linha; uma só entrada de «rápido»; aulas de hoje a seguir.
4. **Nutrição: totais antes do registo**: 7 nutrientes antes da 1.ª refeição; nenhum «Adicionar» no 1.º ecrã (`diary-ui.js:30,48`). → Data, resumo compacto, 1.ª refeição com Adicionar; restantes nutrientes em detalhe.
5. **Opções esconde tarefas frequentes e a folha excede o ecrã**: sem `max-height`/`overflow-y`; topo cortado na captura 09 (`index.html:704,711,1380`). → Nutrição na barra, Plano junto da Semana; Perfil/Definições em «Mais»; folha com altura máxima, scroll e fecho visível.
6. **Evolução com demasiados níveis** (2688 px; conquistas antes das cargas; volume planeado é do Plano) (`profile.js:244`, `motiv-ui.js:160`). → Cargas/registos primeiro; resumo compacto; conquistas e mapa secundários; volume no Plano.
7. **«Alterar preferência» promete menos do que faz**: atravessa passos seguintes, proposta e confirmação; termina no Hoje (`onboarding.js:131,171,188,245`); Plano mostra criar/reorganizar/backup antes da rotina (`plan-screen.js:24`). → «Rever preferência e proposta», avançar direto à proposta, regressar à origem; Plano mostra a rotina primeiro.
8. **Legibilidade/semântica**: metadados 11 px, itálico 11 px, opacidade global em descanso, 7 chips <44 px de largura em ecrãs estreitos; `chartSVG()` sem nome acessível/eixos (`index.html:343,418,795,1146`, `charts.js:3`). → Não comprimir por tamanho de letra; chips → linhas completas; gráficos com valores/datas.
Extra: Plano diz «seis treinos» (inclui dias «Descanso») mas a agenda tem 4 pendentes — `isTraining()` (`plan.js:84`) vs agenda; uniformizar sem alterar a rotina.

## 2. Blocos por ecrã (código; 1.º ecrã a 390×800)
Hoje 5 blocos + início do 6.º (tira, Plano, adaptação, aviso, treino) · Evolução 6 grupos · Histórico/Semana tira + 7 dias + 1 recente · Plano gestão + 2 dias + 1 parcial · Nutrição data + 5 nutrientes, **0 refeições** · Opções 3 temas + 10 ações, topo cortado. Alturas das páginas: Hoje 945, Histórico 1355, Plano 1515, Nutrição 2024, Evolução 2688 px.

## 3. Toques por percurso (convenção: ativações; sem digitação/scroll)
Começar treino 1 · registar série+descanso 1 · terminar→resumo 2 (+1 fechar) · treino completo S+E+2 · sair→reabrir 2 · semana 1 · semana→outro dia 2 · aula «Fiz» 1 · editar aula 2 (+1 guardar; pela barra 3) · aceitar adaptação 1 · rápido→guiado 2 · reorganizar 2 dias 4 (+1) · Hoje→evolução de exercício 2 (3 se «Ver todos») · Hoje→resumo de treino 2 · **Hoje→diário 2 (Opções+Nutrição)** · diário pesquisar→guardar 3 · editar registo 2 · **Perfil alterar idade→voltar 5** · **preferência de treino→aplicar→Hoje 10−k (k=0…3)**.
Nota: percurso alimentar já é curto (quantidade+refeição na mesma folha) — não lhe juntar etapas. Não equiparar guiado (série+carga num toque) e lista manual (separados) — deve ficar compreensível, sem eliminar o manual.

## 4. Navegação recomendada
**Alt A — Hoje · Semana · Evolução · Nutrição · Mais** (recomendada). Treino guiado = modo aberto pelo treino, não separador.
**Alt B — Hoje · Treino · Evolução · Mais** (4 alvos; Treino reúne Semana/Plano/aulas). Contra: Semana mais fundo; Nutrição precisa de atalho no Hoje, que volta a disputar espaço.
Destino de cada funcionalidade (A): Hoje→treino/descanso/aulas de hoje/exceções; Guiado→abre em Começar/Continuar; Semana→agenda+aulas (sem treinos antigos); Aulas→ocorrências em Hoje/Semana, modelos/edição no Plano; Adaptação→contextual ao treino afetado; Plano→«Plano habitual» na Semana + atalho no Hoje, rotina antes das operações de gestão; Histórico→«Treinos recentes» em Evolução, Resumo a 2 toques; Conquistas→secundário em Evolução; Nutrição→destino direto; Perfil→Mais→Perfil (2 toques); Definições/backup→Mais agrupado; Onboarding→1.ª utilização + revisão a partir de Plano/Perfil com regresso à origem; Personalizado/rápido→entradas diretas no Hoje.
**Condição para retirar o comando central:** a faixa de sessão mantém **Abrir, Pausar/Retomar, Descartar** a 1 toque; «Abrir» não retoma sozinho.

## 5. Por ecrã (indispensável / secundário / avançado / repetido)
- **Hoje**: treino/descanso, Começar/Continuar, aulas de hoje, lista manual direta | Semana, Plano, personalizado, rápido | explicação do plano | 3 avisos do mesmo atraso; 2 entradas p/ rápido; saudação alta.
- **Semana**: 7 dias, estado, aulas, abrir dia, alterações temporárias | gerir aulas, plano habitual | reorganização permanente, correções antigas | tira + lista repetem navegação.
- **Guiado**: não retirar ações do dock para menu; demonstração vazia não deve ocupar área grande.
- **Evolução**: cargas, exercício, treinos recentes, medidas | resumo semanal, conquistas | mapa muscular | volume planeado → Plano.
- **Plano**: rotina, abrir/editar dias, aulas | reorganizar, rever proposta | repor, novo plano | backup global antes da rotina.
- **Perfil**: dados pessoais e preferências | explicação do efeito | revisão de proposta | 8 referências nutricionais → ligação à Nutrição.
- **Nutrição**: data, adicionar, quantidade, guardar, editar, totais essenciais | outros nutrientes, preferências | rótulo manual, origem, fórmulas | avisos repetidos agrupados (manter «estimativa»/parciais).
- **Mais**: Perfil, tema, opções | export/import | CSV, reposição.
- **Resumo final**: «Concluir» → «Fechar resumo» (sem mudar o momento de gravação).

**Novo Hoje a 360×640 (orçamento, não captura validada):** cabeçalho 56 · tira 48 · cartão do treino (estado numa linha, nome, duração, Começar, rápido 1×) 180 · «Ver exercícios e registar» + «Plano» 48 · 1 aula de hoje com «Fiz» 92 · 1 exceção contextual (sugestão ou personalizado) 72 · margens 48 · barra 5 destinos 60 = **604 px** (36 px de folga). Estados: treino em curso (Continuar + faixa; tirar secundário), descanso (cartão compacto), atraso (1 linha), várias aulas/nomes longos (aceitar scroll).

## 6. Elementos fixos/acessibilidade
Camadas: cabeçalho 100, barra 250, descanso 300, guiado 500, catálogo 600, onboarding 620, folhas 700, scanner 710, celebração 720, avisos 800, confirmação 900. Preservar: `body.guided` esconde barra/banner; `#woRest`; dock fora do scroll. **Corrigir:** folha de Opções/Aulas usa z 400 (comentário diz 700); Opções sem altura máxima/scroll/fecho; gesto da pega não implementado; `#notice` a 76 px do fundo pode tapar a faixa de sessão; `openWorkout()` não move o foco; gráficos sem nome/escala. Verificar teclado virtual (barra escondida) com teclado real.

## 7. Riscos e testes
`test:browser` (5 botões, sem `.tabs`, 7 chips) · `test:b6` (Plano/Perfil sob Opções, aba `opts`, caixas de `#navLive`/`#navRow`) · `test:ux`/`browser`/`rest` clicam `#navMain`, `#navLive` · `test:hoje` (`#todayToggle`, `#todayList`) · `smoke` (`__hoje __semana __hist __perfil __eu __plano __nutri`; **`__perfil` = Evolução**) · `test:b6/drafts/dialogs/onb-choices` (`p-*`, `m-*`, `#m-form`) · plan/onboarding/classes/adapt/hoje-semana · nutri-ui/search/contract · motiv/motiv-ui · a11y (`#navRow button:last-child`, `#sheetBg`) · sw-update/data/timer/superset/journeys. IDs `bnav`, `navRow`, `woBg`, `hdr`, `content` tornam o fundo inerte: mudar markup pode quebrar a11y sem quebrar o visual. Invariantes: não guardar destinos em `ST.day`; não reindexar séries; não fechar sessões ao navegar; mover «só esta semana» ≠ permanente.

## 8. Blocos propostos
1 Opções (altura/scroll/fecho) + legibilidade (sem mexer na navegação) · 2 Hoje reordenado · 3 Nutrição (resumo compacto, refeições primeiro) · 4 Destinos estáveis (Semana própria, Nutrição direta, Mais; comandos do centro → faixa) · 5 Agenda/rotina/registos separados (Histórico em Evolução; uniformizar descanso) · 6 Evolução e Perfil mais leves; revisão de preferência direta · 7 Validação mobile do conjunto.
