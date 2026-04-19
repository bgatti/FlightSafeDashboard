/**
 * Minimal static server for Railway deployment.
 * Serves the Vite build output (dist/) with SPA fallback so
 * client-side routes like /frnaa work on hard refresh.
 */
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DIST = join(__dirname, 'dist')
const PORT = parseInt(process.env.PORT || '3000', 10)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
}

async function handler(req, res) {
  let pathname = new URL(req.url, 'http://localhost').pathname
  if (pathname === '/') pathname = '/index.html'

  // Try serving the file directly from dist/
  const filePath = join(DIST, pathname)
  try {
    const s = await stat(filePath)
    if (s.isFile()) {
      const data = await readFile(filePath)
      const ext = extname(filePath)
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      })
      return res.end(data)
    }
  } catch {}

  // SPA fallback — serve index.html for any non-file route
  const index = await readFile(join(DIST, 'index.html'))
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
  res.end(index)
}

createServer(handler).listen(PORT, () => {
  console.log(`Static server listening on :${PORT}`)
})
