# Fase A — Contas e persistência: riscos, arquitetura e plano (2026-10-26)

Estado: **proposta para aprovação**, já com o contraditório do Codex (revisão estática, só leitura; não executou testes nem verificou preços/RGPD). Nada disto está implementado. Nenhum projeto cloud foi criado.
Base: v52 (`4d2df73`) marcada como V1 (tag `v1-treino-v52`). Ver também `V2_ARQUITETURA_NEON_SUPABASE.md` (avaliação de 2026-10-22, ainda válida) e `ROADMAP.md`.

## 1. Riscos reais do armazenamento atual
Tudo vive numa só chave `localStorage` (`treino_v2`, `JSON.stringify(ST)` a cada `save()`), mais cópias de segurança na mesma origem (`treino_v2_snap`, `treino_v2_premigration`).

| Risco | Evidência | Gravidade |
|---|---|---|
| **Quota do `localStorage`** (≈5 M caracteres; varia por browser, **não medida** neste telemóvel) | **Hipótese, não média medida:** objetos de exemplo ≈380 car./alimento, ≈200 car./treino, ≈61 car./série (podem ter mais campos: `k`, `sid`, `rir`, notas). Com 15 alimentos/dia e 4 treinos/semana daria da ordem de **2 M car./ano de nutrição + 0,5 M de treino**. `_snap` e `_premigration` são cópias integrais mas **não acompanham cada gravação** (`_premigration` é histórica; `_snap` só muda quando pedida): contam uma vez cada, não triplicam sempre. | **Possível em 1–2 anos (a medir)**; se acontecer, será pela nutrição |
| Falha de `save()` por quota | `save()` devolve `false` e mostra aviso; em geral o `ST` em memória fica à frente do armazenamento (o diário já repõe o estado anterior se falhar, `diary-ui.js`, mas nem todos os fluxos) | **Média–alta** (depende do fluxo) |
| Corte dos últimos **300 treinos** (`session.js` `MAX_KEPT`) | Só `ST.workouts` (único corte, `session.js`). Cargas (`ST.log`), medidas e nutrição **não** são cortadas. O espaço poupado é pequeno face à nutrição (a medir); subir o limite **não recupera** treinos já cortados | Média (perde resumos/duração de treinos antigos; as cargas ficam) |
| Dados só num dispositivo | Limpar dados do browser, trocar/perder telemóvel = perda total, a não ser que haja exportação recente | **Alta** |
| Mudança de domínio | `localStorage` é por origem: novo domínio = armazenamento vazio | Alta (só se mudares de domínio sem migração) |
| Atualização do SW | Coberta por `test:sw-update` (dados e sessão preservados) | Baixa |
| Corrupção | `ST` é lido com `try/catch` e migração verificada; cópias premigration/snap existem | Baixa–média |

Conquistas: limites ≤10 dias e `ST.motiv.seen` persistente; o corte de 300 não as altera. Backup (`exportBackup`) exporta todo o `ST` existente.

## 2. Correções pequenas e seguras (não exigem migração; **precisam da tua aprovação**)
1. **Medidor de armazenamento** (soma de `localStorage` em caracteres) em Mais → Dados: aviso a 70 % e pedido de exportação; corrigir `save()` para avisar já na 1.ª falha com «os últimos dados NÃO estão guardados».
2. **Exportação verificável com ensaio de restauro** (contagens e checksum; importar num contexto isolado e comparar) e **lembrete** (data do último backup visível). Descarregar um ficheiro **não prova** que está fora do dispositivo: o lembrete deve pedir para o guardar fora (Drive/email).
3. **Subir `MAX_KEPT`** (ex.: 300 → 2000), opcional e só **depois de medir** o custo real: preserva resumos futuros, não recupera os cortados. A UI «Ver todos (N)» e a nota de retenção mantêm-se.
4. **Adiado (precisa de modelo fechado e medição):** arredondar números nutricionais (poupança **não medida**; antes dizia-se ~30 %) e ids determinísticos.

## 3. Alteração estrutural (exige decisão e plano próprio)
Mover os dados de `localStorage` para **IndexedDB** (sem limite prático de 5 M car.). Só se justificará se a nutrição crescer; **prefiro fazê-lo dentro da Fase A**, já com ids estáveis, e não antes. Requer migração com cópia verificada, testes e reversão.

## 4. Arquitetura proposta (local-first)
- **O dispositivo continua a ser a fonte de verdade offline**; a cloud é uma réplica sincronizada. A app tem de funcionar sem rede, como hoje.
- **Supabase** (região UE: Frankfurt/Irlanda): Auth (OTP/magic link por email; Google opcional) + Postgres com **RLS** (`user_id = auth.uid()` em todas as tabelas) + SDK por CDN (sem build, compatível com a PWA atual).
- **Modelo**: tabelas por entidade com `id uuid`, `user_id`, `updated_at`, `deleted_at` (tombstone), `device_id`, `schema_v`. Registos de histórico (séries, alimentos, medidas, treinos) **também são corrigidos ou apagados** pelo utilizador (`removeSetLog`, edição/remoção no diário): precisam de `version`/`updated_at` e tombstone, e `ON CONFLICT DO NOTHING` **não basta** (ignoraria correções) → upsert com comparação de versão. Documentos editáveis (rotina, perfil, preferências, aulas): **last-writer-wins por documento** com `version`, conflito exposto ao utilizador se divergirem.
- **Sync**: fila local de operações idempotentes (`push`), `pull(since)` por `updated_at`; reexecutável sem duplicar (ids estáveis); falha de rede = fila preservada; adaptador de fornecedor isolado (trocar Supabase por Neon seria só o adaptador).
- **Ids**: `ST.workouts` (timestamp+aleatório), `ST.intake` (`i`+UUID), rotina e exercícios já têm `id`, **mas não são todos UUID** → mapear para o esquema na migração e guardar o id original. **`ST.log` não tem id por entrada.** Um id derivado de `nome|data|índice` é **arriscado** (índices deslocam-se; dois históricos divergentes podem colidir ou duplicar): em A0 só se **define a entidade a identificar**; ids determinísticos ficam para depois, com regras de ambiguidade e fusão testadas.
- **Privacidade**: dados de saúde (art. 9.º RGPD): consentimento explícito, política de privacidade, exportação e eliminação de conta/dados, região UE. **Parecer jurídico não feito.**

## 5. Comparação objetiva (fontes oficiais lidas hoje: supabase.com/pricing e /docs)
| | Supabase Free | Supabase Pro | Neon Free (avaliação de 22/10) | Sem backend (só export/import melhorado) |
|---|---|---|---|---|
| Preço | 0 € | $25/mês (+ compute extra se exceder; *spend cap* ligado por defeito) | 0 € | 0 € |
| BD | 500 MB/projeto; máx. 2 projetos ativos | 8 GB incluídos | 1 GB | — |
| Utilizadores | 50 000 MAU | 100 000 MAU | auth GA | — |
| **Backups** | **não incluídos** | diários, 7 dias | histórico curto (6 h) | os teus ficheiros |
| **Pausa** | **após 1 semana sem atividade** | nunca | suspende compute ao esgotar CU-h | — |
| Ajuste à PWA sem build | documentado (CDN) | igual | SDK documentado com npm | total |
| Esforço | médio | médio | médio–alto (4 incógnitas) | baixo |
| Resolve «perder o telemóvel» | sim | sim | sim | só se exportares |

Não verificado nesta sessão: Firebase (offline embutido, mas NoSQL/Google, lock-in) — só mereceria reavaliação se o sync offline do Supabase se revelar demasiado trabalhoso. Free **não** garante custo nulo para sempre: o Free pausa por inatividade e não tem backups; para dados de terceiros usar Pro ($25/mês) ou exportações agendadas.

**Recomendação:** Supabase UE; **Free apenas para ti + amigos de confiança com dados sintéticos/próprios e exportação regular**; **Pro antes de qualquer utilizador real**. Custo adicional possível: SMTP próprio (a lista de preços inclui «Custom SMTP» no Free, mas o fornecedor de email é à parte — **custo/limites por apurar**).

## 6. Migração V1 → V2 (segura e reversível)
1. **Backup verificável**: exportação JSON + soma de verificação + contagens (treinos, séries, alimentos, medidas); relido e comparado antes de continuar.
2. **Ids**: atribuir ids em falta (determinísticos) num passo local, repetível, com cópia `premigration` já existente.
3. **Conta**: criar/entrar; nada é apagado localmente.
4. **Carregar** (idempotente: `upsert ... on conflict (id) do nothing`) por lotes, retomável após falha de rede.
5. **Verificar**: contagens + hash por entidade no servidor == local. Só então marcar `migrated_at` (não apagar nada local).
6. **Segundo dispositivo**: entra, faz `pull`; se tiver dados locais próprios → assistente de fusão com pré-visualização que distingue **cópia do mesmo histórico** de **registos independentes** (nunca sobrescrever em silêncio).
6b. **Cópia imediatamente anterior à V2:** `_premigration` protege só a 1.ª migração histórica → criar um export verificado novo antes de ligar a conta.
7. **Recuperação**: exportação a partir da cloud e a partir do local; eliminar conta apaga a cloud, não o local.
8. **Domínio**: não mudar enquanto não houver conta e exportação (a origem do `localStorage` muda); decidir domínio **em conjunto** com a Fase A.

## 6c. Lacunas operacionais a definir antes de construir
Consentimento (registo e retirada; efeito no sync e nos dados existentes); eliminação (dispositivos, filas locais, réplicas e backups, sem reenvio posterior); recuperação com email perdido; quota excedida / projeto pausado e retomado (preservar fila, informar, permitir exportar); regras de versão, desempate, retenção de tombstones e cursor de `pull`.

## 7. Testes obrigatórios (da Fase A)
Primeira migração; dois dispositivos a convergir (incl. apagar/reordenar); offline longo + reinício; conflitos; repetição de operações; falha de rede a meio; isolamento RLS entre dois utilizadores (acesso por UUID alheio); recuperação de conta; exportar → apagar → restaurar com contagens iguais; login a partir do GitHub Pages em Safari/iOS; projeto Free não pausa com uso real.

## 8. Primeiro bloco recomendado
**A0 — Segurança local (sem cloud), enxuto:** (1) medidor de armazenamento + aviso na 1.ª falha de gravação; (2) exportação verificável com ensaio de restauro e lembrete; (3) opcional: subir `MAX_KEPT` depois de medir. **Alternativa a decidir em paralelo:** IndexedDB primeiro (capacidade local separada de contas), em vez de ir direto à cloud. Não toca em infraestrutura e é reversível.
Depois **A1 — Spike Supabase com dados sintéticos** (login no Pages/Safari, RLS, 2 dispositivos), só com a tua aprovação.

## Decisões que preciso de ti
1. Aprovar A0 (e a subida de `MAX_KEPT`).
2. Free só para ti (dados próprios, com exportação regular) — **Pro obrigatório antes de qualquer outro utilizador** (Free não tem backups e pausa por inatividade).
3. Autorizar a criação de um projeto Supabase de teste (UE) na A1.
4. Domínio/marca: decidir depois de A1, nunca antes.
