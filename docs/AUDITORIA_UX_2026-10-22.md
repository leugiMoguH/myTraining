# Auditoria UX/UI — 2026-10-22 (só leitura)

Método: skill `ui-ux-pro-max` (checklist §1–§9) + Playwright (node, não o MCP — não está ligado nesta sessão) a 320/360/390/412/1280 px, ecrãs: acolhimento (5 passos), Hoje, Dia, Evolução, Histórico/Semana, Exercício, Nutrição, Definições, Catálogo, Treino guiado. Screenshots em `docs/audit-ux/`. Sem erros de consola. Medições automáticas (alvos <44, texto <12, scroll horizontal) em bruto; só se citam as confirmadas visualmente ou no CSS. Não foram acionados estados de erro/diálogo nativo (38 chamadas lidas no código, não executadas).

## Preservar
- Acolhimento: CTA no fundo (zona do polegar), barra de progresso, chips, proposta com «Porquê assim».
- Treino guiado: dock kg×reps com −/+, CTA verde grande, Sair/Pausar 48px, descanso dentro do guiado.
- Folha de Definições (lista clara). Gráfico/recordes do exercício. Contraste `--muted` AA. Limites de largura já existentes (conteúdo 1280, nutrição/perfil 760, guiado 560).
- Botão central da barra = controlo da sessão (iniciar/pausar/retomar) — não mexer.

## Problemas (prioridade = impacto no utilizador)
**P1 — bloqueiam a qualidade percebida**
1. 38 `alert/confirm/prompt` nativos, síncronos (backup, custom, editor, history, media, nav, notify, nutrition, onboarding, profile, state, workout).
2. Alvos <44px confirmados: header timer (−, ⏱60s, +: 30–37px), «+30s», ✕, Editar/Reset, «Fazer treino personalizado» (32px), controlos de Nutrição (~55) e Evolução (~38). *(Codex: Registar/séries/Mais/guiado já cumprem 44–48px.)*
3. Hoje: o aviso «descanso/pendente» vem depois do cartão principal; header fixo ~70px com título + timer sempre visível; lista de exercícios empurra tudo para baixo.
4. Evolução mistura Plano + Perfil (formulário) + Medidas + gráficos; botões do plano parecem chips cinzentos; «Guardar cópia» com o mesmo peso das ações principais.
5. Botões de ação e áreas só-texto parecem iguais (Editar/Reset/Marcar feito/Mais/«Fazer treino personalizado»).

**P2**
6. Sem tema claro nem suave; ~72 hex + ~95 rgba fixos em `index.html` (395 usos de `var(--)`: migração viável); 0 `prefers-reduced-motion`.
7. Cartão de exercício: título e «Séries·Reps» em linhas separadas; bolinhas coladas à esquerda; blocos apertados.
8. Onboarding: tempo só 30/45/60; «Preferes» (equipamento) de escolha única; «Algo a evitar» só 3 zonas; meio do ecrã vazio.
9. Emoji como ícones estruturais (nav, definições, botões); texto 10–11px em 27 declarações (11px×18, 10px×9).

**P3**
10. Acessibilidade estrutural (Codex): `.dot`, `.wk-row`, chips de medidas são `div/span` clicáveis; folha de Definições sem gestão de foco/inert; badge «4» só em pseudo-elemento; erros de perfil só por `alert`; guardar perfil/medidas reconstrói o ecrã e pode apagar rascunho do outro formulário.
11. Guiado: «Terminar treino» discreto (decisão de design, não defeito).

## Proposta visual
Escuro atual = tema base «Escuro». Acrescentar «Claro» e «Escuro suave» como 2 conjuntos de tokens (`data-theme` + `prefers-color-scheme`, escolha em Opções: Auto/Claro/Escuro/Suave). Tokens: cor semântica (`--bg --surface --card --text --muted --primary --danger --ok --warn --border`), espaço 4/8/12/16/24/32, tipo 12/14/16/20/24, raio, alvo 44px, elevação, movimento 150–250ms com `prefers-reduced-motion`. Hierarquia de botões: **primário** (cheio, 1 por ecrã), **secundário** (contorno, ≥44px), **discreto** (ícone/texto com área de toque 44px). Ícones: SVG num só estilo na navegação e ações; emoji só em conteúdo.

## Contraditório do Codex (análise estática) — integrado
| Ponto | Decisão |
|---|---|
| A4/A11 desatualizados (CSS já dá 44–48px a Registar, séries, guiado) | **Aceite**: prioridade 2 reduzida aos controlos realmente pequenos |
| «Sem design system» exagerado (13 tokens + camadas) | **Aceite**: consolidar tokens existentes, não construir de raiz |
| 3 temas multiplicam manutenção | **Parcial**: claro primeiro (B2), suave depois como 3.º conjunto de tokens, só se o claro correr bem |
| Remover lista de exercícios do Hoje tira a modalidade «registar sem guiado» | **Aceite**: mantém-se, recolhida por defeito sob «Ver exercícios e registar»; aviso antes do hero |
| Título e séries·reps lado a lado competem a 320px; `ex.s` admite texto | **Aceite**: lado a lado com quebra automática; bolinhas flex com largura máxima |
| «Preferes» já combina equipamentos; 90/120 exigem regras no planner | **Aceite**: multi-escolha só onde o motor combina; 90/120 + novas zonas = mexer em `planner.js`/`EX_BY_MINS`/`normalizePrefs` e testes |
| Ícone de treino → ecrã principal é mudança funcional (`navMain` controla sessão) | **Aceite**: interpretar como o logótipo «💪 Treino» do header → Início; botão central intacto. **A confirmar com o utilizador** |
| B2: já há `history.toast()`/`app-notice`; Promise sem `await` passa como verdadeira | **Aceite**: reutilizar o toast; modal só para confirmações destrutivas; validações inline; revalidar contexto após `await`; impedir duplo toque |
| B3: tirar medidas da Evolução quebra proximidade dados↔resultados | **Aceite**: medidas ficam na Evolução; só Plano + Perfil saem |
| Ícone de cópia isolado perde clareza | **Aceite**: ícone com nome acessível e rótulo curto |
| Extras: semântica (`div`→`button`), foco/inert na folha, validação junto ao campo, rascunhos, `reduced-motion`, nome acessível do badge | **Aceites** (bloco próprio) |
| Riscos: bridge.js, `sw.js` CORE/CACHE, testes dependem de classes/textos/`dialog`, `ST.view/ST.day`, IDs `card-/w-/r-` | **Aceites** como critérios de cada bloco |

## Plano em blocos pequenos (demo local no fim de cada um)
1. **Tokens + alvos + movimento**: consolidar `:root`, migrar cores fixas, 44px nos controlos pequenos, `prefers-reduced-motion`, hierarquia primário/secundário/discreto, header compacto, logótipo → Início.
2. **Tema claro** (+ seletor em Opções, `theme-color`); depois, se ok, **Escuro suave**.
3. **Diálogos próprios**: 3a confirmações destrutivas (modal assíncrono + revalidação), 3b alertas → toast/inline, 3c `prompt` → campos.
4. **Hoje**: aviso primeiro, lista recolhível, custom secundário legível.
5. **Cartão de exercício**: título | séries·reps, bolinhas distribuídas, mais respiro (preservar IDs/`refreshCard`).
6. **Plano e Perfil fora da Evolução** (ecrã próprio via Opções; cópia como ícone junto a «O meu plano»; medidas ficam).
7. **Acolhimento**: 90/120 min, equipamento multi-escolha, mais zonas a evitar + «Nenhuma» (planner + testes).
8. **Acessibilidade estrutural**: botões reais, foco/inert na folha, validação inline, rascunhos.
9. **Verificação final**: Playwright 320/360/390/412/1280 × temas, toque, teclado, reload, sessão ativa; 8 suites verdes.

Limitação desta auditoria: sem teste com leitor de ecrã real; estados de erro/diálogo e sessão interrompida avaliados no código, não capturados.
