// Deterministic NDP/SLAAC teaching scenarios: plain data, no DOM. Two links: A and B on link 1, R between, C on link 2.
export type NodeId = 'a' | 'b' | 'r' | 'c' | 'g';
export type PacketType = 'RS' | 'RA' | 'NS' | 'NA' | 'DATOS';
export interface Packet { type: PacketType; from: NodeId; to: NodeId[]; src: string; dst: string; target: string; l2: string; options: string; hop: number }
export interface HostState { address: string; route: string; cache: string }
export interface Step { title: string; text: string; scope: string; packet: Packet | null; state: HostState | null }

export const A = '2001:db8:10::a', B = '2001:db8:10::b', C = '2001:db8:20::c';
export const mac = { a: '02:00:00:00:00:0a', b: '02:00:00:00:00:0b', r: '02:00:00:00:01:01', r2: '02:00:00:00:02:01', c: '02:00:00:00:00:0c' };
export const scenarios = {
  slaac: [['normal', 'SLAAC correcto'], ['duplicada', 'B ya tiene la dirección candidata'], ['sin-router', 'No hay router ni RA']],
  envio: [['local', 'A → B · mismo enlace, caché vacía'], ['remoto', 'A → C · otra red, caché vacía'], ['cache', 'A → C · MAC de R ya conocida'], ['nud', 'NUD · comprobar si B sigue accesible']],
} as const;
export type FlowKind = keyof typeof scenarios;

const state = (address = 'Sin dirección utilizable', route = 'Sin ruta por defecto', cache = 'Vacía'): HostState => ({ address, route, cache });
const ready = state(`fe80::a y ${A} utilizables`, '2001:db8:10::/64 en enlace; ::/0 vía fe80::1', 'Vacía');
const packet = (type: PacketType, from: NodeId, to: NodeId[], src: string, dst: string, target: string, l2: string, options: string): Packet => ({ type, from, to, src, dst, target, l2, options, hop: 255 });
const step = (title: string, text: string, scope: string, p: Packet | null = null, s: HostState | null = null): Step => ({ title, text, scope, packet: p, state: s });
const local = 'Solo enlace 1. R no reenvía este mensaje al enlace 2.';
const rs = () => packet('RS', 'a', ['r'], 'fe80::a', 'ff02::2', '—', `${mac.a} → 33:33:00:00:00:02`, 'ICMPv6 133 · SLLAO = MAC de A');
const ra = (unicast = false) => packet('RA', 'r', unicast ? ['a'] : ['a', 'b'], 'fe80::1', unicast ? 'fe80::a' : 'ff02::1', '—', `${mac.r} → ${unicast ? mac.a : '33:33:00:00:00:01'}`, 'ICMPv6 134 · prefijo 2001:db8:10::/64 · A=1, L=1 · M=0, O=0 · Router Lifetime=1800 s · SLLAO de R');
const dad = (addr: string, duplicate = false) => packet('NS', 'a', duplicate ? ['b'] : ['g'], '::', 'ff02::1:ff00:a', addr, `${mac.a} → 33:33:ff:00:00:0a`, 'ICMPv6 135 · sin SLLAO: el origen IPv6 es ::');
const ns = (router = false) => packet('NS', 'a', [router ? 'r' : 'b'], router ? 'fe80::a' : A, router ? 'ff02::1:ff00:1' : 'ff02::1:ff00:b', router ? 'fe80::1' : B, `${mac.a} → ${router ? '33:33:ff:00:00:01' : '33:33:ff:00:00:0b'}`, 'ICMPv6 135 · SLLAO = MAC de A');
const na = (router = false) => packet('NA', router ? 'r' : 'b', ['a'], router ? 'fe80::1' : B, router ? 'fe80::a' : A, router ? 'fe80::1' : B, `${router ? mac.r : mac.b} → ${mac.a}`, `ICMPv6 136 · TLLAO del objetivo · S=1 (solicitado), O=1, R=${router ? '1' : '0'}`);
const data = (remote = false, forward = false): Packet => ({ ...packet('DATOS', forward ? 'r' : 'a', [forward ? 'c' : remote ? 'r' : 'b'], A, remote ? C : B, '—', `${forward ? mac.r2 : mac.a} → ${forward ? mac.c : remote ? mac.r : mac.b}`, 'Ejemplo de paquete IPv6 con UDP; no es un mensaje NDP'), hop: forward ? 63 : 64 });

export function slaac(mode: string): Step[] {
  let s = state('fe80::a tentativa');
  const list = [
    step('Crear link-local', 'A elige el IID ::a para simplificar el dibujo y forma fe80::a. Todavía no puede usarla como dirección normal. El IID no tiene que proceder de la MAC.', 'Operación interna de A: no se transmite ningún paquete.', null, s),
    step('NS · DAD link-local', 'A pregunta si alguien usa fe80::a. Target contiene la candidata, pero el origen IPv6 es ::. El globo del dibujo representa el grupo solicited-node, no un equipo que contesta.', local, dad('fe80::a'), s),
  ];
  s = state('fe80::a utilizable');
  list.push(step('DAD sin conflicto', 'Tras completar los intentos y la espera de DAD sin detectar conflicto, A puede asignar fe80::a. Nadie envía un NA para decir «está libre».', 'Espera local. El tiempo de esta animación no representa los temporizadores reales.', null, s));
  const request = rs();
  if (mode === 'sin-router') request.to = ['g'];
  list.push(step('RS · Buscar routers', 'A solicita un anuncio a ff02::2. Solo los routers del enlace son destinatarios de este grupo. B no responde a un RS.', mode === 'sin-router' ? 'Solo enlace 1. No hay un router que reciba la solicitud.' : 'R recibe el RS como destinatario local. Recibirlo no significa reenviarlo.', request, s));
  if (mode === 'sin-router') {
    list.push(step('No llega ningún RA', 'Después de los reintentos y esperas, en este escenario no se descubre ningún router. A conserva su link-local, pero no aprende un prefijo global por SLAAC ni una ruta por defecto. Puede hablar con vecinos usando link-local.', 'Los RS no salen del enlace para buscar routers remotos.', null, s));
    return list;
  }
  s = state(`fe80::a utilizable; ${A} tentativa`, '2001:db8:10::/64 en enlace (L=1); ::/0 vía fe80::1 (1800 s)', 'fe80::1 → MAC de R (STALE, por SLLAO del RA)');
  list.push(step('RA · Prefijo y router', 'R anuncia su información a ff02::1: la reciben A y B. A=1 permite formar una dirección con el prefijo /64 y el IID. L=1 indica que el prefijo está en el enlace; Router Lifetime>0 permite usar R por defecto. Son decisiones distintas.', 'R origina este RA en el enlace 1; C no lo recibe. Un RA también puede llegar periódicamente, sin un RS previo.', ra(), s));
  list.push(step('NS · DAD global', `A ha formado ${A} y comprueba duplicados. La dirección global sigue siendo tentativa. Comparte solicited-node con fe80::a porque ambas terminan en los mismos 24 bits.`, local, dad(A, mode === 'duplicada'), s));
  if (mode === 'duplicada') {
    const conflict = packet('NA', 'b', ['a', 'r'], A, 'ff02::1', A, `${mac.b} → 33:33:00:00:00:01`, 'ICMPv6 136 · TLLAO = MAC de B · S=0: responde a una NS cuyo origen era ::');
    s = { ...s, address: `fe80::a utilizable; ${A} DUPLICADA, no asignada` };
    list.push(step('NA · Hay duplicado', `En esta variante B ya tiene ${A}. Responde a todos los nodos del enlace: no puede responder por unicast a ::. A detecta el conflicto y no asigna esa candidata. No hay un servidor que le conceda otra dirección.`, 'Multicast de enlace a ff02::1. R recibe el NA, pero no lo reenvía.', conflict, s));
    list.push(step('Detener esta candidata', 'Para continuar hará falta resolver el conflicto y comprobar una nueva candidata. Este caso ilustra un propietario ya configurado; si dos nodos hacen DAD a la vez, recibir otra NS de DAD también puede revelar el conflicto.', 'La link-local válida se conserva en este ejemplo: el conflicto era solo con la candidata global.', null, s));
  } else {
    s = { ...s, address: `fe80::a y ${A} utilizables` };
    list.push(step('Lista para comunicar', 'Al terminar DAD sin detectar conflicto, A puede usar la dirección global. Ya conoce el prefijo en enlace, el router por defecto y, gracias a la opción SLLAO de este RA, la MAC de R.', 'No se transmite un mensaje de «confirmación SLAAC». El RA no asigna una dirección individual a A.', null, s));
  }
  return list;
}

export function delivery(mode: string): Step[] {
  const remote = mode === 'remoto' || mode === 'cache';
  let s = { ...ready };
  if (mode === 'nud') {
    s.cache = `${B} → MAC de B (STALE)`;
    const probe = packet('NS', 'a', ['b'], A, B, B, `${mac.a} → ${mac.b}`, 'ICMPv6 135 · prueba NUD unicast; ya se conoce la MAC');
    return [
      step('Vecino STALE', 'La MAC de B está guardada, pero falta confirmación reciente de alcanzabilidad. STALE no significa «caído».', 'Operación local sobre la caché.', null, s),
      step('Enviar y pasar a DELAY', 'A puede enviar usando la entrada STALE. Empieza una espera para permitir que una confirmación de capas superiores evite sondear al vecino.', 'Datos directos de A a B en el enlace 1.', data(), { ...s, cache: `${B} → MAC de B (DELAY)` }),
      step('NS · Prueba unicast', 'En este caso no llega confirmación durante DELAY: se entra en PROBE y se envía NS directamente a la IPv6 de B. No se usa solicited-node porque ya conocemos la MAC.', local, probe, { ...s, cache: `${B} → MAC de B (PROBE)` }),
      step('NA · Alcanzable', 'B responde con un NA solicitado (S=1). La entrada pasa a REACHABLE. Si las pruebas se agotan sin respuesta, se elimina la entrada y se debe volver a resolver o buscar una alternativa.', local, na(), { ...s, cache: `${B} → MAC de B (REACHABLE)` }),
    ];
  }
  if (mode === 'cache') s.cache = 'fe80::1 → MAC de R (REACHABLE)';
  const list = [step('Elegir siguiente salto', remote ? `C está en otro prefijo. La ruta por defecto elige fe80::1 (R) como siguiente salto. La IPv6 destino del paquete sigue siendo ${C}.` : 'B pertenece al prefijo anunciado con L=1. La ruta en enlace indica entrega directa: el siguiente salto es B, no R.', 'Primero se consulta la tabla de rutas. Después, la caché de vecinos.', null, s)];
  if (mode !== 'cache') {
    list.push(step(`NS · Resolver ${remote ? 'R' : 'B'}`, remote ? 'A busca la MAC de fe80::1, su siguiente salto. No pregunta por la MAC de C: C no está en este enlace.' : `A busca la MAC de ${B}. La NS va a su grupo solicited-node. Un router no es necesario para esta resolución.`, local, ns(remote), { ...s, cache: `${remote ? 'fe80::1' : B} → INCOMPLETE (resolviendo)` }));
    s = { ...s, cache: `${remote ? 'fe80::1 → MAC de R' : `${B} → MAC de B`} (REACHABLE)` };
    list.push(step('NA · Aprender MAC', `${remote ? 'R' : 'B'} responde por unicast a A e incluye su dirección de enlace en TLLAO. A completa la caché y puede enviar el paquete pendiente.`, local, na(remote), s));
  } else list.push(step('La caché evita NS/NA', 'La entrada de R está REACHABLE. A usa su MAC directamente: no necesita repetir NS/NA por cada paquete. Un RA con SLLAO también puede haber proporcionado la MAC, aunque no prueba por sí mismo alcanzabilidad bidireccional.', 'Consulta local; no sale ningún paquete de descubrimiento.', null, s));
  list.push(step(remote ? 'Datos · A → R' : 'Datos · A → B', remote ? 'La trama Ethernet tiene la MAC de R como destino. Dentro, IPv6 mantiene A → C. R recibe la trama porque es el siguiente salto y examina la IPv6 destino para reenviar.' : 'A encapsula el paquete IPv6 en una trama dirigida a la MAC de B. R no es un salto de esta comunicación.', `IPv6 ${remote ? 'A → C; primer tramo físico A → R.' : 'A → B; entrega directa en el enlace 1.'}`, data(remote), s));
  if (remote) {
    const resolve = packet('NS', 'r', ['c'], '2001:db8:20::1', 'ff02::1:ff00:c', C, `${mac.r2} → 33:33:ff:00:00:0c`, 'ICMPv6 135 · SLLAO = MAC de R en enlace 2');
    const response = packet('NA', 'c', ['r'], C, '2001:db8:20::1', C, `${mac.c} → ${mac.r2}`, 'ICMPv6 136 · TLLAO = MAC de C · S=1, O=1, R=0');
    list.push(step('NS · R resuelve C', 'R tiene una ruta conectada al enlace 2. En este ejemplo su caché de C está vacía, así que R origina una nueva NS para C y mantiene pendiente el paquete de datos.', 'Solo enlace 2. Esta es otra NS, creada por R; no es la NS de A reenviada.', resolve, s));
    list.push(step('NA · C responde a R', 'C comunica su MAC a la interfaz de R en el enlace 2. La asociación se guarda en la caché de R, no en la de A.', 'Solo enlace 2. A y B no reciben este NA.', response, s));
    list.push(step('Datos · R → C', 'R construye una nueva trama: MAC origen de su interfaz del enlace 2 y MAC destino de C. Las IPv6 origen y destino siguen siendo A y C; Hop Limit baja de 64 a 63.', 'El paquete de DATOS cruza el router. Los intercambios NDP quedan en cada enlace.', data(true, true), s));
  }
  return list;
}

export const flows: Record<FlowKind, (mode: string) => Step[]> = { slaac, envio: delivery };

export const messages: Record<'rs' | 'ra' | 'ra-unicast' | 'ns' | 'na', { label: string } & Step> = {
  rs: { label: 'RS · 133', ...step('RS · Router Solicitation · 133', 'Un host pide a los routers del enlace que anuncien su configuración. No pide una MAC ni solicita que un router reenvíe el RS. Puede usar :: como origen si aún no tiene una dirección asignada; en ese caso no incluye SLLAO.', 'ff02::2 = todos los routers de ESTE enlace.', rs()) },
  ra: { label: 'RA multicast · 134', ...step('RA · Router Advertisement · 134', 'Un router anuncia prefijos y parámetros desde su link-local. Los RA periódicos van a ff02::1. En respuesta a un RS con origen asignado, el router también puede elegir unicast al solicitante.', 'ff02::1 = todos los nodos de ESTE enlace, incluidos hosts y routers.', ra()) },
  'ra-unicast': { label: 'RA unicast · 134', ...step('RA · Respuesta unicast · 134', 'Aquí el RS había usado fe80::a. R responde solo a A. Esta es una opción válida: una respuesta a RS también puede ser multicast. Si el RS usa origen ::, la respuesta RA debe ir a ff02::1.', 'Unicast R → A, dentro del enlace 1.', ra(true)) },
  ns: { label: 'NS · 135', ...step('NS · Neighbor Solicitation · 135', 'Para resolver la dirección de enlace de B, A envía NS al solicited-node de B. Target Address es la IPv6 que buscamos; no es la IPv6 multicast de destino. Otros nodos pueden compartir grupo si coinciden sus últimos 24 bits, pero solo el propietario responde normalmente.', 'Solicited-node tiene ámbito de enlace. NS también sirve para DAD y para NUD unicast.', ns()) },
  na: { label: 'NA · 136', ...step('NA · Neighbor Advertisement · 136', 'B anuncia su dirección de enlace. Esta respuesta a una NS con origen asignado es unicast al solicitante y lleva S=1. El NA de respuesta a DAD va a ff02::1 y lleva S=0; también existen anuncios no solicitados.', 'Unicast B → A, dentro del enlace 1.', na()) },
};

export interface RaFlags { a: boolean; l: boolean; router: boolean; m: boolean; o: boolean }
/** What host A learns from an initial RA with these flags. */
export function raOutcome(f: RaFlags) {
  return {
    state: state(
      f.a ? `Se forma ${A}; utilizable después de DAD.` : 'Este prefijo no genera una dirección SLAAC (A=0). Link-local conservada.',
      `${f.l ? '2001:db8:10::/64 en enlace. ' : 'No se aprende ruta en enlace de este PIO. '}${f.router ? '::/0 vía fe80::1.' : 'R no se añade como router por defecto.'}`,
      'La SLLAO del RA permite aprender la MAC de R; no la controlan A, L, M u O.',
    ),
    dhcp: f.m ? 'M=1 anuncia disponibilidad de direcciones y otros parámetros por DHCPv6. Puede coexistir con SLAAC si A=1.' : f.o ? 'M=0, O=1 anuncia otros parámetros por DHCPv6, sin anunciar asignación de direcciones mediante M.' : 'M=0, O=0 no anuncia configuración mediante DHCPv6.',
    consequence: (!f.l ? 'A=1 no convierte el prefijo en «en enlace». L=0 no declara que esté fuera: simplemente no aporta esa información. ' : f.a ? 'A y L están activos: dirección por SLAAC y ruta en enlace se obtienen por mecanismos distintos. ' : 'L=1 permite aprender un prefijo en enlace aunque A=0. ')
      + (!f.router ? 'Tener dirección global no garantiza disponer de salida a otras redes.' : 'La ruta por defecto procede del Router Lifetime del RA, no de DHCPv6.'),
  };
}
