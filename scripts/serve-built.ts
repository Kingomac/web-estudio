import { stat } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import path from 'node:path';

const { values } = parseArgs({ options: { port: { type: 'string', default: '4322' } } });
const port = Number(values.port);
const base = (process.env.BASE_PATH || '/web-estudio').replace(/\/+$/, '');
const root = path.resolve('dist');

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    try {
      const url = new URL(request.url);
      if (url.pathname === base) return new Response(null, { status: 301, headers: { Location: `${base}/` } });
      if (!url.pathname.startsWith(`${base}/`)) return new Response('Not found', { status: 404 });
      let file = path.resolve(root, decodeURIComponent(url.pathname.slice(base.length + 1)));
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) return new Response('Not found', { status: 404 });
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      const content = Bun.file(file);
      if (!await content.exists()) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : content, {
        headers: {
          'Content-Type': content.type,
          'Content-Length': String(content.size),
          // Evita que Bun proponga el slug del PDF sobre el nombre original del atributo download.
          'Content-Disposition': 'inline',
        },
      });
    } catch { return new Response('Not found', { status: 404 }); }
  },
});
console.log(`http://127.0.0.1:${server.port}${base}/`);
const stop = async () => { await server.stop(true); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
