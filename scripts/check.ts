import { $ } from 'bun';

await $`bun run typecheck`;
await $`bun run test:unit`;
await $`bun run build`;
await $`bun run test:e2e`;
