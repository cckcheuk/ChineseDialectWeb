// Dialect conversation ASR backend (the real interface, besides the mock)
// During dev, Vite proxies /api to here (see vite.config.js)
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'
import './env.mjs'
import { transcribeWav, asrEngine, openTencentStream } from './asr.mjs'
import { ttsSynthesize } from './tts.mjs'
import { dialectSystemPrompt, lmChat } from './llm.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DIST = join(ROOT, 'dist')
const PORT = Number(process.env.PORT || 3001)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (c) => {
      body += c
      if (body.length > 7 * 1024 * 1024) {
        reject(new Error('payload too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('request body is not valid JSON'))
      }
    })
  })
}

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

function serveStatic(req, res, pathname) {
  const map = {
    '/': '/index.html',
    '/index.html': '/index.html',
  }
  const rel = map[pathname] ?? pathname
  const file = join(DIST, rel)
  const safe = file.startsWith(DIST)
  if (existsSync(DIST) && safe && existsSync(file)) {
    const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' })
    res.end(readFileSync(file))
    return
  }
  if (existsSync(DIST) && safe && !rel.includes('.')) {
    // SPA fallback
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(readFileSync(join(DIST, 'index.html')))
    return
  }
  send(res, 404, { error: 'not found' })
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, 'http://localhost')

  if (req.method === 'POST' && url.pathname === '/api/asr/transcribe') {
    try {
      const body = await readJson(req)
      if (!body.audio) throw new Error('missing audio')
      const dialect = body.dialect || 'mandarin'
      // Pick engine by dialect (body.engine can override; the frontend passes the chosen engine)
      const result = await transcribeWav(body.audio, dialect, body.engine)
      send(res, 200, result)
    } catch (err) {
      console.error('[asr] error:', err.message)
      send(res, 500, { error: err.message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const body = await readJson(req)
      const dialect = body.dialect || 'mandarin'
      const history = (Array.isArray(body.messages) ? body.messages : [])
        .slice(-12)
        .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text ?? '') }))
      const text = await lmChat({
        systemPrompt: dialectSystemPrompt(dialect),
        history,
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        model: body.model,
      })
      send(res, 200, { text, dialect, mock: false })
    } catch (err) {
      console.error('[chat] error:', err.message)
      send(res, 502, { error: 'AI model could not be reached or did not respond: ' + err.message })
    }
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/tts/synthesize') {
    try {
      const body = await readJson(req)
      const dialect = body.dialect || 'mandarin'
      const result = await ttsSynthesize(body.text, dialect)
      send(res, 200, result)
    } catch (err) {
      console.error('[tts] error:', err.message)
      send(res, 500, { error: err.message })
    }
    return
  }

  if (req.method === 'GET' && url.pathname === '/api/health') {
    const configured = Boolean(
      process.env.TENCENT_APPID && process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY
    )
    send(res, 200, {
      ok: true,
      engine: asrEngine(),
      engines: {
        cantonese: asrEngine('cantonese'),
        hakka: asrEngine('hakka'),
        teochew: asrEngine('teochew'),
        hokkien: asrEngine('hokkien'),
        mandarin: asrEngine('mandarin'),
      },
      configured,
      lm: { up: false, note: 'Users provide their own API key in Settings' },
    })
    return
  }

  if (req.method === 'GET') {
    serveStatic(req, res, url.pathname)
    return
  }

  send(res, 405, { error: 'method not allowed' })
})

server.listen(PORT, () => {
  console.log(`[asr] backend started http://localhost:${PORT}  (engine=${asrEngine()})`)
})

// ─────────────────────────────────────────────────────────────────────────────
// Streaming ASR: ws://localhost:3001/api/asr/stream?dialect=xxx
// Browser → here → Tencent Cloud real-time speech recognition (WebSocket), bidirectional relay:
//   User sends PCM 16bit 16k mono binary → forwarded directly to Tencent
//   Tencent's JSON response (slice_type 1/2, final) → forwarded back to the user
// When the user stops recording they send {"type":"end"} → forwarded to Tencent, Tencent replies final:1 → both sides close.
// ─────────────────────────────────────────────────────────────────────────────
const streamWss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/api/asr/stream') {
    streamWss.handleUpgrade(req, socket, head, (ws) => streamWss.emit('connection', ws, req))
  } else {
    socket.destroy()
  }
})

streamWss.on('connection', (clientWs, req) => {
  const url = new URL(req.url, 'http://localhost')
  const dialect = url.searchParams.get('dialect') || 'mandarin'
  const engine = asrEngine(dialect)

  let tws
  try {
    // Pick engine by the panel's dialect (e.g. Cantonese uses 16k_yue, Hakka uses 16k_zh_en_2.0)
    tws = openTencentStream(engine)
  } catch (err) {
    clientWs.send(JSON.stringify({ code: -1, message: err.message }))
    clientWs.close()
    return
  }

  const sendToClient = (data) => {
    if (clientWs.readyState === WebSocket.OPEN) clientWs.send(data)
  }
  let closed = false
  const closeBoth = () => {
    if (closed) return
    closed = true
    // Close the Tencent socket in ANY state (OPEN / CONNECTING / CLOSING), not just OPEN —
    // otherwise a client disconnect that arrives while tws is still CONNECTING leaks it.
    try { if (tws && tws.readyState !== WebSocket.CLOSED) tws.close() } catch { /* ignore */ }
    try { if (clientWs.readyState !== WebSocket.CLOSED) clientWs.close() } catch { /* ignore */ }
  }

  // The user may start sending audio before the tws connection opens (dropped packets would lose the first few dozen ms),
  // so queue it and flush everything at once once the connection is open.
  const pending = []
  let twsOpen = false

  const flush = () => {
    while (pending.length && tws.readyState === WebSocket.OPEN) {
      const item = pending.shift()
      const data = item.data
      if (item.isEnd) tws.send(item.text, { binary: false })
      else tws.send(data, { binary: typeof data !== 'string' })
    }
  }

  tws.on('open', () => {
    twsOpen = true
    if (closed) { try { tws.close() } catch { /* ignore */ } return }
    console.log(`[stream] Tencent connected (dialect=${dialect}, engine=${engine})`)
    sendToClient(JSON.stringify({ code: 0, message: 'connected', connected: true, engine }))
    flush()
  })
  tws.on('message', (data) => {
    const msgStr = data.toString()
    console.log(`[stream] Tencent → client:`, msgStr.slice(0, 300))
    sendToClient(data)
  })
  tws.on('error', (err) => {
    console.error(`[stream] Tencent error:`, err.message)
    sendToClient(JSON.stringify({ code: -1, message: 'Tencent: ' + err.message }))
  })
  tws.on('close', (code, reason) => {
    console.log(`[stream] Tencent closed: code=${code}, reason=${reason.toString()}`)
    closeBoth()
  })

  clientWs.on('message', (data) => {
    // Force the end message to be forwarded as text (regardless of whether the client sent text or binary)
    const text = typeof data === 'string' ? data : data.toString().trim()
    // Tolerate parsing the end signal: the client sends JSON.stringify({type:'end'}) (no spaces),
    // so we can't do a direct string comparison; instead JSON-parse and check type === 'end'.
    let isEnd = false
    try {
      const obj = JSON.parse(text)
      isEnd = obj && obj.type === 'end'
    } catch {
      isEnd = text === '{"type":"end"}' || text === '{"type": "end"}'
    }
    if (!twsOpen || tws.readyState !== WebSocket.OPEN) {
      pending.push({ data, isEnd, text })
      return
    }
    if (isEnd) tws.send(text, { binary: false })
    else tws.send(data, { binary: typeof data !== 'string' })
  })
  clientWs.on('close', () => {
    console.log('[stream] client disconnected')
    closeBoth()
  })
  clientWs.on('error', () => closeBoth())
})

export { server }
void server
