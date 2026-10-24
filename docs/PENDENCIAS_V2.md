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
- Strava: `docs/STRAVA_VIABILIDADE.md` (prova só local; nada enviado). Próximo passo: o dono verifica no Mi Fitness (envio de musculação ao Strava, FC, Health Connect).

## Bloco 6 — Plano, Perfil e Evolução (2026-10-24)
- Evolução (`__perfil`, aba): exercícios com recordes (8 + «ver todos»), medidas (registo e histórico recolhidos), mapa muscular, volume. Plano (`__plano`) e Perfil (`__eu`) via Opções; atalho no Hoje. SW `treino-v35`. Testes: `test:b6`.
- Rascunhos: dados pessoais e medidas ficam em memória durante a navegação (perdem-se ao recarregar a página); a edição das preferências (acolhimento) persiste em `ST.onb.draft` + `ST.onb.editing` (retomar/descartar).
- Alterar preferências cria nova proposta; só muda o plano ao confirmar (não há gravação direta de preferências).
- Codex: plano e diff revistos (4 achados do diff corrigidos). Limitações: Evolução continua longa (mapa/volume no fim); ícones são emojis (convenção da app); sem teste em telemóvel físico.

## Bloco 8 e 9 (2026-10-24) — acessibilidade e validação final, publicados (SW treino-v37)
- Feito: semântica (chips, pontos, linhas da semana → button), `js/overlay.js` (foco, inert por contagem, Tab preso, Esc só na camada de cima) em Definições, ficha, catálogo e scanner (câmara parada, também se a resposta chegar tarde); rascunhos persistentes (`treino_drafts`); contraste AA (`--on-accent`); backup recusa estrutura corrompida; app arranca com localStorage indisponível; `onerror` do GIF corrigido (aspas). Testes: `test:a11y`, `test:drafts`, `test:journeys`.
- Decisão: sem Esc no acolhimento (equivaleria a «Sair» num fluxo retomável); o guiado não fecha com Esc.
- Por validar (não verificável localmente): telemóvel físico, leitor de ecrã real (anúncios, ordem de leitura), Safari/iOS (splash, barra de estado, data nativa). Não há declaração de conformidade WCAG integral.
- Aberto (menor): fechar duas folhas fora de ordem (ex.: Definições→catálogo, fechar Definições primeiro) pode deixar o foco em body; não alcançável pela UI atual.
- Aberto (menor): nomes de exercício com apóstrofo no `onerror` do GIF (`esc()` → `'` decodificado no atributo).
