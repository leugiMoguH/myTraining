# myTraining V2 — Auditoria e proposta (Fase 0)

Data: 2026-10-22. Demonstração: `demo-v2/index.html` (simulação, dados fictícios).
Ver: `npm start` → http://localhost:8000/demo-v2/

## A. Estado atual (verificado no código)
- PWA estática, 35 módulos ES, sem build. `npm run smoke` OK (35 módulos, 12 ecrãs, 91 handlers).
- Estado todo num objeto `ST` em localStorage `treino_v2` (`js/state.js`). Sem backend, sem contas.
- Já existe: rotina editável, agenda "primeiro dia por fazer", sessão guiada com máquina de estados, cargas/séries/PR, progressão por regras, treino personalizado, catálogo de 1324 exercícios, troca de exercício (`replaceExercise`), perfil/medidas, nutrição básica (calcTargets, mealPlan, Open Food Facts), notificação de descanso, backup JSON/CSV, Capacitor configurado (sem pasta `android/`).
- Não existe: acolhimento, conta/sync, aulas, padrões de movimento nos exercícios, adaptação por falta/retoma, conquistas, lembretes de treino, PortFIR.
- Fragilidades que condicionam a V2: chaves por `dia:índice` e por nome de exercício; `save()` ignora erros; sessões concluídas limitadas a 300; localStorage = sem esquema versionado para sync.

## Classificação dos requisitos
| Requisito | Estado | Nota |
|---|---|---|
| Treino guiado, cargas, histórico, PR, retoma, backup, offline | JÁ EXISTE | preservar |
| Troca de exercício | MELHORAR | hoje por texto/catálogo; passar a padrão de movimento + músculos + equipamento |
| "Pouco tempo" 15–20 min | NOVO | regra: 3 compostos do dia |
| Progressão de carga | MELHORAR | `progression.js` já tem regras; ligar a sugestões explicadas |
| Perfil/objetivos/calendário editáveis | MELHORAR | `profile.js` existe; falta objetivos e disponibilidade |
| Acolhimento | NOVO | 5 ecrãs + proposta |
| Motor de planos (modelos) | NOVO | começar com 2–3 modelos |
| Aulas | NOVO | eventos manuais |
| Adaptação (falta, retoma, regresso) | NOVO | só sugestões, utilizador decide |
| Contas + sync + RGPD | NOVO | Fase 1 técnica |
| Conquistas / lembretes | NOVO | depois de sync |
| Nutrição nível 1 | MELHORAR | trocar dados inventados por PortFIR verificado |
| Nutrição nível 2/3 | FUTURO | nível 3 só com nutricionista/jurídico |
| Lojas Android/iOS | FUTURO | Capacitor já preparado |

## C/D. Propostas e contraditório (resumo; Codex concorda nos pontos 1–4)
1. **Identidade estável antes de sync (indispensável).** Dar UUID a exercícios, dias e sessões; nome/`dia:índice` passam a ser só apresentação. Sem isto, sync e substituição corrompem histórico. *Aceite do Codex.*
2. **Sync por eventos, não por JSON inteiro (indispensável).** "Última gravação ganha" sobre `ST` perde dados. Fila local de operações idempotentes + tabelas separadas (sessões, séries, medidas). *Aceite.*
3. **Começar com 2–3 modelos de treino, não 5–8 (reformulado).** Pedido era "idealmente 5 a 8"; propomos 3 (corpo inteiro A/B/C com 2–4 dias) e crescer com uso real. Benefício: menos regras para testar; risco: menos variedade. *Aceite parcialmente do Codex (ele sugere 2).*
4. **Aulas como eventos manuais primeiro (aceite).** Estados planeada/feita/cancelada/substituída.
5. **Adiar push e gamificação para depois da sync (reformulado).** Push iOS só funciona com a app instalada no ecrã principal (iOS ≥16.4) e pede autorização após toque; em Android a PWA funciona. Lembretes locais (app aberta) primeiro; conquistas calculadas do histórico (sem estado novo).
6. **Acolhimento retomável, 5 ecrãs, tudo saltável, medidas só quando a nutrição as pedir.** Sem diagnósticos médicos.
7. **Nutrição: adultos apenas na 1.ª versão**, estimativa com método e pressupostos visíveis, e bloqueio educado para gravidez/menores/doença/perturbação alimentar. Codex avisou que o `mealPlan` atual (depende do objetivo) tem de ser revisto antes de dizer "só educação".
8. **Não rejeitado:** nada do pedido foi omitido; apenas calendarizado.

## E. Arquitetura e custos
Valores de fontes secundárias; **confirmar nas páginas oficiais antes de decidir**.

| Opção | Custo inicial | Com crescimento | Prós | Contras |
|---|---|---|---|---|
| **A. Só PWA local (atual)** | 0 € | 0 € | simples, privado | sem contas nem sync — não cumpre o pedido |
| **B. PWA + Supabase (recomendada)** | Free: 0 € (limites ~500 MB BD, 50 k MAU; projetos gratuitos podem pausar por inatividade) | Pro ≈ 25 USD/mês (≈ 23 €) quando houver utilizadores reais | Postgres + login por código/ligação + RLS (isolamento por utilizador) já feitos; export/apagar simples; SQL portável | dependência de fornecedor (mitigada: Postgres normal) |
| C. PWA + Firebase | Spark 0 € | pay-as-you-go | sync offline embutido | NoSQL, lock-in maior, RGPD/região a validar |
| D. Cloudflare (Workers + D1) | 0 € no plano gratuito | barato | já conheces; custo baixo | auth, sync e isolamento por utilizador teriam de ser construídos e testados por nós — mais superfície de erro de segurança |

- **Alojamento do site:** manter GitHub Pages (0 €). Astro não é necessário: a app é uma PWA, não um site de conteúdo; reescrever em framework não traz benefício agora. Cloudflare só se precisares de domínio próprio/Workers.
- **Email de login:** SMTP próprio (ex. Resend/Brevo) — o SMTP por defeito do Supabase tem limite baixo; planos gratuitos costumam bastar no início (verificar).
- **Login Google/Apple:** Google gratuito; Apple exige conta Apple Developer. Só se for para lojas.
- **Domínio próprio:** ~10 €/ano (opcional, recomendado para emails).
- **Lojas (Fase 6, não agora):** Google Play 25 USD uma vez; Apple Developer 99 USD/ano. Capacitor sem custo.
- **Custo mínimo estrito para a V2 funcional:** 0 € até haver utilizadores além de ti/amigos; ≈ 23 €/mês se o projeto gratuito pausar ou crescer. Sem IA externa, sem APIs pagas.
- **Dados de saúde (RGPD):** hospedar em região UE (confirmar disponibilidade na criação do projeto), RLS em todas as tabelas, sem analytics de terceiros, exportação e apagar conta em 1 ação, logs sem dados pessoais. Parecer jurídico sobre art. 9.º antes de abrir a terceiros (tu sozinho = tratamento pessoal).
- **PortFIR (INSA):** coordenado pelo INSA/GS1, TCA com 1149 alimentos e 43 componentes (edição 2016; atualizações referidas em 2025). **Condições de licença e formato de descarga NÃO confirmados** — passo 1 da Fase 5: contactar INSA/ver portfir.insa.min-saude.pt antes de incorporar. Open Food Facts (ODbL) serve para produtos embalados.

## F. Roadmap (sem prazos; cada fase entrega algo utilizável)
1. **Base de dados fiável.** UUIDs, esquema versionado, migração idempotente do `treino_v2`, exportação verificada, erros de gravação visíveis. *Aceite:* histórico atual idêntico após migração (teste com cópia real); suites existentes verdes.
2. **Contas + sync.** Supabase UE, login por código, RLS, fila offline, export/apagar. *Aceite:* dois dispositivos sem duplicar sessões; utilizador A não lê B (teste); offline OK; apagar conta remove tudo.
3. **Acolhimento + perfil + 3 modelos de plano.** *Aceite:* utilizador novo chega ao "Hoje" com plano em ≤5 ecrãs; alterar objetivo atualiza proposta; nada reaparece após concluir.
4. **Aulas, troca por padrão de movimento, "pouco tempo", adaptação por regras.** *Aceite:* aula substitui/complementa sem duplicar; equipamento ocupado dá equivalente do mesmo padrão; falta → sugestão recusável.
5. **Nutrição nível 1 com PortFIR** (após confirmar licença).
6. **Conquistas e lembretes** (opcionais, com limites).
7. **Lojas** só se houver procura.
8. **Smartwatch (futuro, não iniciado).** Nível 1 sincronização pós-treino via Health Connect (Android/APK) · nível 2 acompanhamento no relógio · nível 3 controlo/reconhecimento. Viabilidade e primeira experiência a validar em `docs/SMARTWATCH_VIABILIDADE.md`. *Aceite da 1.ª experiência:* 5 treinos reais com FC associada à sessão certa, sem duplicados.

## H. Relatório Codex
1 chamada, só leitura (plano limitado). Pontos aceites: sync por eventos, identidade estável, migração preservando original e marcando ambiguidades, adaptação com explicar/recusar/desfazer, 2 modelos iniciais, adiar push/gamificação/lojas, RGPD como hipótese jurídica a validar (não "consentimento resolve"). Discordância parcial: Codex sugere IndexedDB já; adiar até Fase 2 (localStorage chega para o volume atual, migrar quando o sync exigir).
