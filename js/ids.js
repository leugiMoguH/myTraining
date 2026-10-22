/* myTraining — identificadores persistentes.
   Nomes e posições (`dia:índice`) são apresentação; o `id` é a identidade de uma entidade
   (dia da rotina, exercício da rotina, plano). Nunca se regenera um id que já exista. */
function uid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function') return globalThis.crypto.randomUUID();
  const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${h()}${h()}-${h()}-4${h().slice(1)}-a${h().slice(1)}-${h()}${h()}${h()}`;
}

export { uid };
