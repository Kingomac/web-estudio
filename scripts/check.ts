import { $ } from 'bun';

// --content: changes limited to content/ and public/materiales/. Code changes and CI use the full gate.
const contentOnly = process.argv.includes('--content');
if (!contentOnly) await $`bun run typecheck`;
await $`bun run test:unit`;
await $`bun run calendar:check`;
await $`bun run build`;
if (!contentOnly) await $`bun run test:e2e`;
