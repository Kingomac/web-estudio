import type { AstroInstance } from 'astro';
export const workshopModules: Record<string, () => Promise<Pick<AstroInstance, 'default'>>> = {
  'protocolos.ndp': () => import('../components/lectura/Ndp.astro'),
};
