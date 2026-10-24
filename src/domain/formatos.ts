// Answer formats for network exercises. Pure functions: no DOM or storage.
export const formats = ['ipv6', 'ipv6-expanded', 'ipv6-canonical', 'prefix', 'iid', 'mac', 'bits', 'hex', 'integer'] as const;
export type Format = typeof formats[number];

export const formatHints: Record<Format, string> = {
  ipv6: 'Se acepta cualquier forma IPv6 equivalente.',
  'ipv6-expanded': 'Ocho hextetos de cuatro cifras.',
  'ipv6-canonical': 'Forma canónica (RFC 5952), en minúsculas.',
  prefix: 'Dirección de red / longitud, por ejemplo 2001:db8::/64.',
  iid: 'Cuatro hextetos; se admiten ceros iniciales.',
  mac: 'Seis bytes separados por : o -.',
  bits: 'Binario: conserva los ceros iniciales.',
  hex: 'Hexadecimal con las cifras indicadas; puedes separar bytes con espacios.',
  integer: 'Número entero, sin unidades.',
};

/** Expands an IPv6 address into eight 16-bit groups, or null if it is not valid. */
export function expandIpv6(value: string): number[] | null {
  const s = value.trim().toLowerCase();
  if (!s || /[^0-9a-f:]/.test(s) || (s.match(/::/g) || []).length > 1) return null;
  const sides = s.split('::');
  const left = sides[0] ? sides[0].split(':') : [];
  const right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];
  if (![...left, ...right].every(g => /^[0-9a-f]{1,4}$/.test(g))) return null;
  if (sides.length === 1 && left.length !== 8) return null;
  if (sides.length === 2 && left.length + right.length >= 8) return null;
  const groups = sides.length === 2 ? [...left, ...Array(8 - left.length - right.length).fill('0'), ...right] : left;
  return groups.map(g => parseInt(g, 16));
}

const sameIpv6 = (a: string, b: string) => {
  const x = expandIpv6(a), y = expandIpv6(b);
  return !!x && !!y && x.every((v, i) => v === y[i]);
};

export function matchesFormat(format: Format, input: string, answer: string): boolean {
  const s = input.trim().toLowerCase(), expected = answer.trim().toLowerCase();
  if (!s) return false;
  switch (format) {
    case 'ipv6': return sameIpv6(s, expected);
    case 'ipv6-expanded': return /^[0-9a-f]{4}(:[0-9a-f]{4}){7}$/.test(s) && sameIpv6(s, expected);
    case 'ipv6-canonical': return s === expected;
    case 'prefix': {
      const [address, length, ...rest] = s.split('/'), [expectedAddress, expectedLength] = expected.split('/');
      return !rest.length && /^\d{1,3}$/.test(length ?? '') && Number(length) === Number(expectedLength) && sameIpv6(address, expectedAddress);
    }
    case 'iid': return /^[0-9a-f]{1,4}(:[0-9a-f]{1,4}){3}$/.test(s) && sameIpv6(`0:0:0:0:${s}`, `0:0:0:0:${expected}`);
    case 'mac': return /^[0-9a-f]{2}([:-][0-9a-f]{2}){5}$/.test(s) && s.replaceAll('-', ':') === expected;
    case 'bits': return /^[01]+$/.test(s) && s === expected;
    case 'hex': { const x = s.replace(/^0x/, '').replace(/\s/g, ''); return /^[0-9a-f]+$/.test(x) && x === expected.replace(/\s/g, ''); }
    case 'integer': return /^\d+$/.test(s) && Number(s) === Number(expected);
  }
}
