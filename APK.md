# Gerar APK Android (Capacitor)

> A app já é instalável como **PWA** (Chrome → "Adicionar ao ecrã principal"). O APK só é
> preciso se quiseres um ficheiro `.apk` instalável / publicável ou notificações nativas mais
> robustas em segundo plano. O empacotamento corre **na tua máquina** (precisa de Android Studio).

## Pré-requisitos (uma vez)
- **Node.js** (já tens) e **Android Studio** instalado (com Android SDK + um device/emulador).
- Java JDK 17 (vem com o Android Studio recente).

## Passos

```bash
# 1. instalar dependências (Capacitor)
npm install

# 2. copiar a app para www/ e criar o projeto Android (1ª vez só)
npm run android:add

# 3. sempre que mudares o index.html / assets, ressincroniza:
npm run android:sync

# 4. abrir no Android Studio para correr/gerar o APK
npm run android:open
```

No Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
O APK fica em `android/app/build/outputs/apk/debug/app-debug.apk`.
Alternativa por linha de comandos (dentro de `android/`): `./gradlew assembleDebug`.

## Notas
- `webDir` é `www` (gerado por `npm run build:www` — copia `index.html`, `manifest.json`,
  `sw.js`, `icon.svg`, `favicon.svg`, `images/`). Ver `capacitor.config.json`.
- `appId`: `pt.hugo.treino` — muda em `capacitor.config.json` se quiseres.
- `www/`, `android/` e `node_modules/` estão no `.gitignore` (não vão para o repo).
- As **demos** dos exercícios vêm de uma CDN (internet na 1ª utilização; depois o service
  worker guarda-as para offline). O resto da app é 100% local.

## Plugins nativos opcionais (melhorias futuras)
- `@capacitor/local-notifications` → alarmes de descanso/hidratação fiáveis em segundo plano.
- `@capacitor/keep-awake` → manter o ecrã ligado de forma nativa durante o treino.
- `@capacitor/preferences` → guardar o estado em armazenamento nativo (em vez de localStorage).
