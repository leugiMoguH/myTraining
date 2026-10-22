# V2 — Neon vs Supabase (avaliação de 2026-10-22)

Fontes: páginas oficiais lidas nesta data (neon.com/pricing, /docs/auth/*, /docs/data-api/*, /docs/introduction/regions, /docs/manage/backup-pg-dump, /docs/postgres/backup-restore/history-window; supabase.com/pricing, /docs/guides/auth/*, /platform/backups, /platform/going-into-prod, /legal/dpa, /platform/regions). Nada foi instalado nem criado. "NE" = não encontrado/não verificado.

## Comparação
| Critério | Neon Free | Supabase Free |
|---|---|---|
| Email + Google | Managed Better Auth **GA**; Email OTP, Magic Link, Google suportados | Magic link e OTP por defeito; Google OAuth incluído |
| Envio de email | NE (quem envia e limites) | SMTP por defeito só para a equipa (2/h) → **SMTP próprio obrigatório** (30/h inicial) |
| Isolamento | RLS com `auth.user_id()` na Data API (GA/beta da Data API: NE) | RLS + PostgREST, documentação madura; "sem RLS = legível por qualquer role" |
| Dados auth | schema `neon_auth` **na tua BD**, mesma região | região do projeto; auth na região: NE literal (DPA cl. 6.1 sugere que sim) |
| UE | Frankfurt (tudo disponível), Londres (não UE) | Frankfurt, Irlanda, Paris, Estocolmo (Londres/Zurique não são UE) |
| Subprocessadores/DPA | atrás de Trust Center com acesso restrito (não lidos) | DPA lido (SCCs, importador Singapura); PDF de subprocessadores ilegível; política cita PostHog, Vercel, Sentry, Google, AWS… |
| PWA sem build | `neon-js` só documentado com npm/Vite; CORS da Data API NE; "frontend separado do backend" = *coming soon* | `<script>` jsDelivr/unpkg documentado; chamada direta do browser suportada |
| Sync idempotente | Postgres: `INSERT … ON CONFLICT (id)` | igual (PostgREST upsert/RPC) — o protocolo é nosso em ambos |
| Backups | histórico 6 h (conflito com "Instant restore: -" no Free); `pg_dump` sem restrição de plano | **sem backups automáticos no Free**, sem download; `supabase db dump` (CLI) |
| Armazenamento | 1 GB/projeto | 500 MB |
| Ao exceder o Free | **suspende o compute** (CU-h ou egress) até ao período seguinte; >1 GB bloqueia escritas; nada é apagado | **pausa após 7 dias de inatividade**; comportamento ao exceder storage/egress: NE |
| Pago | Launch: consumo (compute $0,106/CU-h; storage $0,35/GB-mês; egress 500 GB incl.), sem mínimo mensal, histórico até 7 d | Pro $25/mês: 8 GB, 100 k MAU, backups diários 7 d, nunca pausa, spend cap por defeito |
| Maturidade | Auth GA; Data API e SDK com estado/versão beta (SDK referido "0.7.0-beta") | produto estabelecido; mais documentação e comunidade |

## Cenários (pressupostos MEUS, não do fornecedor)
Pressuposto: ≈1 MB de dados por utilizador ativo por ano (≈4 treinos/semana × ≈18 séries ≈ 3,7 k linhas/ano × ~150 B com índices + medidas). Upper-bound razoável, a medir com dados reais. MAU ≈ utilizadores ativos.

| Ativos | Dados após 1 ano | Neon Free (1 GB) | Supabase Free (500 MB) | Custo plausível em produção |
|---|---|---|---|---|
| 10 | ~10 MB | cabe | cabe | 0 € (Supabase: confirmar que não pausa) |
| 100 | ~100 MB | cabe | cabe | 0 € no Free; **sem backups no Supabase Free** |
| 1000 | ~1 GB | no limite (escritas bloqueadas) | excede | Supabase Pro $25/mês; Neon Launch: storage ≈ $0,35 + compute (não calculável: CU mínimo e horas ativas NE; 1 CU 24 h/dia = 730 h × $0,106 ≈ $77) |
| 5000 | ~5 GB | excede | excede | Supabase Pro $25 (8 GB incluídos, <100 k MAU); Neon Launch: storage ≈ $1,75 + compute variável |

Limite que parará primeiro: **armazenamento** (não MAU). Emails de login/SMTP: custo do fornecedor de email NE. Egress: sync inicial ~1 MB por dispositivo; irrelevante nestes volumes.

## Contraditório Codex (1 chamada, só leitura)
- A comparação é frágil em: auth a partir de github.io (cookies de terceiros, Safari, redirecionamentos OAuth, renovação de sessão) — **não provado em nenhum dos dois**; CORS/GA da Data API da Neon; região da BD ≠ conformidade RGPD (subprocessadores, suporte, telemetria, base legal para dados de saúde); MAU não mede carga.
- Escolheria Supabase pela integração documentada sem build; Free só para validar, Pro como orçamento de produção + SMTP; decidir volumes por medição.
- Testes baratos: login a partir do GitHub Pages (Safari, cookies de terceiros bloqueados); dois utilizadores a tentar aceder a UUIDs alheios; dois dispositivos offline a convergir; fila preservada após reinício e indisponibilidade; exportar → apagar → restaurar numa BD vazia.
- Fase 1: UUID por entidade e por operação; migração versionada e repetível que nunca regenera UUIDs; domínio e exportação neutros com adaptador de fornecedor separado, versões, conflitos explícitos e tombstones (upsert por UUID sozinho não impede sobrescritas antigas).
- Decisão minha: aceite na íntegra. Concordo e acrescento: o ganho de custo da Neon é plausível mas **não demonstrado**; o de simplicidade/maturidade do Supabase está documentado.

## Recomendação
**Supabase (região UE Frankfurt ou Irlanda) como primeira escolha; Neon como plano B revisitável.**
1. Simplicidade: único SDK por CDN, sem build, auth + RLS + API documentados. Na Neon, a combinação Auth + Data API + SDK sem bundler + auth cross-domain tem 4 incógnitas.
2. Custo: igual (0 €) até ~100 utilizadores; depois Supabase Pro é fixo e previsível (≈23 €/mês, inclui backups). Neon pode ser mais barato, mas o custo de compute é imprevisível e não o consegui estimar sem inventar.
3. Segurança: ambos têm RLS; o Supabase Free **não tem backups** → com dados reais de terceiros, ir para Pro (ou exportar `db dump` agendado). Na Neon Free o compute suspende-se ao esgotar CU-h — indisponibilidade de produto.
4. Migração futura: ambos Postgres. Login sem palavra-passe → migrar utilizadores = novo OTP por email. Só muda a função de RLS (`auth.uid()` vs `auth.user_id()`) e o cliente; isolar num adaptador.
5. Para teu uso + poucos amigos: Free chega; usa-o só com dados sintéticos até validar os testes abaixo.

## Fase 1 independente do fornecedor (regras)
1. UUID persistente por exercício, dia da rotina, sessão, série, medida e operação; nomes e `dia:índice` só apresentação.
2. Migração versionada, idempotente, que preserva o original (guardado) e nunca regenera UUIDs; ambiguidades marcadas, não inventadas.
3. Modelo de domínio + exportação JSON neutros; sync atrás de um adaptador (`push(ops)`/`pull(since)`); operações com versão, tombstones e conflitos explícitos.

## Por validar na prática (exige criar contas — não feito)
1. Login OTP/Google a partir do GitHub Pages em Safari/iOS e com cookies de terceiros bloqueados (Supabase; se falhar ou para comparar, Neon).
2. Isolamento entre dois utilizadores (RLS) com tentativas de acesso por UUID.
3. Convergência de dois dispositivos offline, incluindo apagar e reordenar.
4. Que o projeto gratuito não pausa com uso real e como a app comunica indisponibilidade.
5. Exportar → apagar conta → restaurar em BD vazia, contagens iguais.
6. Região da auth/subprocessadores: ler o PDF de subprocessadores (Supabase) e pedir acesso ao Trust Center (Neon); parecer jurídico sobre dados de saúde (art. 9.º RGPD).
7. Entrega de email: escolher SMTP e medir limites reais.
8. Se Neon: CORS e GA da Data API, `neon-js` ou `postgrest-js` por bundle local vendorizado, cookies cross-domain.
