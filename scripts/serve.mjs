/**
 * 极简静态服务器：只为本地预览 `dist/` 用。
 *
 * 不用 vite preview，是为了在受限环境下也能起（不经过 esbuild）。
 * 任何未知路径都回落到 index.html——这是 hash 路由的应用只需要的一条规则。
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const port = Number(process.env.PORT ?? 5199)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const relative = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '')
  const candidate = join(root, relative)
  const path = candidate.startsWith(root) && relative !== '' ? candidate : join(root, 'index.html')
  try {
    const body = await readFile(path)
    response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    const body = await readFile(join(root, 'index.html'))
    response.writeHead(200, { 'content-type': MIME['.html'] })
    response.end(body)
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`manote preview on http://127.0.0.1:${port}`)
})
