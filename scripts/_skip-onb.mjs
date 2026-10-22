/* Os testes antigos assumem a rotina original: começam como quem já concluiu/saltou o acolhimento.
   Só semeia quando ainda não há estado, por isso um reload não apaga o que o teste fez. */
export const skipOnboarding = page => page.addInitScript(() => {
  try {
    if (!localStorage.getItem('treino_v2')) localStorage.setItem('treino_v2', JSON.stringify({ onb: { done: true, skipped: true, step: 0, draft: {} } }));
  } catch (_) { /* about:blank não tem localStorage */ }
});
