// Registro declarativo compartido por la CLI de Bun y Astro.
export const components: Record<string, { title: string; file: string }> = {
  'protocolos.ndp': { title: 'Resolución de vecinos NDP', file: 'src/components/lectura/Ndp.astro' },
};
export const workshops: Record<string, string> = { 'protocolos.ndp': 'protocolos.ndp' };
