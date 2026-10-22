# Pendências V2 (atualizado 2026-10-22)

## Acolhimento — corrigido localmente (2026-10-23), por validar pelo dono
Equipamento multi-escolha (`equip`, compatível com `pref`), durações 30–120 min (volume não sobe só por haver tempo), zonas a evitar + «Nenhuma» exclusiva. Testes: `test:plan` (2700 combinações), `test:onb-choices`. `sw.js` treino-v32.

## Contraditório independente do Codex (pendente)
- Bloco 4: o contraditório do Codex ao plano e à implementação **não ocorreu** (chamada bloqueada pelo classificador de permissões; não foi repetida nem contornada). Implementado e verificado só pelo Claude.
- Acolhimento: o plano e a implementação não foram revistos pelo Codex (2.ª chamada também bloqueada pelo classificador). Pendente: revisão independente das tags `avoid` das novas zonas, da regra acesso/preferência e do 7.º exercício opcional (≥90 min, não iniciantes).

## Limitações herdadas (Blocos 2 e 3)
- Contraste do escuro: branco sobre laranja 2,8:1 (base documentada em `scripts/theme-test.mjs`).
- Splash/barra de estado iOS escuros; versões mistas do service worker offline; Safari (data nativa) e impressão por verificar.
- Sem teste com leitor de ecrã real nem em telemóvel físico.
