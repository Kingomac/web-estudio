// Registro declarativo compartido por la CLI de Bun y Astro.
export const components: Record<string, { title: string; file: string }> = {
  'protocolos.ndp': { title: 'Resolución de vecinos NDP', file: 'src/components/lectura/Ndp.astro' },
  'protocolos.cabecera-ipv6': { title: 'Cabecera IPv6 campo a campo', file: 'src/components/lectura/CabeceraIpv6.astro' },
  'protocolos.eui64': { title: 'Construcción de EUI-64 modificado', file: 'src/components/lectura/Eui64.astro' },
  'protocolos.ndp-laboratorio': { title: 'NDP y SLAAC en movimiento', file: 'src/components/lectura/NdpLab.astro' },
  'protocolos.presupuesto-trama': { title: 'Presupuesto de una trama IEEE 802.15.4', file: 'src/components/lectura/PresupuestoTrama.astro' },
  'protocolos.compresion-iphc': { title: 'Compresión IPHC y NHC UDP', file: 'src/components/lectura/CompresionIphc.astro' },
  'protocolos.saltos-compresion': { title: 'Compresión por salto: mesh-under y route-over', file: 'src/components/lectura/SaltosCompresion.astro' },
  'protocolos.lorawan-recorrido': { title: 'Recorrido de un mensaje LoRaWAN y sus claves', file: 'src/components/lectura/LorawanRecorrido.astro' },
  'protocolos.lpwan-cronogramas': { title: 'Cronogramas de clases LoRaWAN y de PSM/eDRX', file: 'src/components/lectura/LpwanCronogramas.astro' },
  'protocolos.lorawan-trama': { title: 'Campos de una trama LoRaWAN', file: 'src/components/lectura/LorawanTrama.astro' },
};
export const workshops: Record<string, string> = { 'protocolos.ndp': 'protocolos.ndp' };
