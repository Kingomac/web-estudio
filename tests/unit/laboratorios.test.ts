import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { eui64, iphcSize, frameBudget, hopCompression } from '../../src/domain/laboratorios.ts';

test('EUI-64 modificado invierte U/L y rechaza MAC mal formadas', () => {
  assert.equal(eui64('10:22:33:44:55:66')?.address, 'fe80::1222:33ff:fe44:5566');
  assert.equal(eui64('12-22-33-44-55-66')?.iid, '1022:33ff:fe44:5566');
  for (const bad of ['10:22:33:44:55', '10:22-33:44:55:66', 'zz:22:33:44:55:66']) assert.equal(eui64(bad), null);
});
test('tamaños IPHC + UDP de los casos de los apuntes', () => {
  const minimum = { tf: '11', nh: '1', hlim: '10', address: 'link', cid: '0', ports: '11' } as const;
  assert.equal(iphcSize(minimum).total, 6);
  assert.equal(iphcSize(minimum).bytes, '7e 33');
  assert.equal(iphcSize({ ...minimum, address: 'context', cid: '1' }).total, 7);
  assert.equal(iphcSize({ tf: '00', nh: '0', hlim: '00', address: 'full', cid: '0', ports: '00' }).total, 48);
});
test('presupuesto de trama y compresión por salto', () => {
  assert.deepEqual(frameBudget(48, 33), { capacity: 33, total: 127, excess: 0, free: 0 });
  assert.equal(frameBudget(6, 33).free, 42);
  assert.equal(frameBudget(48, 40).excess, 7);
  assert.deepEqual(hopCompression('route', 0), { sam: '11', dam: '10', from: 5, to: 3, bytes: 2 });
  assert.deepEqual(hopCompression('mesh', 1), { sam: '11', dam: '11', from: 3, to: 1, bytes: 0 });
});
