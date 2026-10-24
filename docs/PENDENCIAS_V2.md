# Pendências V2 (atualizado 2026-10-24)

## Acolhimento — corrigido localmente (2026-10-23), por validar pelo dono
Equipamento multi-escolha (`equip`, compatível com `pref`), durações 30–120 min (volume não sobe só por haver tempo), zonas a evitar + «Nenhuma» exclusiva. Testes: `test:plan` (2700 combinações), `test:onb-choices`. `sw.js` treino-v32.

## Acolhimento — 2.ª correção (2026-10-24), por validar no telemóvel
- Perfil antigo só com `pref` passa a `equip=[pref]` (antes ativava as 3 opções); as outras ficam à escolha no ecrã. O rascunho/plano/histórico guardados não são reescritos ao abrir.
- Em casa sem equipamento indicado: só peso corporal; pesos livres só se o utilizador marcar «Pesos livres» (sem pergunta nova; uma nota no ecrã explica). Se a escolha não tem exercício para um padrão (ex.: limitações), usa-se o restante equipamento realmente disponível (nunca pesos livres/máquinas em casa sem confirmação).
- `sw.js` treino-v33; `npm run test:sw-update` prova que dados, sessão em curso e descanso sobrevivem à subida v32→v33.
- `test:onboarding` fixa o relógio numa quarta (falhava ao sábado/domingo: semana «concluída», sem cartão Hoje).

## Limitação: zonas corporais
As exclusões por limitação (`avoid` em `js/planner.js`) são **conservadoras e não são garantia de segurança clínica**; as regras por zona (joelhos, costas, ombros, ancas, punhos, cotovelos, pescoço) **precisam de revisão por profissional** antes de serem apresentadas como seguras. Sem sistema de avaliação médica no âmbito.

## Contraditório independente do Codex (pendente)
- Bloco 4: o contraditório do Codex ao plano e à implementação **não ocorreu** (chamada bloqueada pelo classificador de permissões; não foi repetida nem contornada). Implementado e verificado só pelo Claude.
- Acolhimento: o plano e a implementação não foram revistos pelo Codex (2.ª chamada também bloqueada pelo classificador). Pendente: revisão independente das tags `avoid` das novas zonas, da regra acesso/preferência e do 7.º exercício opcional (≥90 min, não iniciantes).

## Limitações herdadas (Blocos 2 e 3)
- Contraste do escuro: branco sobre laranja 2,8:1 (base documentada em `scripts/theme-test.mjs`).
- Splash/barra de estado iOS escuros; versões mistas do service worker offline; Safari (data nativa) e impressão por verificar.
- Sem teste com leitor de ecrã real nem em telemóvel físico.

## Bloco 5 — cartões de exercício (2026-10-24), publicado; por validar no telemóvel
- Cabeçalho nome | séries×reps, séries em colunas iguais, série atual destacada, ARIA (`aria-pressed`, «Série N, próxima»). Testes: `test:cards`. SW `treino-v34`.
- Fim de semana: plano novo sem nada feito já não diz «Semana concluída» (`test:hoje-semana`).
- Revisão Codex ao plano e ao diff: feita (3 achados corrigidos). A revisão independente do B4/acolhimento continua pendente.
- Limitações: 6 séries a 360px ficam 3+3 (regra por largura do cartão); grid 1280px estica cartões (pré-existente); sem teste em telemóvel físico.

## Roadmap
- Smartwatch: `docs/SMARTWATCH_VIABILIDADE.md`.
