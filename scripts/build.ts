import { $ } from 'bun';

await $`bun run content:check`;
await $`bun run astro build`;
await $`bun scripts/check-built.ts`;
