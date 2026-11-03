import { test, expect } from '@playwright/test';

test('calcula la nota de Dispositivos, aplica el mínimo y la conserva al volver', async ({ page }) => {
  await page.goto('bimestres/b1/');
  await page.getByRole('article').filter({ hasText: 'Dispositivos IoT' }).getByRole('link', { name: 'Evaluación' }).click();
  await expect(page).toHaveURL(/\/asignaturas\/dispositivos\/evaluacion\/$/);
  await expect(page.getByRole('navigation', { name: 'Secciones de la asignatura' }).getByRole('link', { name: 'Evaluación' })).toHaveAttribute('aria-current', 'page');
  const continua = page.getByRole('region', { name: 'Evaluación continua' });
  const result = continua.locator('[data-result]');
  await continua.getByLabel('Problemas autónomos').fill('10');
  await continua.getByLabel('Prácticas de laboratorio').fill('10');
  await expect(result).toContainText('Para aprobar necesitas al menos 4,00 sobre 10 en Pruebas escritas (NExam).');
  await continua.getByLabel('Pruebas escritas').fill('3');
  await expect(result).toContainText('4,90');
  await expect(result).toContainText('Suspenso');
  await expect(result).toContainText('La media ponderada es 6,15, pero la guía la limita a 4,90. No llegas al mínimo en Pruebas escritas (NExam).');
  await continua.getByLabel('Pruebas escritas').fill('6');
  await expect(result).toContainText('7,80');
  await expect(result).toContainText('Aprobado');
  await continua.getByLabel('Pruebas escritas').fill('11');
  await expect(continua.getByLabel('Pruebas escritas')).toHaveAttribute('aria-invalid', '');
  await expect(result).toContainText('Corrige las notas marcadas');
  await continua.getByLabel('Pruebas escritas').fill('6');
  await page.reload();
  await expect(continua.getByLabel('Pruebas escritas')).toHaveValue('6');
  await expect(result).toContainText('7,80');
  await continua.getByRole('button', { name: 'Borrar notas' }).click();
  await expect(continua.getByLabel('Pruebas escritas')).toHaveValue('');
  await page.getByText('Fórmula de la guía docente').first().click();
  await expect(continua.locator('blockquote')).toContainText('NExam*0.55');
});

test('Protocolos admite puntos MooVi sobre 400 y Sistemas embebidos abre directamente su evaluación', async ({ page }) => {
  await page.goto('asignaturas/protocolos/evaluacion/');
  const continua = page.getByRole('region', { name: 'Evaluación continua' });
  await continua.getByLabel('Examen final').fill('5');
  await continua.getByLabel('Prueba intermedia de control').fill('5');
  await expect(continua.locator('[data-result]')).toContainText('al menos 200,00 sobre 400 en Puntos MooVi (PM)');
  await page.goto('asignaturas/embebidos/');
  await expect(page).toHaveURL(/\/asignaturas\/embebidos\/evaluacion\/$/);
  await expect(page.getByRole('heading', { level: 2 })).toContainText(['Evaluación continua · ordinaria', 'Evaluación continua · extraordinaria', 'Evaluación global']);
  await page.setViewportSize({ width: 320, height: 700 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('sin JavaScript muestra pesos y mínimos con los campos desactivados', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await page.goto('asignaturas/cloud/evaluacion/');
  const region = page.getByRole('region', { name: 'Primera oportunidad' });
  await expect(region).toContainText('40 % de la nota · sobre 10 · mínimo 4,00');
  await expect(region.getByLabel('Prueba objetiva de teoría')).toBeDisabled();
  await context.close();
});

test('Cloud calcula las entregas contando A y C con la tabla de la asignatura', async ({ page }) => {
  await page.goto('asignaturas/cloud/evaluacion/');
  const region = page.getByRole('region', { name: 'Primera oportunidad' });
  await region.getByLabel('A · Apta').fill('12');
  await region.getByLabel('C · No entregada').fill('2');
  await expect(region.locator('[data-contribution="entregas"]')).toHaveText('Nota de la tabla: 1,50 de 2,00. Aporta 1,50 puntos.');
  await region.getByLabel('Prueba objetiva de teoría').fill('5');
  await region.getByLabel('Prueba mixta de prácticas').fill('6');
  await expect(region.locator('[data-result]')).toContainText('5,90');
  await expect(region.locator('[data-result]')).toContainText('Aprobado');
  await region.getByLabel('C · No entregada').fill('4');
  await expect(region.locator('[data-contribution="entregas"]')).toContainText('sumen como mucho 15');
  await region.getByText('Tabla de calificación').click();
  await expect(region.getByRole('row')).toHaveCount(16);
});
