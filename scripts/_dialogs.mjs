/* Responde pelos mesmos controlos acessíveis que o utilizador vê.
   Um diálogo nativo é sempre uma regressão, mesmo quando se consegue dispensar. */
export async function dialogResponder(page, answer = () => true, errors = []) {
  page.on('dialog', d => { errors.push(`Diálogo nativo inesperado: ${d.message()}`); d.dismiss().catch(() => {}); });
  await page.exposeFunction('__answerAppDialog', async () => {
    const host=page.locator('.app-dialog-bg');
    const modal = host.getByRole('alertdialog').or(host.getByRole('dialog'));
    const message = await modal.innerText();
    const accept = answer(message);
    const buttons = modal.getByRole('button');
    const name = await buttons.nth(accept ? (await buttons.count()) - 1 : 0).innerText();
    await modal.getByRole('button', { name, exact: true }).click();
  });
  await page.addInitScript(() => {
    new MutationObserver(records => {
      if (records.some(r => [...r.addedNodes].some(n => n.nodeType === 1 && n.matches('.app-dialog-bg')))) {
        window.__answerAppDialog();
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

export async function settleDialog(page) {
  if (await page.locator('.app-dialog-bg').count()) await page.locator('.app-dialog-bg').waitFor({ state:'detached' });
  // Permite à continuação da Promise atualizar o estado antes da próxima asserção.
  await page.evaluate(() => new Promise(r => setTimeout(r, 0)));
}
