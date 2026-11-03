// HTML views of the reading labs. Astro renders the initial state with them (static and printable) and the client re-renders on input.
import { eui64, iphcSize, frameBudget, hopCompression, hex2, bin8, type IphcChoice } from '../../domain/laboratorios.ts';
import type { Packet, HostState, Step, NodeId } from '../../domain/ndp.ts';
import { decodePhyPayload, parseBytes } from '../../domain/lorawan.ts';
import { bridge, type Bridge } from '../../domain/puente.ts';
import { amplifier, type Amplifier } from '../../domain/amplificadores.ts';
import { analyzePattern, patternValue, mainDirection, type Pattern } from '../../domain/diagrama.ts';

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

/** Fields of a LoRaWAN data frame given as hex or Base64, with a byte bar and a table. */
export function lorawanFrameView(text: string) {
  const bytes = parseBytes(text);
  if (!bytes) return '<p class="lab-error">Escribe la trama en hexadecimal (por ejemplo, 60 27 A9 …) o en Base64 (por ejemplo, YCep/…).</p>';
  const r = decodePhyPayload(bytes);
  if ('error' in r) return `<p class="lab-error">${esc(r.error)}</p>`;
  const rows = r.fields.map(f => `<tr><th scope="row">${esc(f.name)}</th><td><code>${esc(f.bytes.map(hex2).join(' ').toUpperCase())}</code></td><td>${esc(f.value)}</td><td>${esc(f.note)}</td></tr>`).join('');
  return metrics(metric(`${bytes.length} B`, 'PHYPayload'), metric(r.type, 'tipo según MHDR')) + byteBar(r.fields.map(f => [f.name, f.bytes.length]), bytes.length)
    + `<div class="table-scroll"><table><thead><tr><th scope="col">Campo</th><th scope="col">Bytes</th><th scope="col">Valor</th><th scope="col">Significado</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

type Stage = { name: string; does: string; payload: string };
export const lorawanStages: Record<'up' | 'down', Stage[]> = {
  up: [
    { name: 'Nodo', does: 'Cifra los datos con AppSKey; la MAC añade MHDR, FHDR y FPort y calcula el MIC con NwkSKey. La capa física LoRa transmite la trama.', payload: 'Datos en claro → FRMPayload cifrado' },
    { name: 'Gateway', does: 'Recupera la trama LoRaWAN (PHYPayload) sin descifrarla y el packet forwarder la envía al NS por IP, en JSON, con RSSI, SNR, frecuencia y marca de tiempo.', payload: 'PHYPayload completo, cifrado' },
    { name: 'Network Server', does: 'Localiza la sesión por DevAddr, valida el MIC con NwkSKey, identifica dispositivo y aplicación, elimina duplicados de varios gateways y procesa comandos MAC y ADR.', payload: 'FRMPayload aún cifrado' },
    { name: 'Application Server', does: 'Descifra con AppSKey, aplica el payload decoder si existe y entrega los datos por MQTT o webhook HTTP, normalmente en JSON.', payload: 'Datos en claro (y decoded_payload)' },
    { name: 'Aplicación final', does: 'Visualiza, almacena y toma decisiones. Si el AS no decodifica, interpreta ella el payload.', payload: 'Datos en claro' },
  ],
  down: [
    { name: 'Aplicación final', does: 'Envía una orden al AS por MQTT o mediante la API HTTP.', payload: 'Orden en claro' },
    { name: 'Application Server', does: 'Codifica la orden al formato del dispositivo y la cifra con AppSKey. Entrega al NS el FRMPayload, la identidad del dispositivo, FPort y las opciones de envío.', payload: 'FRMPayload cifrado' },
    { name: 'Network Server', does: 'Construye el PHYPayload (MHDR 0x60 o 0xA0, FHDR con DevAddr) y el MIC con NwkSKey. Según la clase A, B o C programa el envío y elige el gateway.', payload: 'PHYPayload completo, cifrado' },
    { name: 'Gateway', does: 'Construye la trama física LoRa y la transmite en el instante, frecuencia, DR y potencia que indica el NS.', payload: 'PHYPayload completo, cifrado' },
    { name: 'Nodo', does: 'Verifica MIC y contador, descifra con AppSKey y entrega los datos a su aplicación. Si el downlink es confirmado, activa ACK en el siguiente uplink.', payload: 'Datos en claro' },
  ],
};
export const lorawanPathView = (dir: 'up' | 'down') =>
  `<ol class="lw-chain">${lorawanStages[dir].map(s => `<li><strong>${esc(s.name)}</strong><span class="lw-payload">${esc(s.payload)}</span><p>${esc(s.does)}</p></li>`).join('')}</ol>`;

// Wheatstone bridge (dispositivos.puente-wheatstone): diagram with live values and the three-step solution.
const num = (n: number, digits = 4) => n.toLocaleString('es-ES', { maximumFractionDigits: digits, useGrouping: false });
const volts = (v: number) => Math.abs(v) < 1e-9 ? '0 V' : Math.abs(v) < 1 ? `${num(v * 1000, 2)} mV` : `${num(v)} V`;
const ohms = (r: number) => `${num(r, 2)} Ω`;
/** Resistor between two points: straight leads and a zigzag in the middle third. */
function resistorPath(x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
  const at = (t: number, k = 0) => `${(x1 + dx * t + nx * k).toFixed(1)} ${(y1 + dy * t + ny * k).toFixed(1)}`;
  const zig = Array.from({ length: 7 }, (_, i) => `L ${at(0.33 + (0.34 * (i + 0.5)) / 7, i % 2 ? -9 : 9)}`).join(' ');
  return `M ${at(0)} L ${at(0.33)} ${zig} L ${at(0.67)} L ${at(1)}`;
}
export function bridgeDiagram(b: Bridge, id: string) {
  const r = bridge(b);
  if (!r) return '<p class="lab-error">Las resistencias deben ser números mayores que cero.</p>';
  const [top, left, right, bottom] = [[220, 55], [80, 190], [360, 190], [220, 325]];
  const label = (x: number, y: number, text: string, cls = '', anchor = 'middle') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(text)}</text>`;
  const sign = r.balanced ? 'equilibrado' : r.vo > 0 ? 'Vx mayor que Vy' : 'Vy mayor que Vx';
  return `<svg class="bridge-svg" viewBox="0 0 440 400" role="img" aria-labelledby="${id}-svg-title ${id}-svg-desc"><title id="${id}-svg-title">Puente de Wheatstone: Vo = ${esc(volts(r.vo))}</title>`
    + `<desc id="${id}-svg-desc">Alimentación VA = ${esc(volts(b.va))} arriba y masa abajo. Rama izquierda: R4 = ${esc(ohms(b.r4))} arriba y el sensor R1 = ${esc(ohms(b.r1))} abajo; su punto medio está a Vx = ${esc(volts(r.vx))}. Rama derecha: R3 = ${esc(ohms(b.r3))} arriba y R2 = ${esc(ohms(b.r2))} abajo; su punto medio está a Vy = ${esc(volts(r.vy))}. La salida se mide entre los dos puntos medios: ${esc(sign)}.</desc>`
    + `<path class="bridge-wire" d="M 220 32 V ${top[1]} M 220 ${bottom[1]} V 345 M 202 345 H 238 L 220 365 Z"/>`
    + `<path class="bridge-arm bridge-arm--x" d="${resistorPath(top[0], top[1], left[0], left[1])} ${resistorPath(left[0], left[1], bottom[0], bottom[1])}"/>`
    + `<path class="bridge-arm bridge-arm--y" d="${resistorPath(top[0], top[1], right[0], right[1])} ${resistorPath(right[0], right[1], bottom[0], bottom[1])}"/>`
    + `<path class="bridge-sensor" d="M 120 292 L 166 246 M 166 246 l -12 1 m 12 -1 l -1 12"/>`
    + `<path class="bridge-out" d="M ${left[0]} ${left[1]} H 190 M 250 ${right[1]} H ${right[0]}"/><circle class="bridge-node" cx="${left[0]}" cy="${left[1]}" r="6"/><circle class="bridge-node" cx="${right[0]}" cy="${right[1]}" r="6"/>`
    + label(220, 24, `VA = ${volts(b.va)}`, 'bridge-strong') + label(220, 392, 'masa (0 V)', 'bridge-muted')
    + label(126, 110, 'R4', 'bridge-strong', 'end') + label(126, 136, ohms(b.r4), 'bridge-muted', 'end')
    + label(314, 110, 'R3', 'bridge-strong', 'start') + label(314, 136, ohms(b.r3), 'bridge-muted', 'start')
    + label(108, 268, 'R1', 'bridge-strong', 'end') + label(108, 294, ohms(b.r1), 'bridge-muted', 'end')
    + label(332, 268, 'R2', 'bridge-strong', 'start') + label(332, 294, ohms(b.r2), 'bridge-muted', 'start')
    + label(66, 198, 'Vx', 'bridge-x', 'end') + label(374, 198, 'Vy', 'bridge-y', 'start')
    + label(220, 198, 'Vo', 'bridge-strong') + label(220, 226, volts(r.vo), 'bridge-muted')
    + '</svg>';
}
export function bridgeView(b: Bridge, id: string) {
  const r = bridge(b);
  if (!r) return bridgeDiagram(b, id);
  const verdict = r.balanced
    ? '<strong>Puente equilibrado</strong>: las dos ramas reparten la tensión en la misma proporción, así que Vx = Vy y Vo = 0.'
    : `<strong>Puente desequilibrado</strong>: ${r.vo > 0 ? 'R1 pesa más en su rama que R2 en la suya, así que Vx sube por encima de Vy y Vo es positiva' : 'R1 pesa menos en su rama que R2 en la suya, así que Vx queda por debajo de Vy y Vo es negativa'}. Lo equilibraría R1 = R4 · R2 / R3 = ${num(b.r4)} · ${num(b.r2)} / ${num(b.r3)} = ${ohms(r.r1Balance)}.`;
  return `<div class="bridge-figure">${bridgeDiagram(b, id)}</div>`
    + metrics(metric(volts(r.vx), 'Vx, rama izquierda'), metric(volts(r.vy), 'Vy, rama derecha'), metric(volts(r.vo), 'Vo = Vx − Vy'))
    + '<ol class="lab-detail">'
    + `<li><span class="bridge-x"><strong>Rama izquierda</strong></span>, divisor de R4 y R1: <span class="formula">Vx = VA · R1 / (R1 + R4) = ${num(b.va)} · ${num(b.r1)} / ${num(b.r1 + b.r4)} = ${volts(r.vx)}</span></li>`
    + `<li><span class="bridge-y"><strong>Rama derecha</strong></span>, divisor de R3 y R2: <span class="formula">Vy = VA · R2 / (R2 + R3) = ${num(b.va)} · ${num(b.r2)} / ${num(b.r2 + b.r3)} = ${volts(r.vy)}</span></li>`
    + `<li><strong>Salida</strong>: <span class="formula">Vo = Vx − Vy = ${volts(r.vx)} − ${volts(r.vy)} = ${volts(r.vo)}</span></li>`
    + `<li><strong>Comprobación</strong>: <span class="formula">R1/R4 = ${num(r.left)}</span> y <span class="formula">R2/R3 = ${num(r.right)}</span>. ${verdict}</li>`
    + '</ol>';
}

// Op-amp circuits (dispositivos.amplificadores): schematic with the values and the solution step by step.
const kohms = (r: number) => r >= 1000 ? `${num(r / 1000, 3)} kΩ` : `${num(r, 2)} Ω`;
const svgText = (x: number, y: number, text: string, cls = '', anchor = 'middle') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(text)}</text>`;
const zigH = (x1: number, x2: number, y: number) => `M ${x1} ${y} ${Array.from({ length: 6 }, (_, i) => `L ${x1 + ((x2 - x1) * (i + 0.5)) / 6} ${y + (i % 2 ? 9 : -9)}`).join(' ')} L ${x2} ${y}`;
const zigV = (x: number, y1: number, y2: number) => `M ${x} ${y1} ${Array.from({ length: 6 }, (_, i) => `L ${x + (i % 2 ? 9 : -9)} ${y1 + ((y2 - y1) * (i + 0.5)) / 6}`).join(' ')} L ${x} ${y2}`;
const ground = (x: number, y: number) => `M ${x} ${y - 10} V ${y} M ${x - 14} ${y} H ${x + 14} M ${x - 9} ${y + 6} H ${x + 9} M ${x - 4} ${y + 12} H ${x + 4}`;
const opampSymbol = '<path class="amp-body" d="M 250 110 V 230 L 350 170 Z"/>' + svgText(264, 148, '−', 'amp-strong') + svgText(264, 208, '+', 'amp-strong');
const outputWire = (vo: number) => '<path class="amp-wire" d="M 350 170 H 450"/><circle class="amp-node" cx="450" cy="170" r="5"/>' + svgText(462, 166, 'Vo', 'amp-strong', 'start') + svgText(462, 192, volts(vo), 'amp-out', 'start');
const feedback = (r2: number) => `<path class="amp-wire" d="M 210 140 V 60 H 270 M 350 60 H 410 V 170"/><path class="amp-res" d="${zigH(270, 350, 60)}"/><circle class="amp-node" cx="210" cy="140" r="5"/>` + svgText(310, 36, 'R2', 'amp-strong') + svgText(310, 90, kohms(r2), 'amp-muted');

export function amplifierDiagram(a: Amplifier, id: string) {
  const r = amplifier(a);
  if (!r) return '<p class="lab-error">Las resistencias deben ser números mayores que cero (R3 del diferencial puede valer 0).</p>';
  const names = { inversor: 'Amplificador inversor', 'no-inversor': 'Amplificador no inversor', diferencial: 'Amplificador diferencial', instrumentacion: 'Amplificador de instrumentación' };
  let body = '', desc = '';
  if (a.kind === 'inversor') {
    body = feedback(a.r2) + `<path class="amp-wire" d="M 60 140 H 90 M 170 140 H 250 M 250 200 H 210 V 222 ${ground(210, 232)}"/><path class="amp-res" d="${zigH(90, 170, 140)}"/>`
      + svgText(14, 128, 'Vi', 'amp-strong', 'start') + svgText(14, 170, volts(a.vi), 'amp-in', 'start') + svgText(130, 120, `R1 = ${kohms(a.r1)}`, 'amp-muted');
    desc = `Vi = ${volts(a.vi)} entra por R1 = ${kohms(a.r1)} a la entrada inversora; R2 = ${kohms(a.r2)} realimenta de la salida a esa entrada; la entrada no inversora va a masa.`;
  } else if (a.kind === 'no-inversor') {
    body = feedback(a.r2) + `<path class="amp-wire" d="M 250 140 H 160 M 80 140 H 50 V 160 ${ground(50, 170)} M 60 200 H 250"/><path class="amp-res" d="${zigH(80, 160, 140)}"/>`
      + svgText(14, 232, 'Vi', 'amp-strong', 'start') + svgText(14, 262, volts(a.vi), 'amp-in', 'start') + svgText(120, 120, `R1 = ${kohms(a.r1)}`, 'amp-muted');
    desc = `Vi = ${volts(a.vi)} entra directamente por la entrada no inversora; R1 = ${kohms(a.r1)} va de la entrada inversora a masa y R2 = ${kohms(a.r2)} realimenta desde la salida.`;
  } else if (a.kind === 'diferencial') {
    const r3 = a.r3 > 0 ? `<path class="amp-res" d="${zigH(90, 170, 200)}"/>` + svgText(130, 234, `R3 = ${kohms(a.r3)}`, 'amp-muted') : '<path class="amp-wire" d="M 90 200 H 170"/>' + svgText(130, 234, 'R3 = 0', 'amp-muted');
    body = feedback(a.r2) + `<path class="amp-wire" d="M 60 140 H 90 M 170 140 H 250 M 60 200 H 90 M 170 200 H 250 M 210 200 V 214 M 210 270 V 278 ${ground(210, 288)}"/><path class="amp-res" d="${zigH(90, 170, 140)} ${zigV(210, 214, 270)}"/><circle class="amp-node" cx="210" cy="200" r="5"/>`
      + svgText(14, 128, 'V1', 'amp-strong', 'start') + svgText(14, 170, volts(a.v1), 'amp-in', 'start') + svgText(130, 120, `R1 = ${kohms(a.r1)}`, 'amp-muted')
      + svgText(14, 230, 'V2', 'amp-strong', 'start') + svgText(14, 262, volts(a.v2), 'amp-in', 'start') + r3 + svgText(226, 250, 'R4', 'amp-strong', 'start') + svgText(226, 276, kohms(a.r4), 'amp-muted', 'start');
    desc = `V1 = ${volts(a.v1)} entra por R1 = ${kohms(a.r1)} a la entrada inversora, con R2 = ${kohms(a.r2)} de realimentación. V2 = ${volts(a.v2)} llega a la entrada no inversora por el divisor de R3 = ${kohms(a.r3)} y R4 = ${kohms(a.r4)} a masa.`;
  } else {
    body = `<rect class="amp-box" x="195" y="70" width="155" height="170" rx="8"/><rect class="amp-box" x="380" y="110" width="100" height="120" rx="8"/>`
      + '<path class="amp-wire" d="M 20 110 H 195 M 20 200 H 195 M 350 140 H 380 M 350 200 H 380 M 480 170 H 515"/><circle class="amp-node" cx="515" cy="170" r="5"/>'
      + svgText(20, 98, `Vi− = ${volts(a.vim)}`, 'amp-in', 'start') + svgText(20, 188, `Vi+ = ${volts(a.vip)}`, 'amp-in', 'start')
      + svgText(272, 104, 'Etapa 1', 'amp-strong') + svgText(272, 144, `R1 = ${kohms(a.r1)}`, 'amp-muted') + svgText(272, 174, `Rg = ${kohms(a.rg)}`, 'amp-muted') + svgText(272, 218, `× ${num(1 + (2 * a.r1) / a.rg, 3)}`, 'amp-strong')
      + svgText(430, 150, 'Etapa 2', 'amp-strong') + svgText(430, 198, `× ${num(a.r3 / a.r2, 3)}`, 'amp-strong')
      + svgText(535, 150, 'Vo', 'amp-strong', 'end') + svgText(535, 268, volts(r.vo), 'amp-out', 'end');
    desc = `Primera etapa con dos operacionales, R1 = ${kohms(a.r1)} y Rg = ${kohms(a.rg)}; segunda etapa diferencial con R3/R2 = ${num(a.r3 / a.r2, 3)}. Entradas Vi+ = ${volts(a.vip)} y Vi− = ${volts(a.vim)}.`;
    return `<svg class="amp-svg" viewBox="0 0 540 300" role="img" aria-labelledby="${id}-svg-title ${id}-svg-desc"><title id="${id}-svg-title">${names[a.kind]}: Vo = ${esc(volts(r.vo))}</title><desc id="${id}-svg-desc">${esc(desc)}</desc>${body}</svg>`;
  }
  return `<svg class="amp-svg" viewBox="0 0 540 300" role="img" aria-labelledby="${id}-svg-title ${id}-svg-desc"><title id="${id}-svg-title">${names[a.kind]}: Vo = ${esc(volts(r.vo))}</title><desc id="${id}-svg-desc">${esc(desc)}</desc>${body}${opampSymbol}${outputWire(r.vo)}</svg>`;
}

export function amplifierView(a: Amplifier, id: string) {
  const r = amplifier(a);
  if (!r) return amplifierDiagram(a, id);
  const f = (s: string) => `<span class="formula">${s}</span>`;
  const steps: string[] = [];
  if (a.kind === 'inversor') {
    steps.push(`<strong>Entrada +</strong>: está a masa, V+ = 0. Por el cortocircuito virtual, V− = V+ = 0.`);
    steps.push(`<strong>Corriente por R1</strong>: ${f(`I1 = (Vi − 0) / R1 = ${volts(a.vi)} / ${kohms(a.r1)}`)}. Como no entra corriente en el operacional, toda sigue por R2: I2 = I1.`);
    steps.push(`<strong>Salida</strong>: ${f(`Vo = −(R2/R1) · Vi = −(${kohms(a.r2)} / ${kohms(a.r1)}) · ${volts(a.vi)} = ${volts(r.ideal)}`)}. El signo menos invierte la señal.`);
  } else if (a.kind === 'no-inversor') {
    steps.push(`<strong>Entrada +</strong>: recibe Vi directamente, V+ = ${volts(a.vi)}. Por el cortocircuito virtual, V− = ${volts(a.vi)}.`);
    steps.push(`<strong>Divisor R1-R2</strong>: V− es la parte de Vo que cae en R1, ${f('V− = Vo · R1 / (R1 + R2)')}. Despejando, ${f('Vo = (1 + R2/R1) · Vi')}.`);
    steps.push(`<strong>Salida</strong>: ${f(`Vo = (1 + ${kohms(a.r2)} / ${kohms(a.r1)}) · ${volts(a.vi)} = ${num(r.gain!, 4)} · ${volts(a.vi)} = ${volts(r.ideal)}`)}. No invierte y la ganancia nunca es menor que 1.`);
  } else if (a.kind === 'diferencial') {
    steps.push(`<strong>Tensión en +</strong>: ${a.r3 > 0 ? f(`V+ = V2 · R4 / (R3 + R4) = ${volts(a.v2)} · ${kohms(a.r4)} / ${kohms(a.r3 + a.r4)} = ${volts(r.vplus!)}`) : `con R3 = 0, la fuente V2 está conectada directamente a la entrada + y fija ${f(`V+ = V2 = ${volts(a.v2)}`)}; R4 en paralelo con una fuente ideal no cambia esa tensión`}.`);
    steps.push(`<strong>Superposición, solo V1</strong> (V2 = 0, así que V+ = 0): es un inversor, ${f(`−(R2/R1) · V1 = −(${kohms(a.r2)} / ${kohms(a.r1)}) · ${volts(a.v1)} = ${volts(r.term1!)}`)}.`);
    steps.push(`<strong>Superposición, solo V2</strong> (V1 = 0, R1 queda a masa): es un no inversor que amplifica V+, ${f(`(1 + R2/R1) · V+ = (1 + ${kohms(a.r2)} / ${kohms(a.r1)}) · ${volts(r.vplus!)} = ${volts(r.term2!)}`)}.`);
    steps.push(`<strong>Suma</strong>: ${f(`Vo = ${volts(r.term1!)} + ${volts(r.term2!)} = ${volts(r.ideal)}`)}.`
      + (a.r1 === a.r3 && a.r2 === a.r4 ? ` Es simétrico (R1 = R3, R2 = R4), así que también sale directo con ${f(`Vo = (R2/R1) · (V2 − V1) = ${num(a.r2 / a.r1, 4)} · ${volts(a.v2 - a.v1)}`)}.` : ''));
  } else {
    steps.push(`<strong>Ganancia</strong>: ${f(`G = (R3/R2) · (1 + 2R1/Rg) = ${num(a.r3 / a.r2, 4)} · (1 + 2 · ${kohms(a.r1)} / ${kohms(a.rg)}) = ${num(r.gain!, 4)}`)}. Con la segunda etapa de ganancia unidad (R2 = R3), toda la ganancia la da Rg.`);
    steps.push(`<strong>Señal diferencial</strong>: ${f(`Vd = Vi+ − Vi− = ${volts(a.vip)} − ${volts(a.vim)} = ${volts(a.vip - a.vim)}`)}. El modo común, lo que comparten las dos entradas (${volts((a.vip + a.vim) / 2)}), idealmente no pasa a la salida.`);
    steps.push(`<strong>Salida</strong>: ${f(`Vo = G · Vd = ${num(r.gain!, 4)} · ${volts(a.vip - a.vim)} = ${volts(r.ideal)}`)}.`);
  }
  steps.push(`<strong>¿Puede darla?</strong> La salida no puede superar la alimentación (±${num(Math.abs(a.vcc))} V). `
    + (r.saturated ? `Saldrían ${volts(r.ideal)}: el operacional <strong>satura</strong> y se queda en ${volts(r.vo)} (algo menos en uno real). La salida deja de ser proporcional a la entrada.` : `${volts(r.ideal)} cabe dentro de ese margen: <strong>sí</strong>.`));
  return `<div class="amp-figure" tabindex="0" role="group" aria-label="Esquema del circuito; desplázalo si no cabe">${amplifierDiagram(a, id)}</div>`
    + metrics(metric(volts(r.vo), r.saturated ? 'Vo (saturada)' : 'Vo'), ...(r.gain !== undefined ? [metric(num(r.gain, 4), 'ganancia')] : []), ...(r.vplus !== undefined ? [metric(volts(r.vplus), 'V+ = V−')] : []))
    + `<ol class="lab-detail">${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
}

// Radiation patterns (dispositivos.diagrama-radiacion): polar cut with z upwards, −3 dB circle, beam widths and directivity.
export const patternNames = (p: Pattern) => p.kind === 'cosn' ? `cos${p.n === 2 ? '²' : `^${p.n}`} θ` : p.kind === 'dipolo-corto' ? 'sen² θ (dipolo corto)' : 'dipolo λ/2';
const degrees = (a: number) => `${num(a, 1)}°`;

export function radiationDiagram(p: Pattern, id: string) {
  const cx = 210, cy = 205, R = 165;
  const at = (theta: number, f: number) => [cx + R * f * Math.sin(theta), cy - R * f * Math.cos(theta)] as const;
  const pts = Array.from({ length: 721 }, (_, i) => { const t = -Math.PI + (i * Math.PI) / 360; return at(t, patternValue(p, t)); });
  const shape = `M ${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')} Z`;
  const r = analyzePattern(p);
  let marks = '';
  if (r?.hpbw) {
    const m = mainDirection(p) * Math.PI / 180, h = (r.hpbw / 2) * Math.PI / 180;
    const [x1, y1] = at(m - h, 1.08), [x2, y2] = at(m + h, 1.08);
    const [ax1, ay1] = at(m - h, 0.5), [ax2, ay2] = at(m + h, 0.5);
    const large = r.hpbw > 180 ? 1 : 0;
    marks += `<path class="rad-beam" d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} M ${cx} ${cy} L ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`
      + `<path class="rad-arc" d="M ${ax1.toFixed(1)} ${ay1.toFixed(1)} A ${R * 0.5} ${R * 0.5} 0 ${large} 1 ${ax2.toFixed(1)} ${ay2.toFixed(1)}"/>`
      + `<circle class="rad-point" cx="${ax1.toFixed(1)}" cy="${ay1.toFixed(1)}" r="5"/><circle class="rad-point" cx="${ax2.toFixed(1)}" cy="${ay2.toFixed(1)}" r="5"/>`;
    marks += p.kind === 'cosn'
      ? svgText(cx, cy - R * 0.5 - 14, `HPBW ${degrees(r.hpbw)}`, 'rad-hpbw')
      : svgText(cx + R * 0.5 + 12, cy - 10, `HPBW ${degrees(r.hpbw)}`, 'rad-hpbw', 'start');
  }
  const wire = p.kind === 'cosn' ? '' : `<path class="rad-wire" d="M ${cx} ${cy - 34} V ${cy + 34}"/>`;
  return `<svg class="rad-svg" viewBox="0 0 420 430" role="img" aria-labelledby="${id}-svg-t"><title id="${id}-svg-t">Corte del diagrama de potencia ${esc(patternNames(p))} en un plano que contiene el eje z</title>`
    + `<circle class="rad-grid" cx="${cx}" cy="${cy}" r="${R}"/><circle class="rad-half" cx="${cx}" cy="${cy}" r="${R / 2}"/>`
    + `<path class="rad-axis" d="M ${cx} ${cy - R - 18} V ${cy + R + 6} M ${cx - R - 6} ${cy} H ${cx + R + 6}"/>`
    + `<path class="rad-shape" d="${shape}"/>${wire}${marks}`
    + svgText(cx + 8, cy - R - 20, '+z (θ = 0°)', 'rad-label', 'start')
    + svgText(cx + R - 4, cy + 22, 'θ = 90°', 'rad-label', 'end')
    + svgText(cx + 8, cy + R + 22, 'θ = 180°', 'rad-label', 'start')
    + svgText(cx - R / 2 + 4, cy + 20, '0,5', 'rad-muted', 'start')
    + svgText(cx - R + 4, cy + 20, '1', 'rad-muted', 'start')
    + '</svg>';
}

export function radiationView(p: Pattern, id: string) {
  const r = analyzePattern(p);
  if (!r) return '<p class="lab-error">El exponente debe ser un número par entre 2 y 20.</p>';
  const k = num(r.directivity, 3);
  const steps: string[] = [];
  if (p.kind === 'cosn') {
    steps.push(`<strong>Constante K</strong>. Se escribe d(θ) = K · cos${p.n === 2 ? '²' : `^${p.n}`} θ y se impone la normalización: <span class="formula">∫₀^π cos^${p.n} θ · sen θ dθ = 2/${p.n + 1} = ${num(r.integral, 4)}</span>, así que <span class="formula">K · 2π · ${num(r.integral, 4)} = 4π → K = ${k}</span>. La directividad es ${k} (${num(r.directivityDb, 2)} dBi).`);
    steps.push('<strong>Máximos</strong> donde cos θ = ±1: θ = 0° (+z) y θ = 180° (−z). <strong>Nulo</strong> donde cos θ = 0: todo el plano θ = 90°.');
    steps.push(`<strong>HPBW</strong>: la potencia cae a la mitad cuando cos^${p.n} α = 0,5, en α = ±${degrees(r.hpbw! / 2)} → HPBW = ${degrees(r.hpbw!)}. <strong>FNBW</strong>: los primeros nulos están a ±90° del máximo → ${degrees(r.fnbw!)}.`);
  } else {
    const name = p.kind === 'dipolo-corto' ? 'dipolo corto' : 'dipolo λ/2';
    steps.push(`<strong>Constante K</strong>. La integral de la normalización vale ${num(r.integral, 4)}, así que <span class="formula">K = 2 / ${num(r.integral, 4)} = ${k}</span>: la ganancia máxima del ${name} en las diapositivas (${num(r.directivityDb, 2)} dBi).`);
    steps.push('<strong>Máximo</strong> en θ = 90°: todo el plano perpendicular al hilo, igual en cualquier φ (un donut). <strong>Nulos</strong> a lo largo del propio hilo, θ = 0° y 180°.');
    steps.push(`<strong>HPBW</strong>: la potencia cae a la mitad a ±${degrees(r.hpbw! / 2)} del plano θ = 90° → ${degrees(r.hpbw!)}. <strong>FNBW</strong>: los nulos están a ±90° del máximo → ${degrees(r.fnbw!)}.`);
  }
  return `<div class="rad-figure">${radiationDiagram(p, id)}</div>`
    + metrics(metric(`${k} (${num(r.directivityDb, 2)} dBi)`, 'directividad'), metric(degrees(r.hpbw!), 'HPBW'), metric(degrees(r.fnbw!), 'FNBW'))
    + `<ol class="lab-detail">${steps.map(s => `<li>${s}</li>`).join('')}</ol>`;
}
