# Auditoria UX/UI — Claude (independente, escrita ANTES de ler o Codex)

Base: capturas reais da app (treino-v43) com dados de demonstração isolados, 320/360/390/412/1280 × claro/escuro, em `capturas/antes/`. Skill `ui-ux-pro-max` aplicada às regras: hierarquia de ação única, navegação ≤5, progressive disclosure, fixed-element offset, consistência de ícones. Sem testes com utilizadores: nada de tempos inventados; contagem de toques feita pelo código/capturas.

## A. Problemas mais relevantes (evidência)

1. **Hoje tem 4 blocos a disputar antes da ação principal** (`02-hoje`): faixa de dias + «Ver o plano» + cartão vermelho «Ajustar esta semana» + banner amarelo «Hoje é descanso, mas Segunda ficou pendente» + cartão do treino. O «Começar treino» fica a ~y=600 num ecrã de 800 px; a 360×640 sai da primeira dobra. Adaptação e banner dizem a mesma coisa (pendente ×2).
2. **Dois CTA primários iguais**: o botão vermelho «Começar treino» no cartão e o botão central «Iniciar» da barra (ambos vermelhos, ambos «começa o treino»). Mais «Hoje tenho pouco tempo» e «Versão rápida hoje» a oferecer a mesma coisa.
3. **Destinos de uso diário escondidos em Opções**: Nutrição (registo diário) = Opções → Nutrição (2 toques + folha); Plano e Perfil idem. A aba «Opções» é, na prática, um menu de três ecrãs principais + backup. A Semana vive dentro de Histórico (aba que o utilizador lê como «passado»).
4. **Histórico e Evolução sobrepostos**: Histórico = semana + treinos recentes + aulas + link «Evolução por exercício»; Evolução = semana, conquistas, cargas, medidas, músculos, volume. Duas abas, mesma pergunta («como vou?»), conteúdos cruzados.
5. **Evolução é uma lista de 7 secções (~2700 px a 390)**: inclui «Volume semanal planeado», que é do Plano (planeado ≠ progresso), e 18 chips de músculos.
6. **Nutrição: o resumo (7 nutrientes, ~550 px) empurra as refeições para baixo da dobra**; a ação diária (adicionar à refeição) fica abaixo da análise. Seletor de data nativo grande. Com perfil incompleto aparece «ref. indisponível» em cada linha (repetição).
7. **Cabeçalho global com controlos de descanso (− ⏱60s +) em todos os ecrãs**, também Nutrição/Perfil/Plano onde não fazem sentido; ocupa ~50 px e acrescenta 3 alvos sem relação com a tarefa.
8. **Plano mistura gestão e consulta**: criar plano, reorganizar, «cópia de todos os dados» (duplicado de Opções) antes da rotina; cartões de dia de alturas desiguais; aulas no fundo.
9. **Opções = folha com 12 itens** (tema, 3 destinos, 2 toggles, 2 backups, 3 CSV) — definições e destinos de navegação misturados.
10. **Barra fixa**: botão central elevado cobre conteúdo; em capturas full-page e nas listas, 1–2 linhas ficam sob a barra (reserva existe, mas o botão sobressai). Ícones emoji misturados com texto (inconsistência de estilo; skill: SVG).

O que **funciona** e deve ser preservado: guiado limpo (1 exercício, dock kg×reps, descanso numa zona própria `#woRest`), temas, tokens, alvos ≥44 px, folha de alimento ancorada, edição por toque.

## B. Princípios da proposta
- **1 ação primária por ecrã.** Tudo o resto é secundário (texto/chevron) ou contextual.
- **Frequência decide o lugar**: diário (treinar, comer) → barra; semanal (semana/aulas/plano) → 1 destino; ocasional (progresso, perfil, definições) → destino único agrupado.
- **Estado em vez de cartões**: «pendente», «descanso», «sugestão» passam a **etiquetas/uma linha** dentro do cartão do treino, não blocos.
- **Resumo → detalhe** onde há 7+ números (nutrição, evolução): 2 números fortes + «Ver tudo» (folha ou separador), nunca menos passos para a tarefa diária.
- Nada é eliminado: tudo muda de sítio (tabela em E).

## C. Alternativa A — «4 destinos + Treino» (recomendada)
Barra: **Hoje · Plano · ▶ Treino (central, igual) · Nutrição · Progresso**. ⚙ Definições/Perfil num ícone no cabeçalho do Hoje (ecrã **Eu**).
- **Hoje**: cabeçalho fino (data, ⚙). Faixa de 7 dias compacta. UM cartão principal: treino do dia (+ etiqueta de estado) com CTA único; «pouco tempo» como ação secundária de texto. Sugestão de adaptação = **1 linha** com chevron (abre a folha existente). Aula de hoje = 1 linha. Atalho «Comida de hoje · 1672 kcal ›» em 1 linha.
- **Plano**: lista semanal (dia, treino/aula, estado) = junção da Semana (hoje em Histórico) com a rotina; toque → dia (consultar/✎). «Gerir plano» (criar/reorganizar) num botão secundário; volume planeado aqui.
- **Nutrição**: data com ‹ Hoje ›; **refeições primeiro** com «Adicionar»; resumo compacto (energia + proteína + barra) com «Resumo completo» (7 nutrientes + ⓘ) por baixo/folha.
- **Progresso** com separadores: *Resumo* (a tua semana, conquistas) · *Cargas* (exercícios/gráficos) · *Corpo* (medidas, músculos) · *Histórico* (treinos e aulas). Absorve Evolução + Histórico.
- **Eu** (via ⚙): Perfil, preferências de treino, aparência, ecrã ligado/notificações, dados (backup/CSV) — ecrã em secções, não folha de 12 itens.
Prós: Nutrição 1 toque (antes 3), Plano 1 toque (antes 2), Progresso unifica duas abas; mantém o botão central de sessão (já testado). Contras: nova aba «Progresso» com 4 separadores; mexer em ids de vista (`__perfil`, `__hist`) e testes que clicam na barra.

## D. Alternativa B — «Hoje · Semana · Comida · Progresso» sem botão central
4 destinos iguais, sem central; CTA «Começar/Retomar» só no cartão do Hoje e na faixa «treino em curso» (já existente) em todos os ecrãs.
- Prós: mais simples, 1 só CTA, sem botão elevado a cobrir conteúdo; barra uniforme.
- Contras: perde pausar/retomar de qualquer ecrã (hoje o botão central controla a sessão); mais regressão no `test:ux`/guiado; durante o treino a barra de baixo fica menos útil.

## E. Para onde vai cada funcionalidade (A)
| Hoje | Passa a |
|---|---|
| Hoje (treino, adaptação, banner, personalizado) | Hoje (1 cartão + 1 linha de sugestão + «Mais opções» p/ personalizado/pouco tempo) |
| Semana (em Histórico) | Plano |
| Aulas (Plano/Histórico/Hoje) | Plano (lista semanal) + linha no Hoje se for hoje |
| Plano (criar/reorganizar) | Plano → «Gerir plano» |
| Evolução, Conquistas, Medidas, Músculos | Progresso (Resumo/Cargas/Corpo) |
| Histórico, Aulas recentes | Progresso → Histórico |
| Volume semanal planeado | Plano |
| Nutrição / Diário / Pesquisa | Nutrição (barra), refeições primeiro |
| Perfil, Preferências | Eu (⚙) |
| Definições, backup, CSV, tema | Eu (⚙) |
| Treino guiado / Descanso | inalterado |
| Acolhimento | inalterado (arranque) |

## F. Riscos
- Ids de vista e testes (`__perfil`=Evolução, `__hist`, `bnav`, `navRow`): migrar com aliases, não renomear de uma vez.
- Perder a aba «Histórico»: manter deep-link/alias. Hábito do utilizador: aviso único («Histórico e Evolução juntaram-se em Progresso»).
- Separadores novos = estado de scroll/contexto: preservar aba e posição ao voltar.

## G. Blocos propostos (ver relatório)
1. Cabeçalho (descanso só em treino/Hoje) + Hoje (1 cartão + 1 linha). 2. Nutrição: refeições primeiro, resumo compacto. 3. Barra nova (Hoje · Plano · ▶ · Nutrição · Progresso) + Eu. 4. Plano = semana+aulas+gestão. 5. Progresso com separadores. 6. Polimento (ícones SVG, alturas, reservas). Cada um: testes de navegação + capturas 5 larguras × 2 temas + revisão Codex + publicar.
