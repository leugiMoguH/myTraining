# A0 — dimensão e retenção local

Medição reproduzível: `npm run test:storage-core`, Node 22.23.4, em 2026-10-27.
Dados sintéticos, sem dados pessoais reais: 1.000 dias de cargas de Supino com três
séries por dia, 120 medidas, perfil com altura e 4.000 registos alimentares com nome,
quantidade, energia, proteína e nutrientes. Comparam-se 1.000 e 300 objetos de treino
guiado terminado, mantendo os restantes dados iguais. Não é uma previsão do tamanho
de todos os utilizadores: número de exercícios, metadados e notas mudam o resultado.

| Dimensão de JSON.stringify(ST) | 1.000 treinos | 300 treinos |
| --- | ---: | ---: |
| Caracteres (unidades UTF-16) | 765.646 | 657.146 |
| Bytes UTF-8 | 777.646 | 669.146 |
| Treinos: caracteres / bytes | 154.893 / 154.893 | 46.393 / 46.393 |
| Séries e cargas: caracteres / bytes | 127.686 / 127.686 | 127.686 / 127.686 |
| Alimentação: caracteres / bytes | 478.891 / 490.891 | 478.891 / 490.891 |
| Medidas: caracteres / bytes | 4.095 / 4.095 | 4.095 / 4.095 |
| Restante: caracteres / bytes | 0 / 0 | 0 / 0 |

Cada grupo soma `JSON.stringify` do valor de cada chave pertencente ao grupo.
Por isso não inclui os nomes das chaves de topo, vírgulas e chavetas que entram no
total. A redução nesta amostra é de 108.500 bytes, cerca de 14% do estado completo.
O teste também exporta e verifica ambos os estados sintéticos. Os validadores da
app são substituídos por stubs neste teste do contrato puro; a amostra não afirma
validar o contrato nutricional completo.

Na interface, a dimensão total soma os valores efetivamente lidos de `treino_v2`,
`treino_v2_snap`, `treino_v2_premigration`, `treino_v2_unreadable` e `treino_drafts`.
As cópias locais podem aumentar bastante esse total. A amostra acima tem apenas um
estado, sem essas cópias. Bytes UTF-8 e caracteres são medidas calculadas; não são a
contabilidade interna do navegador. `navigator.storage.estimate()` fornece uma
estimativa separada do armazenamento da origem; não revela o limite real de
localStorage, que continua desconhecido.

## O que o corte faz hoje

- `js/session.js`, `finish`: `MAX_KEPT = 300` limita apenas `ST.workouts`, conservando
  os últimos objetos inseridos ao terminar/descartar uma sessão. Não apaga séries.
- `js/custom.js`, conclusão de personalizado e rápido: `.slice(-200)` limita
  `ST.sessions` aos últimos 200 objetos inseridos.
- Esses cortes não percorrem nem cortam `ST.log`, `ST.measures`, `ST.intake` ou
  `ST.classLog`. Não existe um prazo de conservação global aplicado por estes cortes.

## Consequências verificadas por leitura

- `js/ui.js`, `renderHistory`: a lista de treinos recentes usa `ST.workouts` e
  `ST.sessions`, com deduplicação. Treinos cortados deixam de aparecer com relógio,
  pausas, estado e acesso ao respetivo resumo.
- `js/history.js` usa `sessionsOf`, `recordsOf` e `seriesOf` de `js/records.js`, que
  consultam as cargas em `ST.log`. O histórico por exercício, séries e gráficos de
  cargas não é eliminado pelo limite dos objetos de treino.
- `js/motiv.js`, `completed`, `dates`, `sessionSummary` e `weekSummary`: resumos,
  contagem de treinos e conquistas calculadas dependem dos objetos conservados.
  O fallback de cargas antigas em `dates` só inclui registos sem `sid`, anteriores
  ao primeiro treino conservado; não reconstrói integralmente sessões cortadas
  cujas séries têm `sid`. `sessionSummary` exige encontrar o objeto do treino.
  Assim, manter o log não equivale a manter todos os resumos e contadores.
- Evolução: medidas em `js/profile.js` continuam a vir de `ST.measures`; cargas e
  recordes vêm do log. O cartão da semana de `js/motiv-ui.js` chama `weekSummary`
  e tem a dependência acima dos treinos conservados.
- Semana em `js/ui.js`, `renderWeek`: usa `agenda()` e o progresso/agenda atuais,
  não percorre diretamente `ST.workouts`. O corte não muda as marcas da semana.
  Isso distingue a agenda semanal do resumo semanal de motivação. `js/adapt.js`
  também consulta os treinos conservados para datas de atividade/retoma.

Recomendação: manter a política nesta fase, como pedido, e priorizar backups
verificados fora do dispositivo. A amostra mostra que cortar mais objetos de
treino pouparia apenas uma parte do total, com perda de contexto que o log não
reconstitui. Antes de mudar limites, medir estados reais consentidos, incluindo
snapshots e alimentação, e definir explicitamente que resumos se pretende preservar.
Um backup posterior ao corte não recupera objetos já eliminados; cópias anteriores
podem preservá-los. Nenhuma política de retenção foi alterada neste bloco.
