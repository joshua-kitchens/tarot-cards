#!/usr/bin/env node
// Codex server — serves the static site and provides a simple data API.
// Usage: node server.js
// Env vars:
//   PORT=3000       (default 3000)
//   API_KEY=secret  (optional — if set, all /data requests must include X-Api-Key header)

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT      = parseInt(process.env.PORT || '3030', 10);
const API_KEY   = process.env.API_KEY || '';
const DATA_FILE = path.join(__dirname, 'codex_data.json');
const STATIC    = path.join(__dirname, 'tarot-cards');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Api-Key');
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const urlPath = req.url.split('?')[0];

  // ── Data API (/data) ────────────────────────────────────────────────
  if (urlPath === '/data') {
    if (API_KEY && req.headers['x-api-key'] !== API_KEY) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    if (req.method === 'GET') {
      if (!fs.existsSync(DATA_FILE)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('[]');
        return;
      }
      fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
      return;
    }

    if (req.method === 'PUT') {
      let body = '';
      req.on('data', chunk => {
        body += chunk;
        if (body.length > 20_000_000) req.destroy(); // 20 MB guard
      });
      req.on('end', () => {
        try { JSON.parse(body); } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }
        fs.writeFile(DATA_FILE, body, 'utf8', err => {
          if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
        });
      });
      return;
    }

    res.writeHead(405); res.end();
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────
  let filePath = path.join(STATIC, urlPath === '/' ? 'index.html' : urlPath);

  // Prevent path traversal
  const staticNorm = path.normalize(STATIC + path.sep);
  if (!path.normalize(filePath).startsWith(staticNorm)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }

  // Directory → index.html
  if (!path.extname(filePath)) filePath = path.join(filePath, 'index.html');

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const mime = MIME[path.extname(filePath)] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Codex → http://localhost:${PORT}`);
  if (API_KEY) console.log('API key protection: enabled');
});
