import { test, expect } from '@playwright/test';

const subject = 'asignaturas/protocolos/';
const summary = `${subject}resumenes/parcial-en-pocas-hojas/`;

test('el repaso completo se encuentra desde resúmenes y conserva su PDF', async ({ page, request }) => {
  for (const section of ['apuntes', 'tests']) {
    await page.goto(`${subject}${section}/`);
    await expect(page.getByRole('region', { name: /^Resumen imprimible/ })).toHaveCount(0);
  }
  await page.goto(`${subject}resumenes/`);
  for (const [title, file, download] of [
    ['El parcial, en unas pocas hojas', 'resumen-parcial-imprimible', 'resumen-parcial-hasta-t4-37.pdf'],
    ['Toda la materia, en unas pocas hojas', 'resumen-final-imprimible', 'resumen-protocolos-final.pdf'],
  ] as const) {
    const pdf = page.getByRole('link', { name: `Abrir PDF · 4 páginas de ${title}` });
    await expect(pdf).toHaveAttribute('href', new RegExp(`/web-estudio/materiales/protocolos/${file}\\.pdf$`));
    const response = await request.get((await pdf.getAttribute('href'))!);
    expect(response.ok()).toBe(true);
    expect(response.headers()['content-type']).toContain('application/pdf');
    await expect(page.getByRole('link', { name: `Descargar PDF de ${title}` })).toHaveAttribute('download', download);
  }
  await page.getByRole('link', { name: 'El parcial, en unas pocas hojas', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${summary}$`));
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
