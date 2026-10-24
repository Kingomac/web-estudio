import { test, expect } from '@playwright/test';

const subject = 'asignaturas/protocolos/';
const summary = `${subject}resumenes/parcial-en-pocas-hojas/`;

test('el repaso completo se encuentra desde apuntes, tests y resúmenes y conserva su PDF', async ({ page, request }) => {
  for (const section of ['apuntes', 'tests']) {
    await page.goto(`${subject}${section}/`);
    const highlight = page.getByRole('region', { name: 'Resumen imprimible: El parcial, en unas pocas hojas' });
    const pdf = highlight.getByRole('link', { name: 'Abrir PDF para imprimir' });
    await expect(pdf).toHaveAttribute('href', /\/web-estudio\/materiales\/protocolos\/resumen-parcial-imprimible\.pdf$/);
    const response = await request.get((await pdf.getAttribute('href'))!);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/pdf');
    await expect(highlight.getByRole('link', { name: 'Descargar PDF' })).toHaveAttribute('download', 'resumen-parcial-hasta-t4-37.pdf');
    await highlight.getByRole('link', { name: 'Leer en la web' }).click();
    await expect(page).toHaveURL(new RegExp(`${summary}$`));
  }
  await page.goto(`${subject}resumenes/`);
  await page.getByRole('link', { name: 'El parcial, en unas pocas hojas', exact: true }).click();
  await expect(page.locator('.prose > h2')).toHaveText([
    'IPv6: direcciones, rutas y NDP', 'IPHC: la hoja de los bits',
    '6LoWPAN y redes de bajo consumo', 'Aplicación y descubrimiento',
  ]);
  await expect(page.locator('.prose table')).toHaveCount(16);
  await expect(page.locator('.prose')).toContainText('Registro no garantiza que el nodo esté despierto.');
  for (const n of [1, 2, 3, 4]) {
    await expect(page.getByRole('link', { name: `Página ${n} del resumen original`, exact: true })).toHaveAttribute('href', new RegExp(`\\.pdf#page=${n}$`));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
