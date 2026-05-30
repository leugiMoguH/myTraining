// Copia os ficheiros estáticos da app para www/ para o Capacitor empacotar no APK.
// Cross-platform (Node 16.7+). Corre via: npm run build:www
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';

const OUT = 'www';
const ASSETS = ['index.html', 'manifest.json', 'sw.js', 'icon.svg', 'favicon.svg'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let copied = 0;
for (const a of ASSETS) {
  if (existsSync(a)) { cpSync(a, `${OUT}/${a}`, { recursive: true }); copied++; }
  else console.warn('aviso: não encontrado, ignorado:', a);
}
console.log(`www/ pronto (${copied} itens copiados).`);
