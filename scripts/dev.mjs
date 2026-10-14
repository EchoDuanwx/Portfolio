import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { buildSite, projectRoot } from './build.mjs';

const port = Number(process.env.PORT || 4173);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
const inputs = ['content', 'assets', 'site.json', 'index.html', 'styles.css', 'app.js', 'favicon.svg'];
let previous = '';
let polling = false;

async function fingerprint(filename) {
  try {
    const full = path.join(projectRoot, filename);
    const info = await stat(full);
    if (info.isDirectory()) {
      const children = (await readdir(full)).filter(name => !name.startsWith('.')).sort();
      return (await Promise.all(children.map(name => fingerprint(path.join(filename, name))))).join('\n');
    }
    return `${filename}:${info.mtimeMs}:${info.size}`;
  } catch (error) { if (error.code === 'ENOENT') return `${filename}:missing`; throw error; }
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    const current = (await Promise.all(inputs.map(fingerprint))).join('\n');
    if (current !== previous) {
      previous = current;
      await buildSite();
      console.log(`已更新预览 ${new Date().toLocaleTimeString()}，刷新浏览器即可查看。草稿不会显示。`);
    }
  } catch (error) { console.error(`构建失败：${error.message}\n修正文件并保存后会自动重试。`); }
  finally { polling = false; }
}

await poll();
const server = createServer(async (request, response) => {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const dist = path.join(projectRoot, 'dist');
    const filename = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(`${dist}${path.sep}`)) { response.writeHead(403).end(); return; }
    const body = await readFile(filename);
    response.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch { response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('找不到文件。'); }
});
server.on('error', error => { console.error(`预览服务启动失败：${error.message}`); process.exitCode = 1; clearInterval(timer); });
server.listen(port, '127.0.0.1', () => console.log(`预览地址：http://localhost:${port}\n正在监听文章、站点配置和页面文件。按 Ctrl+C 停止。`));
const timer = setInterval(poll, 700);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { clearInterval(timer); server.close(); });
