Projeto: myTraining — cartão de exercício simplificado (piloto do orquestrador)
Plano: v1
Atualizado: 2026-10-21
Objetivo: Cartão de exercício mais simples, com o registo do treino igualmente rápido, avaliado pelo utilizador
Próximo passo: o utilizador avalia a versão refinada em http://localhost:8011 (:8010 = antes)
Decisão necessária: aceitar ou pedir ajustes ao cartão

## Sucesso
- Cartão fechado mostra só o essencial para registar; o resto fica em «Mais»
- Séries, carga+Registar e Marcar feito continuam a 1 toque; dados intactos
- Suites smoke, browser, ux, superset e timer verdes; o utilizador aprova o resultado visual

## E1 — Preparação
### T1.1 · peso 1 · Concluída · Base limpa e plano revisto
- [x] Trabalho pendente guardado em commit local sem dados sensíveis, testes verdes | ev: commit 8d2f9d4 (smoke, superset, timer, browser, ux OK)
- [x] Plano revisto por Codex e integrado | ev: ai-orchestration/orch/pilot/GYM1_plano.json; decisões abaixo

## E2 — Implementação
### T2.1 · peso 3 · Concluída · Codex implementa em worktree isolado
- [x] Alterações só nos ficheiros permitidos, patch guardado | ev: ai-orchestration/orch/logs/impl/GYM1/r2.patch (6 ficheiros, 0 fora do âmbito, ramo codex/GYM1)
### T2.2 · peso 2 · Concluída · Verificação independente do Claude
- [x] Todas as suites verdes e dados intactos, confirmado fora do worktree do Codex | ev: smoke, superset, timer, browser, ux verdes na 2.ª versão; 1.ª versão tinha 3 defeitos (⏱ do cartão com REST_SEC indefinido, já existia antes; Registar a 36 px no estado ✓; teste novo sujava o estado), corrigidos numa ronda

## E3 — Aceitação
### T3.1 · peso 2 · Em validação · Avaliação visual pelo utilizador
- [ ] O utilizador experimenta e confirma cartão mais simples e registo rápido | ev:
### T3.2 · peso 1 · Por iniciar · Teste de recuperação numa cópia descartável
- [ ] Interrupção real: trabalho parcial detetado, repetição sem duplicar, projeto principal intacto | ev:

## Decisões
- 2026-10-21 · limite global de 5 chamadas Codex no piloto (plano 1 + implementação 1 + correções ≤2 + 1 reserva operacional) · autorizado pelo utilizador
- 2026-10-21 · «Marcar feito» fica visível mas secundário (Codex propôs mover para «Mais») · é o único atalho de 1 toque e o utilizador pediu ações frequentes rápidas; fácil de mover se não gostar
- 2026-10-21 · aceites da revisão: toggle por addEventListener sem tocar em bridge.js; IDs da carga preservados; Registar ≥44 px; testes ux do cartão e percursos do browser-test adaptados; ex.s/ex.r textuais intactos
- 2026-10-21 · .agents/ e .claude/skills/ (graphify) e todolist_tommorow.md ficam fora de commits

- 2026-10-22 · refinamento visual (Mais/Menos com ícone, hierarquia, espaçamentos) feito diretamente pelo CLAUDE no worktree, 0 chamadas Codex (3 de 5 usadas, 2 de reserva para a falha parcial) · pedido do utilizador; patch separado em ai-orchestration/orch/logs/impl/GYM1/claude_visual_r3.patch; testes smoke/superset/timer/browser/ux verdes

## Estacionadas
- Exportação Strava (dúvida sobre ficheiros na app Android)

## Bloqueios
- (resolvido) memória livre insuficiente: fechado o Brave, arrancou à 2.ª tentativa, sem chamada gasta
- 2026-10-21 · implementação não arrancou: RAM livre 912 MB < 1024 MB (guarda do orquestrador); 0 chamadas gastas (1 de 5 usada, a revisão do plano)
## Histórico do plano
- v1 (2026-10-21): plano inicial
