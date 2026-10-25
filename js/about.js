import { APP_VERSION } from './version.js';
import { confirmDialog } from './dialog.js';
import { closeSheet } from './backup.js';

const label = document.getElementById('appVersionLabel');
if (label) label.textContent = `Versão ${APP_VERSION}`;
let opened = false;
// Depois de repor, a primeira carga pode vir da cache HTTP antiga.
// Aguardar o novo CORE e recarregar uma vez para usar os seus ficheiros.
/* sessionStorage pode não existir ou lançar (armazenamento bloqueado): nunca pode partir o arranque */
const session = (op, key, value) => { try { return typeof sessionStorage === 'undefined' ? null : op === 'get' ? sessionStorage.getItem(key) : op === 'set' ? sessionStorage.setItem(key, value) : sessionStorage.removeItem(key); } catch (_) { return null; } };
if (session('get', 'treino_app_reset') && typeof navigator !== 'undefined' && navigator.serviceWorker) {
  navigator.serviceWorker.ready.then(() => {
    session('remove', 'treino_app_reset');
    location.reload();
  });
}

function workerVersion() {
  const worker = navigator.serviceWorker?.controller;
  if (!worker) return Promise.resolve(null);
  return new Promise(resolve => {
    const finish = value => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener('message', receive);
      resolve(value);
    };
    const receive = e => {
      if (e.source === worker && e.data?.type === 'version') finish(e.data.cache);
    };
    const timer = setTimeout(() => finish(null), 1500);
    navigator.serviceWorker.addEventListener('message', receive);
    worker.postMessage('version');
  });
}
async function serverVersion() {
  try {
    // O SW é cache-first: no-store só contorna a cache HTTP, não CacheStorage.
    const response = await fetch(`sw.js?version=${Date.now()}-${Math.random()}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw Error('servidor');
    return /treino-v\d+/.exec(await response.text())?.[0] || null;
  } catch { return null; }
}
async function checkUpdate() {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (!reg) throw Error('Sem service worker. Reabre a app com ligação à Internet.');
  await reg.update();
  const installing = reg.installing;
  if (installing) await new Promise(resolve => {
    const changed = () => {
      if (['installed', 'activated', 'redundant'].includes(installing.state)) {
        installing.removeEventListener('statechange', changed); resolve();
      }
    };
    installing.addEventListener('statechange', changed); changed();
  });
  if (reg.waiting) { reg.waiting.postMessage('skipWaiting'); return 'A atualizar…'; }
  if (installing?.state === 'redundant') throw Error('Não foi possível instalar a atualização.');
  return 'Já tens a versão mais recente';
}
async function openAbout() {
  if (opened) return;
  opened = true;
  closeSheet();
  try {
    let notice = '';
    while (true) {
      const [worker, server] = await Promise.all([workerVersion(), serverVersion()]);
      const mismatch = (!!worker && worker !== APP_VERSION) || (!!server && server !== APP_VERSION);
      const status = worker && worker !== APP_VERSION ? 'Código e service worker diferentes'
        : server && server !== APP_VERSION ? 'Há versão nova no servidor'
        : !server ? 'sem ligação' : !worker ? 'sem service worker' : 'Atualizada';
      const action = await confirmDialog({ title: 'Sobre',
        message: `Código em execução: ${APP_VERSION}\nService worker ativo: ${worker || 'sem service worker'}\nNo servidor: ${server || 'sem ligação'}\nEstado: ${status}${notice ? '\n'+notice : ''}`,
        cancelLabel: 'Fechar', confirmLabel: 'Verificar atualização',
        ...(mismatch ? { altLabel: 'Repor ficheiros da app' } : {}) });
      if (!action) break;
      if (action === 'alt') {
        if (await confirmDialog({ title: 'Repor ficheiros da app?', message: 'Os teus dados não são apagados', confirmLabel: 'Repor ficheiros da app', danger: true })) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
          await Promise.all((await caches.keys()).map(k => caches.delete(k)));
          session('set', 'treino_app_reset', '1');
          location.reload(); return;
        }
      } else {
        try { notice = await checkUpdate(); }
        catch { notice = 'Não foi possível verificar a atualização. Confirma a ligação à Internet.'; }
      }
    }
  } finally { opened = false; }
}

export { openAbout };
