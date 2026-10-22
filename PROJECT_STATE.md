Projeto: myTraining — cartão de exercício simplificado (piloto do orquestrador)
Plano: v1
Atualizado: 2026-10-22
Objetivo: Cartão de exercício mais simples, com o registo do treino igualmente rápido, avaliado pelo utilizador
Próximo passo: validação do proprietário da fatia 1 da V2 (acolhimento + plano + Hoje), em local, sem commit; depois aulas/troca por equivalência

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
### T3.1 · peso 2 · Concluída · Avaliação visual pelo utilizador
- [x] O utilizador experimenta e confirma cartão mais simples e registo rápido | ev: aprovação visual e funcional do utilizador (2026-10-22); main 7bb01c1, testes verdes
### T3.2 · peso 1 · Concluída · Teste de recuperação numa cópia descartável
- [x] Interrupção real: trabalho parcial detetado, repetição sem duplicar, projeto principal intacto | ev: ai-orchestration/evidence/gym1/AVALIACAO_FINAL.md (processo morto em repo descartável, sem modelo; Codex real não testado)

## Decisões
- 2026-10-21 · limite global de 5 chamadas Codex no piloto (plano 1 + implementação 1 + correções ≤2 + 1 reserva operacional) · autorizado pelo utilizador
- 2026-10-21 · «Marcar feito» fica visível mas secundário (Codex propôs mover para «Mais») · é o único atalho de 1 toque e o utilizador pediu ações frequentes rápidas; fácil de mover se não gostar
- 2026-10-21 · aceites da revisão: toggle por addEventListener sem tocar em bridge.js; IDs da carga preservados; Registar ≥44 px; testes ux do cartão e percursos do browser-test adaptados; ex.s/ex.r textuais intactos
- 2026-10-21 · .agents/ e .claude/skills/ (graphify) e todolist_tommorow.md ficam fora de commits

- 2026-10-22 · refinamento visual (Mais/Menos com ícone, hierarquia, espaçamentos) feito diretamente pelo CLAUDE no worktree, 0 chamadas Codex (3 de 5 usadas, 2 de reserva para a falha parcial) · pedido do utilizador; patch separado em ai-orchestration/orch/logs/impl/GYM1/claude_visual_r3.patch; testes smoke/superset/timer/browser/ux verdes

- 2026-10-22 · V2 Fase 0 feita: auditoria, docs/V2_PROPOSTA.md, demo-v2/index.html (simulação), 1 chamada Codex só leitura · aguarda validação do proprietário; nada em produção

- 2026-10-22 · avaliação Neon vs Supabase em docs/V2_ARQUITETURA_NEON_SUPABASE.md; recomendação Supabase (UE), Neon plano B; 1 chamada Codex só leitura; sem contas criadas; Fase 1 independente do fornecedor · aguarda decisão

- 2026-10-22 · V2 fatia 1 implementada localmente (planner, plan, migrate, onboarding, notice; Hoje com cartão); 8 suites verdes; Codex 1 revisão só leitura (9 achados, 8 corrigidos, 1 teste fraco reforçado); implementação feita pelo Claude antes de a regra Codex-implementa existir em ~/.claude/CLAUDE.md · sem commit/push/deploy

## Estacionadas
- Exportação Strava (dúvida sobre ficheiros na app Android)

## Bloqueios
- (resolvido) memória livre insuficiente: fechado o Brave, arrancou à 2.ª tentativa, sem chamada gasta
- 2026-10-21 · implementação não arrancou: RAM livre 912 MB < 1024 MB (guarda do orquestrador); 0 chamadas gastas (1 de 5 usada, a revisão do plano)
## Histórico do plano
- v1 (2026-10-21): plano inicial
