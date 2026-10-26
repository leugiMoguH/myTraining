/* Modal único, criado sob demanda. altLabel devolve 'alt'; os outros resultados
   de confirmDialog são true/false. promptDialog devolve texto ou null. */
let active = false;
let sequence = 0;

function openDialog(options, prompt) {
  if (active) return Promise.resolve(prompt ? null : false);
  active = true;
  return new Promise(resolve => {
    const origin = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'app-dialog-bg';
    const card = document.createElement('form');
    card.className = 'app-dialog';
    card.setAttribute('role', options.danger ? 'alertdialog' : 'dialog');
    card.setAttribute('aria-modal', 'true');
    const id = `app-dialog-${++sequence}`;
    const title = document.createElement('h2');
    title.id = id; title.textContent = options.title;
    card.setAttribute('aria-labelledby', id);
    let closeX;
    if (options.closeX) {   /* «X» discreto no canto: 18px visíveis, alvo de 44px */
      const head = document.createElement('div'); head.className = 'app-dialog-head';
      closeX = document.createElement('button'); closeX.type = 'button'; closeX.className = 'app-dialog-x';
      closeX.setAttribute('aria-label', options.closeLabel || 'Fechar');
      closeX.innerHTML = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
      head.append(title, closeX); card.append(head);
    } else card.append(title);
    if (options.message) {
      const msg = document.createElement('p');
      msg.id = `${id}-message`; msg.textContent = options.message;
      card.setAttribute('aria-describedby', msg.id); card.append(msg);
    }
    let input, error;
    if (prompt) {
      const label = document.createElement('label');
      label.textContent = options.label; label.htmlFor = `${id}-input`;
      input = document.createElement('input'); input.id = label.htmlFor;
      input.type = 'text'; input.value = options.value || '';
      input.placeholder = options.placeholder || '';
      error = document.createElement('div'); error.id = `${id}-error`;
      error.className = 'inline-error'; error.setAttribute('role', 'alert');
      input.setAttribute('aria-describedby', error.id);
      input.addEventListener('input', () => { error.textContent = ''; input.removeAttribute('aria-invalid'); });
      card.append(label, input, error);
    }
    const actions = document.createElement('div'); actions.className = 'app-dialog-actions';
    const button = (label, cls, fn) => {
      const b = document.createElement('button'); b.type = 'button';
      b.textContent = label; b.className = cls; b.addEventListener('click', fn);
      actions.append(b); return b;
    };
    let settled = false;
    const previous = new Map();
    const overflow = document.body.style.getPropertyValue('overflow');
    const priority = document.body.style.getPropertyPriority('overflow');
    const focusable = e => e && e.isConnected && !e.closest('[inert]') && !e.disabled && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
    const finish = value => {
      if (settled) return;
      settled = true;
      actions.querySelectorAll('button').forEach(b => { b.disabled = true; });
      if (closeX) closeX.disabled = true;
      document.removeEventListener('keydown', key, true);
      observer.disconnect();
      previous.forEach((v, e) => { if (v === null) e.removeAttribute('inert'); else e.setAttribute('inert', v); });
      if (overflow) document.body.style.setProperty('overflow', overflow, priority);
      else document.body.style.removeProperty('overflow');
      overlay.remove(); active = false;
      const target = focusable(origin) ? origin : [...document.querySelectorAll('button, input, [tabindex]')].find(focusable);
      if (target) target.focus({ preventScroll: true });
      resolve(value);
    };
    const cancel = () => finish(prompt ? null : false);
    const approve = () => {
      if (settled) return;
      if (prompt) {
        const message = options.validate ? options.validate(input.value) : '';
        if (message) { error.textContent = message; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
      }
      finish(prompt ? input.value : true);
    };
    if(input) input.addEventListener('keydown',e=>{ if(e.key==='Enter'){e.preventDefault();approve();} });
    const safe = options.closeX ? null : button(options.cancelLabel || 'Cancelar', 'btn-secondary', cancel);
    if (closeX) closeX.addEventListener('click', cancel);
    if (options.altLabel) button(options.altLabel, 'btn-danger', () => finish('alt'));
    const main = button(options.confirmLabel || 'Confirmar', options.danger ? 'btn-danger' : 'btn-primary', approve);
    card.append(actions); overlay.append(card);
    const isolate = () => [...document.body.children].forEach(e => {
      if (e === overlay || previous.has(e)) return;
      previous.set(e, e.getAttribute('inert')); e.inert = true;
    });
    isolate();
    const observer = new MutationObserver(isolate);
    observer.observe(document.body, { childList: true });
    document.body.style.setProperty('overflow', 'hidden');
    document.body.append(overlay);
    function key(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); cancel(); }
      if (e.key === 'Tab') {
        const controls = [...card.querySelectorAll('input, button')].filter(focusable);
        const i = controls.indexOf(document.activeElement);
        e.preventDefault(); controls[(i + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
      }
    }
    document.addEventListener('keydown', key, true);
    card.addEventListener('submit', e => { e.preventDefault(); approve(); });
    overlay.addEventListener('click', e => { if (e.target === overlay && !options.danger && !(input && input.value)) cancel(); });
    (input || (options.danger && safe ? safe : main)).focus();
  });
}

const confirmDialog = options => openDialog(options, false);
const promptDialog = options => openDialog(options, true);
export { confirmDialog, promptDialog };
