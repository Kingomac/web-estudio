// Pure calculations behind the reading labs (EUI-64, IPHC/UDP sizes, frame budget, per-hop compression).
export const hex2 = (n: number) => n.toString(16).padStart(2, '0');
export const bin8 = (n: number) => n.toString(2).padStart(8, '0');

/** Modified EUI-64 from a 48-bit MAC, or null if the MAC is not six hex octets with one separator. */
export function eui64(value: string) {
  const mac = value.trim().toLowerCase();
  if (!/^[0-9a-f]{2}([:-])(?:[0-9a-f]{2}\1){4}[0-9a-f]{2}$/.test(mac)) return null;
  const original = mac.split(/[:-]/).map(n => parseInt(n, 16));
  const inserted = [...original.slice(0, 3), 0xff, 0xfe, ...original.slice(3)];
  const modified = [inserted[0] ^ 2, ...inserted.slice(1)];
  const iid = modified.map(hex2).join('').match(/.{4}/g)!.join(':');
  return { original, inserted, modified, iid, address: `fe80::${iid}` };
}

export type IphcChoice = { tf: '00' | '01' | '10' | '11'; nh: '0' | '1'; hlim: '00' | '01' | '10' | '11'; address: 'link' | 'short' | 'context' | 'full'; cid: '0' | '1'; ports: '00' | '01' | '10' | '11' };

/** Bytes of IPHC plus inline IPv6 fields and of UDP (NHC or full), for the unicast teaching model. */
export function iphcSize(c: IphcChoice) {
  const context = c.address === 'context';
  const mode = { link: '11', short: '10', context: '11', full: '00' }[c.address];
  const address = { link: 0, short: 2, context: 0, full: 16 }[c.address];
  const cid = context && c.cid === '1' ? 1 : 0;
  const tf = { '00': 4, '01': 3, '10': 1, '11': 0 }[c.tf];
  const nh = c.nh === '0' ? 1 : 0;
  const hlim = c.hlim === '00' ? 1 : 0;
  const ports = { '00': 4, '01': 3, '10': 3, '11': 1 }[c.ports];
  const udp = c.nh === '1' ? 1 + ports + 2 : 8;
  const ip = 2 + cid + tf + nh + hlim + 2 * address;
  const fields: [string, string][] = [['Dispatch', '011'], ['TF', c.tf], ['NH', c.nh], ['HLIM', c.hlim], ['CID', String(cid)], ['SAC', context ? '1' : '0'], ['SAM', mode], ['M', '0'], ['DAC', context ? '1' : '0'], ['DAM', mode]];
  const bits = fields.map(f => f[1]).join('');
  return { ip, udp, total: ip + udp, cid, tf, nh, hlim, address, ports, fields, bytes: `${hex2(parseInt(bits.slice(0, 8), 2))} ${hex2(parseInt(bits.slice(8), 2))}` };
}

/** Simplified 127-byte budget of the notes: MAC 23 + security 21 + FCS 2 + IPv6/UDP headers. */
export function frameBudget(headers: number, payload: number) {
  const capacity = 127 - 23 - 21 - 2 - headers;
  return { capacity, total: 46 + headers + payload, excess: Math.max(0, payload - capacity), free: Math.max(0, capacity - payload) };
}

/** SAM/DAM per hop for the 5 → 3 → 1 example with shared context 0. */
export function hopCompression(mode: 'mesh' | 'route', hop: 0 | 1) {
  const mesh = mode === 'mesh';
  return { sam: mesh || hop === 0 ? '11' : '10', dam: mesh || hop === 1 ? '11' : '10', from: hop === 0 ? 5 : 3, to: hop === 0 ? 3 : 1, bytes: mesh ? 0 : 2 };
}
