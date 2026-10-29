import { test, expect } from '@playwright/test';
const subject = 'asignaturas/protocolos/';
const quizPath = `${subject}tests/repaso-ipv6/`;

test('navega desde el catálogo, filtra un tag y restaura el filtro al volver', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Materiales del máster');
  await page.getByRole('main').getByRole('link', { name: 'Protocolos de comunicación para IoT', exact: true }).click();
  await expect(page).toHaveURL(/\/protocolos\/apuntes\/$/);
  await expect(page.getByRole('link', { name: 'Todos los recursos', exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Tipos de recurso' }).getByRole('link', { name: 'Apuntes', exact: true })).toHaveAttribute('aria-current', 'page');
  const rows = page.locator('[data-resource]');
  const total = await rows.count();
  const filtered = async (slug: string) => {
    const visible = page.locator('[data-resource]:visible');
    const count = await visible.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(total);
    for (const tags of await visible.evaluateAll(els => els.map(el => (el as HTMLElement).dataset.tags || ''))) expect(tags.split(' ')).toContain(slug);
  };
  await page.getByRole('button', { name: 'IP en IoT', exact: true }).click();
  await expect(page).toHaveURL(/tag=ipv6/);
  await filtered('ipv6');
  await page.getByRole('button', { name: 'Redes LoWPAN', exact: true }).click();
  await expect(page).toHaveURL(/tag=lowpan/);
  await filtered('lowpan');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'IP en IoT', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.goto(`${subject}apuntes/ipv6-y-vecinos/`);
  await page.getByRole('list', { name: 'Etiquetas' }).getByRole('link', { name: 'IP en IoT', exact: true }).click();
  await expect(page).toHaveURL(/\/protocolos\/apuntes\/\?tag=ipv6$/);
  await filtered('ipv6');
});
test('el menú móvil permite navegar por asignatura y sección sin desplazar el contenido inicial', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const navigation = page.locator('.site-navigation');
  await expect(navigation).not.toHaveAttribute('open');
  await expect(page.locator('.subject-row h3').first()).toBeInViewport();
  await navigation.locator('summary').focus();
  await page.keyboard.press('Enter');
  await navigation.getByRole('link', { name: 'Protocolos de comunicación para IoT', exact: true }).click();
  await expect(navigation).not.toHaveAttribute('open');
  await expect(page.getByRole('heading', { level: 1, name: 'Apuntes' })).toBeInViewport();
  await navigation.locator('summary').click();
  await navigation.getByRole('link', { name: 'Apuntes', exact: true }).click();
  await expect(page).toHaveURL(/\/protocolos\/apuntes\/$/);
  await page.getByRole('main').getByRole('link', { name: 'IPv6, del destino al vecino', exact: true }).click();
  await expect(page.locator('.toc details')).not.toHaveAttribute('open');
  await expect(page.locator('.prose > p').first()).toBeInViewport();
  await navigation.locator('summary').click();
  await expect(navigation.getByRole('link', { name: 'Apuntes', exact: true })).toHaveAttribute('aria-current', 'location');
});
test('la lectura contiene índice, visual independiente y fuentes; el resumen usa MDX', async ({ page }) => {
  await page.goto(`${subject}apuntes/ipv6-y-vecinos/`);
  await page.getByRole('navigation', { name: 'Índice de la lectura' }).getByRole('link', { name: 'Del destino IPv6' }).click();
  await expect(page).toHaveURL(/#vecinos$/);
  const visual = page.locator('ndp-explorer');
  await visual.getByRole('button', { name: 'Paso siguiente' }).click();
  await expect(visual.getByRole('status')).toHaveText('Paso 2 de 3');
  await visual.getByRole('button', { name: 'Reiniciar' }).click();
  await expect(visual.getByRole('status')).toHaveText('Paso 1 de 3');
  await expect(page.locator('.sources a').first()).toHaveAttribute('href', /\/materiales\/.*#page=9$/);
  await page.goto(`${subject}resumenes/ipv6-esencial/`);
  await expect(page.locator('.prose table')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Las cifras esenciales' })).toBeVisible();
});
test('corrige única y múltiple, muestra todas las explicaciones y restaura la sesión', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(quizPath);
  const single = page.locator('[data-question="protocolos.preguntas.longitud-ipv6"]');
  await expect(single.locator('[data-options] input').first()).toHaveValue('bits-64');
  await single.getByLabel('32 bits', { exact: true }).check();
  await single.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(single.locator('[data-result]')).toContainText('Revisa');
  await expect(single.locator('[data-feedback] .feedback-options li')).toHaveCount(4);
  await expect(single.locator('[data-feedback] .sources a')).toHaveAttribute('href', /#page=9$/);
  await single.getByLabel('128 bits', { exact: true }).check();
  await expect(single.locator('[data-feedback]')).toBeHidden();
  await expect(page.locator('[data-summary]')).toContainText('0 correctas');
  await single.getByRole('button', { name: 'Comprobar', exact: true }).click();
  const multiple = page.locator('[data-question="protocolos.preguntas.tipos-ipv6"]');
  await multiple.getByLabel('Unicast', { exact: true }).check();
  await multiple.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(multiple.getByText('Correcta omitida', { exact: true })).toHaveCount(2);
  await multiple.getByLabel('Multicast', { exact: true }).check();
  await multiple.getByLabel('Anycast', { exact: true }).check();
  await multiple.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(page.locator('[data-summary]')).toContainText('2 correctas');
  const before = await single.locator('[data-options] input').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value));
  await page.reload();
  await expect(page.locator('[data-summary]')).toContainText('2 correctas');
  expect(await single.locator('[data-options] input').evaluateAll(inputs => inputs.map(i => (i as HTMLInputElement).value))).toEqual(before);
  await page.getByRole('button', { name: 'Reiniciar test' }).click();
  await expect(page.locator('[data-summary]')).toContainText('3 pendientes');
});
test('ordena por teclado y conserva el contexto y el enlace directo', async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0; });
  await page.goto(`${quizPath}#pregunta-intercambio-ndp`);
  const q = page.locator('#pregunta-intercambio-ndp');
  const last = q.locator('[data-option="solicitud"]');
  await last.getByRole('button', { name: /^Subir/ }).focus();
  await page.keyboard.press('Enter');
  await last.getByRole('button', { name: /^Subir/ }).focus();
  await page.keyboard.press('Enter');
  await q.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(q.locator('[data-result]')).toHaveText('✓ Respuesta correcta');
  await expect(q.locator('[data-feedback] .feedback-options li')).toHaveCount(3);
  await expect(q.locator('..').locator('..').getByText('Considera una resolución que termina con una respuesta del vecino.')).toBeVisible();
});
test('formularios con coma decimal y reset independiente del test', async ({ page }) => {
  await page.goto(quizPath);
  const q = page.locator('[data-question="protocolos.preguntas.longitud-ipv6"]');
  await q.getByLabel('128 bits', { exact: true }).check();
  await q.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await page.goto(`${subject}ejercicios/tamano-ipv6/`);
  await page.getByLabel('Tamaño en bits').fill('128abc');
  await page.getByLabel('Tamaño en bytes').fill('16,0');
  await page.getByRole('button', { name: 'Comprobar ejercicio' }).click();
  await expect(page.locator('[data-result]')).toContainText('Revisa');
  await page.getByLabel('Tamaño en bits').fill('128');
  await page.getByRole('button', { name: 'Comprobar ejercicio' }).click();
  await expect(page.locator('[data-result]')).toHaveText('✓ Ejercicio correcto');
  await page.reload();
  await expect(page.locator('[data-result]')).toHaveText('✓ Ejercicio correcto');
  await page.getByRole('button', { name: 'Reiniciar ejercicio' }).click();
  await expect(page.getByLabel('Tamaño en bits')).toBeEmpty();
  await page.goto(quizPath);
  await expect(page.locator('[data-summary]')).toContainText('1 correctas');
});
test('se puede practicar con almacenamiento deshabilitado o corrupto', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => '{json roto';
    Storage.prototype.setItem = () => { throw new Error('Storage unavailable'); };
  });
  await page.goto(quizPath);
  const q = page.locator('[data-question="protocolos.preguntas.longitud-ipv6"]');
  await q.getByLabel('128 bits', { exact: true }).check();
  await q.getByRole('button', { name: 'Comprobar', exact: true }).click();
  await expect(q.locator('[data-result]')).toHaveText('✓ Respuesta correcta');
});
test('móvil: sin desbordamiento, fuentes accesibles y taller funcional', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['./', subject, `${subject}apuntes/ipv6-y-vecinos/`, quizPath, `${subject}ejercicios/explorar-ndp/`, `${subject}materiales/tema-3-ip-en-iot/`]) {
    await page.goto(route);
    if (route === subject) await page.waitForURL(`**/${subject}apuntes/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByRole('link', { name: /Descargar original/ })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: /Descargar original/ }).click();
  expect((await download).suggestedFilename()).toBe('Tema 3 - IP en IoT.pdf');
});
test('el índice móvil es accesible durante la lectura y devuelve el foco al cerrarlo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${subject}apuntes/ipv6-y-vecinos/#comprueba`);
  const opener = page.getByRole('button', { name: 'Contenido ↑' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: 'Contenido' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole('link', { name: 'Una dirección, 128 bits' }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/#direcciones$/);
});
test('oculta el menú, centra la lectura y conserva la preferencia al navegar y cambiar de tamaño', async ({ page }) => {
  await page.goto(`${subject}apuntes/tema-3-ip-en-iot/`);
  const toggle = page.getByRole('button', { name: 'Ocultar menú', exact: true });
  await toggle.focus();
  await page.keyboard.press('Enter');
  const show = page.getByRole('button', { name: 'Mostrar menú', exact: true });
  await expect(show).toHaveAttribute('aria-expanded', 'false');
  await expect(show).toBeFocused();
  await expect(page.locator('.sidebar')).toBeHidden();
  const article = await page.locator('.reading-grid > .prose').boundingBox();
  const toc = await page.locator('.toc').boundingBox();
  expect(article).not.toBeNull();
  expect(toc).not.toBeNull();
  expect(Math.abs(article!.x + article!.width / 2 - 720)).toBeLessThan(2);
  expect(toc!.x + toc!.width).toBeLessThan(article!.x);
  await page.goto(`${subject}apuntes/tema-4-lowpan/`);
  await expect(page.locator('.sidebar')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).toBeVisible();
  await expect(page.locator('.site-navigation')).not.toHaveAttribute('open');
  await page.locator('.site-navigation summary').click();
  await expect(page.getByRole('navigation', { name: 'Catálogo', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator('.sidebar')).toBeHidden();
  await show.click();
  await expect(page.locator('.sidebar')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ocultar menú', exact: true })).toHaveAttribute('aria-expanded', 'true');
});

for (const width of [320, 390]) {
  test(`tests a ${width}px: ancho completo y sin desbordamiento con enunciados largos y correcciones`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${subject}tests/`);
    const routes = await page.locator('[data-resource] h2 a').evaluateAll(links => links.map(link => link.getAttribute('href')!));
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      await page.goto(route);
      await expect(page.locator('[data-reset]')).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const question = await page.locator('[data-question]').first().boundingBox();
      expect(question?.x).toBe(0);
      expect(question?.width).toBe(width);
      // Reveal all explanations, including long addresses and source links.
      await page.locator('[data-question]').evaluateAll(questions => {
        for (const question of questions) {
          question.querySelector<HTMLInputElement>('input')?.click();
          question.querySelector<HTMLButtonElement>('[data-check]')?.click();
        }
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.locator('.site-navigation summary').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}
test('lecturas e índice funcionan sin JavaScript; alias conserva el destino', async ({ browser, page, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await context.newPage();
  await staticPage.goto(`${baseURL}asignaturas/protocolos/apuntes/ipv6-y-vecinos/`);
  await expect(staticPage.getByRole('navigation', { name: 'Índice de la lectura' })).toBeVisible();
  await expect(staticPage.locator('.ndp-steps li')).toHaveCount(3);
  await expect(staticPage.locator('.sources a')).toBeVisible();
  await context.close();
  await page.goto(`${subject}apuntes/introduccion-ipv6/#vecinos`);
  await expect(page).toHaveURL(/ipv6-y-vecinos\/#vecinos$/);
});
test('la impresión mantiene explicación estática y oculta controles', async ({ page }) => {
  await page.goto(`${subject}apuntes/ipv6-y-vecinos/`);
  await expect(page.locator('.sources')).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.sidebar')).toBeHidden();
  await expect(page.locator('.visual-controls')).toBeHidden();
  for (const step of await page.locator('.ndp-steps li').all()) await expect(step).toBeVisible();
  await expect(page.locator('.sources')).toBeHidden();
  await expect(page.getByText('Estos conceptos y la notación se recogen en la página 9 del documento original.')).toBeHidden();
  await expect(page.getByText('Supone que el vecino responde', { exact: false })).toBeVisible();
  await expect(page.getByText('Fuente: Tema 3, página 39.', { exact: true })).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-toc-toggle')).toBeHidden();
});

test('los laboratorios imprimen todos los casos y supuestos cerrados incluso sin JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    for (const path of ['tema-3-ip-en-iot', 'tema-4-lowpan']) {
      await page.emulateMedia({ media: 'screen' });
      await page.goto(`${baseURL}${subject}apuntes/${path}/`);
      const details = page.locator('.lab details');
      expect(await details.count()).toBeGreaterThan(0);
      // Count-based assertions: one retrying check per state instead of one per element keeps the test fast.
      const contents = page.locator('.lab details > :not(summary)');
      const total = await contents.count();
      await expect(page.locator('.lab details > :not(summary):visible')).toHaveCount(0);
      // Preserve the reader's choice when returning from print to screen.
      await details.first().locator('summary').click();
      await page.emulateMedia({ media: 'print' });
      await expect(page.locator('.lab details > :not(summary):visible')).toHaveCount(total);
      await expect(page.locator('.lab :is(button, input, select):visible')).toHaveCount(0);
      await page.emulateMedia({ media: 'screen' });
      await expect(details.first()).toHaveAttribute('open');
      await expect(page.locator('.lab details[open]')).toHaveCount(1);
      await expect(page.locator('.lab details:not([open]) > :not(summary):visible')).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});

test('laboratorios de los apuntes: NDP, EUI-64, IPHC y presupuesto responden y caben en móvil', async ({ page }) => {
  await page.goto(`${subject}apuntes/tema-3-ip-en-iot/`);
  const slaac = page.locator('#ndp-slaac');
  await expect(slaac.locator('[data-count]')).toHaveText('Paso 1 de 7');
  await slaac.getByRole('button', { name: 'Siguiente →' }).click();
  await expect(slaac.locator('[data-count]')).toHaveText('Paso 2 de 7');
  await expect(slaac.locator('.ndp-fields')).toContainText('ff02::1:ff00:a');
  await slaac.getByLabel('Escenario').selectOption('sin-router');
  await expect(slaac.locator('[data-count]')).toHaveText('Paso 1 de 5');
  const eui = page.locator('#visual-eui64');
  await eui.getByRole('button', { name: '4 · IPv6' }).click();
  await expect(eui.locator('[data-output]')).toContainText('fe80::1222:33ff:fe44:5566');
  await eui.getByLabel('MAC de 48 bits').fill('10:22:33');
  await expect(eui.locator('.lab-error')).toBeVisible();
  await page.goto(`${subject}apuntes/tema-4-lowpan/`);
  const iphc = page.locator('#visual-iphc');
  await iphc.getByRole('button', { name: /Direcciones completas/ }).click();
  await expect(iphc.locator('.metric').nth(2)).toContainText('48 B');
  const budget = page.locator('#visual-presupuesto');
  await budget.getByLabel('Cabeceras IPv6 + UDP').selectOption('6');
  await expect(budget.locator('[data-output]')).toContainText('75 B');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['tema-3-ip-en-iot', 'tema-4-lowpan']) {
    await page.goto(`${subject}apuntes/${path}/`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
