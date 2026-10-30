import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { decodePhyPayload, parseBytes } from '../../src/domain/lorawan.ts';

const fields = (text: string) => {
  const r = decodePhyPayload(parseBytes(text)!);
  if ('error' in r) throw new Error(r.error);
  return Object.fromEntries(r.fields.map(f => [f.name, f]));
};

test('Base64 y hexadecimal del tema dan los mismos bytes', () => {
  assert.deepEqual(parseBytes('YCep/CcAAQABqrsRIjNE'), parseBytes('60 27 A9 FC 27 00 01 00 01 AA BB 11 22 33 44'));
  assert.equal(parseBytes('gCep/CcADQAFDz+/Yg4chwjfcKM0rWPiKEuk')?.length, 27);
  for (const bad of ['', 'xyz', '6', 'YCep/CcA=AQ']) assert.equal(parseBytes(bad), null);
});
test('uplink de la p. 45: coincide con los campos de Basics Station', () => {
  const f = fields('gCep/CcADQAFDz+/Yg4chwjfcKM0rWPiKEuk');
  assert.equal(f.MHDR.value, '0x80');
  assert.equal(f.DevAddr.value, '0x27FCA927');
  assert.equal(f.FCnt.value, '13');
  assert.equal(f.FPort.value, '5');
  assert.equal(f.FRMPayload.bytes.length, 14);
  assert.equal(parseInt(f.MIC.value, 16) | 0, -1538578206);
});
test('downlink de la p. 59 y tramas que no se separan', () => {
  const f = fields('6027A9FC2700010001AABB11223344');
  assert.equal(f.FCnt.value, '1');
  assert.equal(f.FRMPayload.value, '2 B');
  assert.equal(f.MIC.value, '0x44332211');
  for (const bad of ['00112233445566778899aabbccdd', '6027A9FC2700', '6027A9FC270F0100AABB11223344']) assert.ok('error' in decodePhyPayload(parseBytes(bad)!));
});
