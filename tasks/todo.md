# Fase 1 — Fundação App ✅

Objetivo: tornar o `index.html` numa PWA instalável no Android, com dados protegidos
(backup), histórico de carga por exercício e ecrã que não apaga durante o treino.
Convenção single-file mantida; PWA exige `manifest.json`, `sw.js`, `icon.svg` à parte.

## Tarefas

### 1. Histórico de séries + gráfico de progressão ✅
- [x] Estado: `ST.log` (`{ [nome]: [{date,w,r}] }`), agregado por nome de exercício
- [x] Helpers: `todayStr`, `getLog`, `logSet` (1 registo/dia, sobrescreve hoje), `est1RM` (Epley)
- [x] UI por exercício (só séries numéricas): input `kg × reps` + Registar + 📈
- [x] Pré-preenche com último registo; valida `w>0 && r>0`
- [x] Gráfico de linha SVG inline (sem libs): evolução do peso + último + 1RM estimado

### 2. Backup export/import JSON ✅
- [x] `exportBackup()` → download `treino-backup-AAAA-MM-DD.json` (estado + rest_sec)
- [x] `importBackup()` → ler, validar estrutura, confirmar, substituir, re-render
- [x] Falha com mensagem clara se ficheiro inválido

### 3. PWA instalável (manifest + service worker) ✅
- [x] `manifest.json` (standalone, cores do tema, ícone)
- [x] `icon.svg` maskable (barbell na safe-zone)
- [x] `sw.js` (precache shell; navegação network-first, assets cache-first; offline)
- [x] `<link rel=manifest>` + apple-touch-icon + registo do SW

### 4. Wake lock (ecrã ligado no treino) ✅
- [x] Toggle nas Definições; persiste preferência
- [x] `acquireWake/releaseWake` com feature-detection
- [x] Re-adquire em `visibilitychange`

### Definições (consolida 2 + 4) ✅
- [x] Botão ⚙ no header → bottom-sheet: manter ecrã ligado, exportar, importar

## Verificação ✅
- [x] `node --check`/`vm.Script` ao script → sintaxe OK (23.769 chars)
- [x] Smoke-test em DOM falso → arranque sem erros, 7 dias, `buildCard` OK
- [x] `logSet`+`loadChart`: SVG + `1RM ~83kg`, overwrite diário (logLen=1), `est1RM(62.5,8)=79`
- [x] `manifest.json` parse OK, `sw.js` syntax OK

## Próximas fases (fora de âmbito desta)
- Imagens → diagramas (mapa muscular + movimento + animado, em slider)
- Nutrição (questionário hábitos/favoritos + metas + sugestões)
- APK via Capacitor (quando alertas em background forem precisos)

## Notas de deploy
- SW exige HTTPS ou localhost. Para instalar no telemóvel é preciso a app servida em
  HTTPS → GitHub Pages: Settings → Pages → "Deploy from a branch" (main / root).
  Não precisa de workflow (o que foi removido no commit 1e4800f por causa de OAuth scope).
