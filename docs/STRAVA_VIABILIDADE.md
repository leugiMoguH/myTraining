# Strava — prova de viabilidade (2026-10-24)

Só leitura de documentação oficial + ficheiro de exemplo local. **Nada foi enviado ao Strava**, sem conta de developer, sem OAuth, sem dados pessoais.

## A. Formato (confirmado, fontes oficiais)
- Changelog 21-05-2026: upload **JSON limitado a musculação** (`WeightTraining`, `HighIntensityIntervalTraining`, `Workout`, `Crossfit`) e `set` messages em FIT.
- Endpoint: `POST /uploads` (multipart, `data_type=json`, `external_id`, scope `activity:write`). Assíncrono: devolve `id`, depois consulta-se o estado até haver `activity_id`.
- Campos: `version:"1.0"`, `start_time` (ISO 8601 com Z/offset), `utc_offset` (s), `elapsed_time` (s) obrigatórios; `active_time`, `total_calories`, `creator.name`, `streams{time[], active[], heartrate[]}` opcionais; `sets[]` (≥1) com `exercise_type` (lista fixa, ~656 valores), `repetitions`, `weight` (kg), `duration` (s), `start_time`.
- A documentação de uploads e a referência (`swagger.json`) concordam no endpoint; a referência só lista `data_type` genérico e não detalha o JSON — o esquema vive só na página de uploads.
- Não documentado: como o Strava trata duplicados (só diz que há «verificação inicial de duplicados» e que `external_id` deve ser único).

## B. Mapeamento de exercícios (demonstrado)
`scripts/strava-prova.mjs` → `docs/strava-mapeamento.md`. Amostra de 63 exercícios (POOL do planeador, plano original, 20 do catálogo): **34 exatos · 12 aproximados · 15 só genéricos · 2 sem correspondência** («Braços» superset e Caminhada). Todos os tipos usados existem na lista oficial de 656 tipos (verificado em código; a 1.ª extração perdia tipos de uma só palavra, p. ex. `BURPEE` — apanhado pelo Codex e corrigido). A classificação exato/aprox é juízo meu, não do Strava. O catálogo tem 1324 exercícios: **não mapeado inteiro**; proposta futura = tabela `catalogId → tipo` mantida à mão, com fallback `*_GENERIC` e exclusão do que não tem correspondência.

## C. Exportação experimental (demonstrada)
`docs/strava-exemplo.json`: sessão fictícia de 52 min, só séries **feitas** (10 séries; 1 do «Braços» fica de fora por falta de correspondência, avisado), FC a cada 2 min. Validador local (`validar()`) implementa as regras da página de uploads e rejeita versão errada, tipo inexistente, datas impossíveis, `active_time` negativo, streams sem `time`/de tamanhos diferentes/não booleanos, séries que acabam depois da sessão, hora sem fuso. «Pelo menos reps ou duração» e FC 30–230 são regras **locais**, não da doc. Hora do exemplo: Lisboa em UTC+0 a 26-10-2026. **Não é o validador do Strava** — só um upload real o confirma.

## D. Relógio
- Xiaomi Watch S4 → Mi Fitness: grava FC e treino (fonte: páginas Xiaomi).
- Mi Fitness → Strava: existe ligação nativa (Perfil → Dados de terceiros → Strava; FAQs de outros modelos; Xiaomi diz que o S4 suporta Strava). **Não confirmado** que envie musculação nem com FC.
- Mi Fitness → Health Connect: páginas Xiaomi/Google dizem que sim (S4 «suporta Health Connect»). **Não confirmado** que escreva FC contínua de treino.
- Health Connect só é legível por app Android **nativa** (APK Capacitor, que já existe no projeto). A PWA não consegue. iOS/HealthKit idem (nativa).
- Os dados que o Strava mostra não são recuperáveis integralmente pela API (FC de atividades de terceiros: streams só do próprio atleta e sujeito às regras da API); não assumir.

## E. Duplicados (ponto central)
| Pergunta | Resposta |
|---|---|
| Atualizar descrição/nome de atividade existente | **Sim**: `PUT /activities/{id}` (name, description, type, tags, commute, trainer, hide_from_home, gear...) |
| Criar atividade estruturada nova | **Sim**: JSON em `POST /uploads` |
| Acrescentar séries a atividade existente | **Não existe** endpoint público (UpdatableActivity não tem sets/streams) |
| Juntar FC do relógio a um upload | Só **dentro do mesmo JSON** (`streams.heartrate`), enviado por quem o cria |
| Merge no Strava | Suporte Strava: não existe merge nativo; FC de outro serviço não se junta |

Consequência: se o Mi Fitness já enviou a atividade do relógio **e** a myTraining envia o JSON, ficam **duas** atividades. Fusão artificial / API privada: excluídas.

### Alternativas (da mais simples à mais completa)
1. **Só descrição** (zero risco de duplicado se o Mi Fitness criar a atividade): a myTraining escreve o resumo (séries×reps×kg) na `description` da atividade do relógio via `PUT`. Perde mapa muscular/séries estruturadas.
2. **Upload JSON sem FC** + desligar o envio automático do Mi Fitness para este tipo de treino (ou apagar a do relógio): um treino, séries estruturadas, sem FC. Depende de o Mi Fitness permitir excluir por desporto — por confirmar.
3. **Upload JSON com FC** vinda do Health Connect (app Android nativa): uma só atividade completa. Exige APK, Health Connect a receber FC do S4, e desligar Mi Fitness→Strava para musculação.
4. **Exportar o ficheiro** (JSON) e o dono carrega-o manualmente no site do Strava: sem OAuth, sem servidor. Verificar se o site aceita JSON (a doc só descreve o endpoint da API).

## F. Segurança e custos
- OAuth2: a troca de `code` por token exige `client_secret` → **não pode viver na PWA pública**. Mínimo: mini-servidor/função serverless que guarda o segredo (ou APK com o segredo, extraível — só aceitável em modo single-player pessoal). Tokens de acesso duram ~6 h; refresh token guardado fora do repositório.
- Registo da app no painel Strava; **subscrição Strava necessária** para criar a app; começa em **single-player** (só a conta do dono), até 10 atletas por autoatendimento, depois revisão. Limites 200 pedidos/15 min e 2000/dia (uploads têm limite próprio). Base URL muda para `api-v3.strava.com` a 04-01-2027. Há Acordo de API e regras de marca (logo «Powered by Strava»).
- RGPD: FC é dado de saúde; só local + envio explícito do dono ao Strava.

## Contraditório do Codex (2026-10-24, só leitura)
Confirmou: upload ≠ atualização; sem endpoint para juntar séries/FC a atividade existente; OAuth precisa de componente confidencial (APK também não protege o segredo). Corrigiu: (1) a ligação Mi Fitness→Health Connect/Strava do S4 está anunciada pela Xiaomi, mas **exportar musculação com amostras de FC não está demonstrado**; (2) lista de tipos incompleta e 6 classificações otimistas (corrigidas); (3) validador demasiado permissivo (endurecido); (4) num futuro envio faltam `sport_type=WeightTraining`, `external_id` estável, guardar `upload_id`/`activity_id`, acompanhar o estado assíncrono e evitar reenvio; (5) `external_id` sem idempotência garantida. **Recomendação dele: começar pela atividade única do Mi Fitness + resumo em texto na descrição; séries estruturadas só depois de comprovar a FC real e de haver um único emissor.** Aceite.

## Veredicto
- **Séries estruturadas no Strava: viável hoje** (upload JSON, demonstrado só em ficheiro).
- **«Um só treino com séries + FC do relógio» sem intervenção: viável só se o Strava receber o treino por um único caminho.** Isso obriga a (a) desligar Mi Fitness→Strava para musculação e (b) a myTraining enviar tudo, FC incluída → APK nativo + Health Connect + serviço de tokens. Não existe forma oficial de completar a atividade do relógio com séries.
- Melhor alternativa pragmática: **alternativa 4 (ficheiro) ou 2 (upload sem FC)**, e a FC fica no Mi Fitness. Passo seguinte barato: validar com **um** upload manual (conta do dono) de `docs/strava-exemplo.json` ou a decisão do dono sobre aceitar FC em falta.

## Por verificar
1. Mi Fitness envia musculação do S4 para o Strava? Com FC? Dá para excluir por desporto?
2. Mi Fitness escreve FC contínua no Health Connect?
3. Como o Strava deteta duplicados entre `external_id` e atividade do relógio (sobreposição temporal).
4. O site do Strava aceita o JSON por carregamento manual?
5. Rótulos exato/aprox. do mapeamento (revisão do dono).
