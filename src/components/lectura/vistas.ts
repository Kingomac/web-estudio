// HTML views of the reading labs. Astro renders the initial state with them (static and printable) and the client re-renders on input.
import { eui64, iphcSize, frameBudget, hopCompression, hex2, bin8, type IphcChoice } from '../../domain/laboratorios.ts';
import type { Packet, HostState, Step, NodeId } from '../../domain/ndp.ts';

const esc = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const metric = (value: string, label: string) => `<div class="metric"><strong>${esc(value)}</strong><span>${esc(label)}</span></div>`;
const metrics = (...items: string[]) => `<div class="metrics">${items.join('')}</div>`;
/** Proportional bar of byte segments; colours come from the --color-seg-* tokens. */
function byteBar(parts: [string, number][], scale: number) {
  return `<div class="byte-bar" aria-hidden="true">${parts.map(([, n], i) => `<span style="width:${(100 * n) / scale}%;--seg:var(--color-seg-${(i % 6) + 1})"></span>`).join('')}</div>`
    + `<div class="byte-legend">${parts.map(([name, n], i) => `<span style="--seg:var(--color-seg-${(i % 6) + 1})">${esc(name)} · ${n} B</span>`).join('')}</div>`;
}
const table = (rows: [string, number][]) => `<div class="table-scroll"><table><thead><tr><th scope="col">Componente</th><th scope="col">Bytes en línea</th></tr></thead><tbody>${rows.map(([n, v]) => `<tr><td>${esc(n)}</td><td>${v}</td></tr>`).join('')}</tbody></table></div>`;

export const ipv6Fields = {
  version: ['Version · 4 bits', 'El valor 6 identifica IPv6.', 'IPHC omite la versión: el receptor sabe que reconstruye IPv6.'],
  tc: ['Traffic Class · 8 bits', 'Contiene DSCP (6 bits) y ECN (2 bits).', 'TF indica qué partes de Traffic Class y Flow Label viajan. Los valores omitidos se reconstruyen como cero.'],
  flow: ['Flow Label · 20 bits', 'Permite identificar flujos.', 'TF=10 o TF=11 omite Flow Label, que se reconstruye como cero.'],
  length: ['Payload Length · 16 bits', 'Cuenta los bytes posteriores a la cabecera básica: con 8 bytes UDP y 20 bytes de datos vale 28, no 68.', 'En IPHC se deduce de la longitud disponible; no necesita viajar como campo independiente.'],
  next: ['Next Header · 8 bits', 'Identifica la cabecera siguiente: UDP=17, TCP=6, ICMPv6=58; también puede indicar una extensión.', 'NH=0 envía un byte explícito. NH=1 indica que la cabecera siguiente usa LOWPAN_NHC.'],
  hop: ['Hop Limit · 8 bits', 'Disminuye al reenviar un router IPv6. Evita recorridos indefinidos.', 'HLIM=01/10/11 representa 1/64/255 sin byte adicional. HLIM=00 envía el valor explícito.'],
  source: ['Source Address · 128 bits = 16 bytes', 'Es la dirección IPv6 del origen.', 'SAC y SAM indican cómo reconstruirla: dirección completa, IID parcial o información de enlace/contexto.'],
  destination: ['Destination Address · 128 bits = 16 bytes', 'Es la dirección IPv6 del destino. Las dos direcciones suman el 80 % de la cabecera básica.', 'M, DAC y DAM distinguen multicast/unicast y el modo de reconstrucción del destino.'],
} as const;
export type Ipv6Field = keyof typeof ipv6Fields;
export const ipv6FieldView = (key: Ipv6Field) => { const [t, d, c] = ipv6Fields[key]; return `<p><strong>${t}</strong></p><p>${d}</p><p><b>Al comprimir:</b> ${c}</p>`; };

export function eui64View(macValue: string, step: number) {
  const d = eui64(macValue);
  if (!d) return '<p class="lab-error">Escribe seis octetos hexadecimales: por ejemplo, 10:22:33:44:55:66. Usa el mismo separador en toda la MAC.</p>';
  const bytes = step === 0 ? d.original : step === 1 ? d.inserted : d.modified;
  const text = [
    'Partimos de 6 octetos × 8 bits = 48 bits. El IID que queremos construir tiene 64 bits.',
    'Insertamos FF:FE entre los tres primeros y los tres últimos octetos. Ahora hay 8 octetos = 64 bits.',
    `Invertimos solo U/L, el segundo bit menos significativo: ${hex2(d.original[0])} XOR 02 = ${hex2(d.modified[0])}. El bit pasa de ${(d.original[0] >> 1) & 1} a ${(d.modified[0] >> 1) & 1}.`,
    'Agrupamos los octetos de dos en dos y añadimos el prefijo link-local fe80::/64.',
  ][step];
  return `<p><strong>Paso ${step + 1} de 4</strong> · ${text}</p><div class="octets">${bytes.map((n, i) => `<span class="${step >= 2 && i === 0 ? 'is-changed' : step >= 1 && (i === 3 || i === 4) ? 'is-new' : ''}">${hex2(n)}</span>`).join('')}</div>`
    + (step === 2 ? `<p class="formula">${bin8(d.original[0])} XOR 00000010 = ${bin8(d.modified[0])}</p><p>Invertir un bit no es sumar 2 siempre: si ya era 1, pasa a 0.</p>` : '')
    + (step === 3 ? `<p>IID: <code>${d.iid}</code><br>IPv6: <code>${d.address}</code></p>` : '');
}

export function budgetView(headers: number, payload: number) {
  const r = frameBudget(headers, payload);
  const parts: [string, number][] = [['MAC', 23], ['Seguridad', 21], ['IPv6 + UDP', headers], ['Aplicación', payload], ['FCS', 2]];
  if (r.free) parts.push(['Libre', r.free]);
  const verdict = r.excess ? `No cabe: ${r.excess === 1 ? 'sobra 1 byte.' : `sobran ${r.excess} bytes.`}` : r.free ? `Cabe: quedan ${r.free} bytes libres.` : 'Cabe justo: no queda espacio libre.';
  return metrics(metric(`${r.capacity} B`, 'capacidad para aplicación'), metric(`${r.total} / 127 B`, 'ocupación con esta carga')) + byteBar(parts, Math.max(127, r.total))
    + `<div class="lab-detail"><p><strong>${verdict}</strong></p><p class="formula">127 − 23 − 21 − 2 − ${headers} = ${r.capacity} B para aplicación</p>`
    + (r.excess ? '<p>Haría falta reducir la carga o fragmentar. FRAG1 y FRAGN también ocupan espacio (4 y 5 B); no basta con dividir entre 127. Sus offsets se refieren al datagrama sin comprimir.</p>' : '<p>Comprimir las cabeceras deja más espacio para los mismos datos de aplicación.</p>') + '</div>';
}

export const iphcPresets: Record<'minimo' | 'contexto' | 'completo', IphcChoice> = {
  minimo: { tf: '11', nh: '1', hlim: '10', address: 'link', cid: '0', ports: '11' },
  contexto: { tf: '11', nh: '1', hlim: '10', address: 'context', cid: '1', ports: '11' },
  completo: { tf: '00', nh: '0', hlim: '00', address: 'full', cid: '0', ports: '00' },
};
export function iphcView(c: IphcChoice) {
  const r = iphcSize(c);
  const tfText = { '00': 'Viajan ECN, DSCP y Flow Label, con relleno: 4 B.', '01': 'DSCP se reconstruye como 0. Viajan ECN y Flow Label, con relleno: 3 B.', '10': 'Flow Label se reconstruye como 0. Viaja Traffic Class: 1 B.', '11': 'Traffic Class y Flow Label se reconstruyen como 0: no viajan.' }[c.tf];
  const addressText = { link: 'Prefijo fe80::/64 e IID deducido del enlace para ambos extremos: 0 B de direcciones.', short: 'Prefijo fe80::/64 y patrón 0000:00ff:fe00:XXXX. Viaja XXXX (16 bits) de cada dirección: 4 B en total.', context: `Los extremos comparten el contexto ${c.cid} con el prefijo /64 y deducen ambos IID del enlace. ${r.cid ? 'Viaja 0x11: SCI=1 y DCI=1.' : 'CID=0 usa el contexto 0: no añade SCI/DCI.'}`, full: 'Se transmiten las dos direcciones completas: 16 + 16 = 32 B.' }[c.address];
  const saving = 48 - r.total;
  return metrics(metric(`${r.ip} B`, 'IPHC + campos IPv6'), metric(`${r.udp} B`, c.nh === '1' ? 'UDP con NHC' : 'UDP sin comprimir'), metric(`${r.total} B`, 'total IPv6 + UDP'))
    + `<p><strong>Los 16 bits de IPHC</strong> · En hexadecimal: <code>${r.bytes}</code></p><div class="bit-fields">${r.fields.map(([k, v]) => `<span>${k}<b>${v}</b></span>`).join('')}</div>`
    + table([['Base IPHC (incluye dispatch)', 2], ['SCI/DCI opcional', r.cid], ['Traffic Class / Flow Label', r.tf], ['Next Header explícito', r.nh], ['Hop Limit explícito', r.hlim], ['Dirección origen', r.address], ['Dirección destino', r.address], [c.nh === '1' ? `UDP: NHC (1) + puertos (${r.ports}) + checksum (2)` : 'UDP completo', r.udp]])
    + `<p><strong>Antes · 48 B</strong></p>${byteBar([['IPv6', 40], ['UDP', 8]], 48)}<p><strong>Ahora · ${r.total} B</strong> · ${saving >= 0 ? `Ahorro: ${saving}` : `Sobrecoste: ${-saving}`} B</p>${byteBar([['IPHC + campos', r.ip], ['UDP', r.udp]], Math.max(48, r.total))}`
    + `<div class="lab-detail"><p>${tfText}</p><p>${addressText}</p><p>${c.nh === '1' ? `UDP Length se deduce. NHC UDP: <code>11110 | 0 | ${c.ports}</code> (C=0, checksum presente).` : 'NH=0 añade el byte 17 (UDP) en IPv6; a continuación viaja la cabecera UDP completa de 8 B.'}</p></div>`;
}

export function hopsView(mode: 'mesh' | 'route', hop: 0 | 1) {
  const r = hopCompression(mode, hop), mesh = mode === 'mesh';
  const why = mesh ? 'Aunque cambia la MAC del salto, Originator=5 y Final Destination=1 en Mesh permiten deducir ambos IID: SAM=DAM=11.'
    : hop === 0 ? 'La MAC origen 5 permite deducir el IID fuente (SAM=11). La MAC destino 3 no identifica al destino IPv6 1: se envía 0001, los 16 bits finales (DAM=10).'
    : 'La MAC origen 3 no identifica al origen IPv6 5: se envía 0005, los 16 bits finales (SAM=10). La MAC destino 1 permite deducir el IID destino (DAM=11).';
  return `<ol class="route" aria-label="Recorrido radio 5 a 3 a 1; salto actual ${r.from} a ${r.to}"><li class="${hop === 0 ? 'is-active' : ''}">5</li><li class="link ${hop === 0 ? 'is-active' : ''}">MAC 5 → 3</li><li class="is-active">3</li><li class="link ${hop === 1 ? 'is-active' : ''}">MAC 3 → 1</li><li class="${hop === 1 ? 'is-active' : ''}">1</li></ol>`
    + '<p>IPv6 origen: <code>2001:11::ff:fe00:5</code><br>IPv6 destino: <code>2001:11::ff:fe00:1</code></p>'
    + metrics(metric(`SAM ${r.sam}`, 'compresión de origen'), metric(`DAM ${r.dam}`, 'compresión de destino'), metric(`${r.bytes} B`, 'direcciones en línea'))
    + `<div class="lab-detail"><p><strong>${mesh ? 'Mesh conserva los extremos 5 → 1.' : `El enlace solo identifica ${r.from} → ${r.to}.`}</strong></p><p>${why}</p><p>${mesh ? 'Al reenviar dentro de la malla disminuye Hops Left de Mesh; no es un nuevo salto IPv6.' : 'El router 3 procesa IPv6, reduce Hop Limit y vuelve a comprimir usando la información del nuevo enlace.'}</p></div>`;
}

// NDP network diagram: A and B on link 1, R between links, C on link 2; g is the multicast group bubble.
const nodes: Record<NodeId, [number, number]> = { a: [105, 130], b: [270, 270], r: [490, 130], c: [770, 130], g: [280, 130] };
export const packetColor = (type?: string) => `var(--color-packet-${(type ?? 'datos').toLowerCase()})`;
export function ndpDiagram(p: Packet | null, mode: string, id: string, animate = false) {
  const active = p ? [p.from, ...p.to] : [];
  const node = (key: NodeId, name: string, sub: string) => { const [x, y] = nodes[key]; return `<g class="${active.includes(key) ? 'is-active' : ''}" transform="translate(${x},${y})"><rect class="ndp-node" x="-58" y="-36" width="116" height="72" rx="13"/><text class="ndp-node-title" text-anchor="middle" y="-3">${name}</text><text text-anchor="middle" y="20">${sub}</text></g>`; };
  const paths = p ? p.to.map(to => {
    const [sx, sy] = nodes[p.from], [ex, ey] = nodes[to];
    const dx = ex - sx, dy = ey - sy, length = Math.hypot(dx, dy), margin = dy === 0 ? 70 : 52;
    const x1 = sx + (dx / length) * margin, y1 = sy + (dy / length) * margin, x2 = ex - (dx / length) * margin, y2 = ey - (dy / length) * margin;
    const d = `M ${x1} ${y1} Q ${(x1 + x2) / 2} ${(y1 + y2) / 2 + (y1 === y2 ? -62 : 0)} ${x2} ${y2}`;
    return `<path class="ndp-route" d="${d}" marker-end="url(#${id}-arrow)"/><g ${animate ? '' : `transform="translate(${x2},${y2})"`}><rect class="ndp-dot" x="-24" y="-13" width="48" height="26" rx="12"/><text class="ndp-packet-name" y="4">${p.type === 'DATOS' ? 'IPv6' : p.type}</text>${animate ? `<animateMotion dur="1.7s" path="${d}" fill="freeze"/>` : ''}</g>`;
  }).join('') : '';
  const title = p ? `${p.type} de ${p.from.toUpperCase()} a ${p.to.map(x => x === 'g' ? 'grupo multicast' : x.toUpperCase()).join(', ')}` : 'Red de ejemplo: dos enlaces separados por R';
  return `<svg viewBox="0 0 900 345" role="img" aria-labelledby="${id}-svg-title ${id}-svg-desc" style="--packet:${packetColor(p?.type)}"><title id="${id}-svg-title">${esc(title)}</title><desc id="${id}-svg-desc">A y B están en el enlace 1. R conecta con el enlace 2, donde está C. Las flechas muestran destinatarios lógicos; el switch no se dibuja. ${esc(p ? `${p.src} hacia ${p.dst}` : 'En este paso no se transmite ningún paquete.')}</desc><defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="ndp-arrow"/></marker></defs>`
    + '<rect class="ndp-zone-1" x="14" y="14" width="474" height="317" rx="16"/><rect class="ndp-zone-2" x="502" y="14" width="384" height="317" rx="16"/>'
    + '<text class="ndp-zone" x="35" y="43">ENLACE 1 · Ethernet / switch</text><text x="35" y="64">2001:db8:10::/64</text><text class="ndp-zone" x="530" y="43">ENLACE 2</text><text x="530" y="64">2001:db8:20::/64</text>'
    + '<path class="ndp-wire" d="M105 130 L490 130 L770 130 M270 270 L270 130"/><path class="ndp-divider" d="M495 78 V325"/><text x="515" y="252">R separa los enlaces.</text><text x="515" y="274">NDP se queda en cada uno.</text><text x="515" y="300">Datos IPv6: sí pueden cruzar.</text>'
    + node('a', 'A · host', 'fe80::a') + node('b', 'B · vecino', mode === 'duplicada' ? 'posee …:10::a' : 'fe80::b') + node('r', mode === 'sin-router' ? 'R ausente' : 'R · router', '1 ↔ 2') + node('c', 'C · remoto', '…:20::c')
    + '<text x="425" y="188">fe80::1</text><text x="515" y="188">fe80::2</text><text x="35" y="314">Flechas = entrega lógica; no se representa cada puerto del switch.</text>'
    + (p?.to.includes('g') ? '<g><rect class="ndp-group" x="211" y="99" width="138" height="62" rx="24"/><text x="280" y="121" text-anchor="middle">Grupo multicast</text><text x="280" y="144" text-anchor="middle">sin respuesta aquí</text></g>' : '')
    + `${paths}</svg>`;
}
const field = (name: string, value: unknown) => `<div><dt>${name}</dt><dd>${esc(value)}</dd></div>`;
export function packetView(p: Packet | null) {
  if (!p) return '<p class="meta">Sin paquete en este paso: cálculo, consulta o espera local.</p>';
  return `<dl class="ndp-fields">${field('IPv6 origen', p.src)}${field('IPv6 destino', p.dst)}${field('Target Address (campo de NS/NA)', p.target)}${field('Ethernet: MAC origen → MAC destino', p.l2)}${field('Hop Limit de la cabecera IPv6', p.hop)}${field('Contenido / opciones', p.options)}</dl>`;
}
export function stateView(s: HostState | null) {
  return s ? `<div class="ndp-state" aria-label="Estado de A después del paso"><div><strong>Direcciones de A</strong>${esc(s.address)}</div><div><strong>Rutas de A</strong>${esc(s.route)}</div><div><strong>Caché de vecinos de A</strong>${esc(s.cache)}</div></div>` : '';
}
export const stepView = (s: Step) => `<h4>${esc(s.title)}</h4><p>${esc(s.text)}</p><p class="meta"><strong>Alcance:</strong> ${esc(s.scope)}</p>${packetView(s.packet)}`;
