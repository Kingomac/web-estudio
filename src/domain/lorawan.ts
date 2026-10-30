// Pure LoRaWAN 1.0.x PHYPayload parsing for the reading lab: MHDR, FHDR, FPort, FRMPayload and MIC.
import { hex2 } from './laboratorios.ts';

export const messageTypes: Record<number, string> = {
  0x00: 'Join-request', 0x20: 'Join-accept', 0x40: 'Datos uplink sin confirmación', 0x60: 'Datos downlink sin confirmación',
  0x80: 'Datos uplink con confirmación', 0xa0: 'Datos downlink con confirmación',
};

/** Bytes from hex (spaces optional) or Base64; null when the text is neither. */
export function parseBytes(text: string): number[] | null {
  const value = text.trim().replace(/\s+/g, '');
  if (!value) return null;
  if (/^(?:[0-9a-fA-F]{2})+$/.test(value)) return value.match(/../g)!.map(b => parseInt(b, 16));
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(value) && value.length % 4 === 0) {
    const bits = [...value.replace(/=+$/, '')].map(c => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(c).toString(2).padStart(6, '0')).join('');
    return bits.match(/.{8}/g)?.map(b => parseInt(b, 2)) ?? null;
  }
  return null;
}

/** Little-endian unsigned integer, as LoRaWAN transmits DevAddr, FCnt and MIC. */
const le = (bytes: number[]) => bytes.reduceRight((n, b) => n * 256 + b, 0);
const hex = (bytes: number[]) => bytes.map(hex2).join(' ').toUpperCase();

export type FrameField = { name: string; bytes: number[]; value: string; note: string };

/** Splits a data PHYPayload into its fields, or explains why it cannot. */
export function decodePhyPayload(bytes: number[]): { type: string; fields: FrameField[] } | { error: string } {
  const mhdr = bytes[0];
  if (mhdr === undefined) return { error: 'La trama está vacía.' };
  const mtype = mhdr & 0xe0, type = messageTypes[mtype];
  if (!type) return { error: `MHDR ${hex2(mhdr).toUpperCase()} no corresponde a un tipo de mensaje del tema.` };
  if (mtype <= 0x20) return { error: `${type}: este laboratorio solo separa tramas de datos.` };
  if (bytes.length < 12) return { error: `Una trama de datos necesita al menos 12 bytes (MHDR 1 + FHDR 7 + MIC 4); hay ${bytes.length}.` };
  const fOptsLen = bytes[5] & 0x0f;
  const bodyEnd = bytes.length - 4;
  if (8 + fOptsLen > bodyEnd) return { error: `FCtrl anuncia ${fOptsLen} bytes de FOpts, pero no caben antes del MIC.` };
  const uplink = mtype === 0x40 || mtype === 0x80;
  const fields: FrameField[] = [
    { name: 'MHDR', bytes: [mhdr], value: `0x${hex2(mhdr).toUpperCase()}`, note: type },
    { name: 'DevAddr', bytes: bytes.slice(1, 5), value: `0x${le(bytes.slice(1, 5)).toString(16).toUpperCase().padStart(8, '0')}`, note: 'Dirección de sesión; viaja con el byte menos significativo primero.' },
    { name: 'FCtrl', bytes: [bytes[5]], value: `0x${hex2(bytes[5]).toUpperCase()}`, note: `ADR ${bytes[5] >> 7}, ACK ${(bytes[5] >> 5) & 1}; longitud de FOpts ${fOptsLen}.` },
    { name: 'FCnt', bytes: bytes.slice(6, 8), value: String(le(bytes.slice(6, 8))), note: `Contador de tramas ${uplink ? 'uplink' : 'downlink'}; cada sentido tiene el suyo.` },
  ];
  if (fOptsLen) fields.push({ name: 'FOpts', bytes: bytes.slice(8, 8 + fOptsLen), value: hex(bytes.slice(8, 8 + fOptsLen)), note: 'Comandos MAC sin cifrar.' });
  const portAt = 8 + fOptsLen;
  if (portAt < bodyEnd) {
    const port = bytes[portAt];
    fields.push({ name: 'FPort', bytes: [port], value: String(port), note: port === 0 ? 'Puerto 0: FRMPayload lleva comandos MAC cifrados con NwkSKey.' : 'Puerto de aplicación: FRMPayload va cifrado con AppSKey.' });
    if (portAt + 1 < bodyEnd) fields.push({ name: 'FRMPayload', bytes: bytes.slice(portAt + 1, bodyEnd), value: `${bodyEnd - portAt - 1} B`, note: port === 0 ? 'Cifrado con NwkSKey.' : 'Cifrado con AppSKey: el gateway y el NS no lo leen.' });
  }
  fields.push({ name: 'MIC', bytes: bytes.slice(bodyEnd), value: `0x${le(bytes.slice(bodyEnd)).toString(16).toUpperCase().padStart(8, '0')}`, note: 'Código de integridad calculado con NwkSKey.' });
  return { type, fields };
}
