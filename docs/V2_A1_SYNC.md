# A1 — Sync experimental com Supabase: decisão de arquitetura

Estado: **desenho fechado 2026-10-27** após contraditório de Opus (arquitetura) e Codex (leitura). Protótipo isolado em `proto/sync/` + `supabase/migrations/`; **não** entra no `sw.js`, no `app.js` nem na produção; nunca lê nem escreve `treino_v2`. Só dados fictícios.

## 1. Escolha: A — estado completo por utilizador, revisão com CAS, conflito explícito
Registos individuais (B) rejeitados nesta fase: `ST.log` sem id por entrada, ids antigos não-UUID, exigem fila de operações (IndexedDB) e migração de formato. Não são precisos para provar os 8 requisitos.

- `user_state(user_id pk, rev, schema_v, state text, state_hash, push_id, device_id, updated_at)`: uma linha por utilizador. **`state` é `text`** (JSON canónico escrito pelo cliente): `jsonb` reordenaria chaves (ex. dias da rotina) e normalizaria números.
- **Escrita = CAS atómico**: `UPDATE ... WHERE rev = :base`; 0 linhas ⇒ conflito. 1.ª escrita = `INSERT` (PK ⇒ já existe). Trigger: `rev = old.rev+1`, `user_id` imutável, `updated_at`; arquiva a revisão anterior em `user_state_history` (trigger `SECURITY DEFINER`, `search_path` fixo; cliente só lê).
- **Só chaves de topo explicitamente listadas sincronizam** (`SYNCED_KEYS`). Ficam locais: `meta` (deviceId), `view`, `day`, `hx`, `session` (treino vivo), `sets`, `done`, `adapt`, drafts. Evita conflitos permanentes e dois dispositivos a mexer na mesma sessão.
- **Divergência por chave de topo (3 vias por hash)**: o dispositivo guarda `base_hashes` por chave (≈KB). Só um lado mudou ⇒ aceita-o (inclui eliminações); ambos mudaram de forma diferente ⇒ **conflito dessa chave**. **Sem fusão dentro de uma chave** (nem por id, nem por data) — risco de incoerência entre `log/workouts/sessions`. Resolução **explícita pelo utilizador**, por chave: `mine`, `theirs` (só após cópia A0 verificada) ou `union` (só chaves-array com `id` únicos; ressuscita eliminados, avisado). Fusão automática por id = próxima etapa, se os conflitos reais o justificarem.
- **Repetição idempotente**: antes de enviar grava-se `inflight={push_id, base_rev, snapshot_hash, user_id}`; `push_id` vai na linha e no histórico. Resposta perdida ⇒ repetir; se o CAS falhar, procura-se o `push_id` na linha/histórico ⇒ já aplicado (não duplica, sem falso conflito).
- **Congelar tentativa**: estado, conta, rev e geração local capturados antes do 1.º `await`; no sucesso a base passa a ser o snapshot enviado; se houve gravações entretanto, mantém `dirty`.
- **Isolar contas**: `proto_sync_meta` (envelope único: `user_id, base_rev, base_hashes, dirty, inflight`) liga-se a um `user_id`; outra conta ⇒ recusa até associação explícita. Sem base válida nunca se infere eliminação.
- **Schema**: remoto com `schema_v` > local ⇒ pull e push bloqueados. Aplicar o remoto = gravação verificada (A0) com cópia antes. Import/rollback local = divergência total, aviso explícito.
- **Auth**: GoTrue REST por `fetch`, sem SDK; anon key pública; refresh serializado; sessão em `proto_sync_session`; `service_role` nunca no browser/repo.

## 2. Retenção (300 treinos / 200 sessões — `session.js`, `custom.js` ×2, `adapt.js`)
Cortes locais são **apagamentos** para a fusão: sincronizar propaga-os à nuvem e aos outros dispositivos. **Pré-requisito do sync real:** suspender os cortes nas chaves sincronizadas (limite só de apresentação) ou arquivar o que sai; subir o limite só adia. A nuvem não recupera o que já foi cortado.

## 3. IndexedDB
Não necessário para o sync (estado inteiro em `localStorage`; `dirty`+base ≈ KB; sem fila de operações). Um envelope único evita que estado/base/dirty divirjam. Capacidade continua a ser decisão de A0.

## 4. Testes (mesma matriz em dois motores)
1. **PGlite** (Postgres real em WASM, sem Docker): SQL real das migrações, roles `anon`/`authenticated` sem superutilizador, `request.jwt.claims`; prova SQL/RLS/triggers, **não** GoTrue/JWT/PostgREST.
2. **Remoto** (projeto Supabase de teste): a mesma matriz por REST com JWT reais de duas contas. Só isto prova segurança efetiva.

## 5. Limites assumidos
Push de estado completo; chave em conflito não funde; Free pausa por inatividade e não tem backups; confirmação de e-mail do Free é limitada ⇒ projeto de teste com confirmação desligada e contas descartáveis.
