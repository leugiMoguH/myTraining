# Fase 2 — plano dinâmico (Hoje, descanso, substituições)

## Feito
- [x] Motor de progressão (`js/progression.js`) + 14 casos no smoke
- [x] PWA presa na versão antiga: reload no `controllerchange` (`js/app.js`), cache v6

## A fazer

### 1. Agenda (`js/schedule.js`)
- [x] `ST.sched = { week, done:{dia:data}, swaps:{'dia:i':original} }`
- [x] `weekKey()` ISO (semana começa à Segunda) — reset quando muda de semana:
      limpa `ST.sets`, `ST.done`, `ST.sched.done`, repõe os swaps temporários
- [x] `isRest(dia)` — flag `rest` no dia da rotina (Domingo por omissão)
- [x] `dayStatus(dia)` → rest | done | partial | todo
- [x] `currentDay()` — 1º dia de treino da semana ainda não feito (é isto que
      faz o plano deslizar: dia falhado fica pendente, não é saltado)
- [x] `markDone(dia)` / `unmarkDone(dia)`

### 2. Ecrã "Hoje"
- [x] Separadores: 📅 Hoje · 📋 Semana · 👤 Perfil · 🥗 Nutrição (fim dos 7 dias)
- [x] `ST.view` guarda o ecrã; `ST.day` continua a ser um dia real (o progresso
      indexa por `dia:i`)
- [x] Hoje = treino pendente atual + aviso se estiver em atraso
- [x] Dia de descanso sem nada pendente → cartão de descanso
- [x] Semana concluída → 🎉
- [x] Tira de semana (7 chips com estado, clicável)
- [x] Botão ✓ Concluir treino; auto-conclusão quando todas as séries estão feitas
- [x] Editor: interruptor "dia de descanso"

### 3. Substituições
- [ ] Botão 🔄 Trocar no cartão
- [ ] Alternativas: `ex.alt` (texto PT escrito à mão) + catálogo pelo mesmo
      músculo alvo, equipamento diferente
- [ ] "Só esta semana" (guarda o original em `ST.sched.swaps`, reposto no reset)
      vs "Trocar sempre"

### 4. Testes
- [x] smoke: semana nova limpa o progresso, dia pendente desliza, descanso ignorado
- [x] test:browser: Hoje abre, tira de semana navega, concluir treino
- [x] `sw.js`: CORE + versão de CACHE
