import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

// Cargar variables de entorno desde .env o .env.local si existen
['.env', '.env.local'].forEach(file => {
  const envPath = path.join(__dirname, file);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Cargar handlers de API dinámicamente
async function getApiHandler(pathname) {
  if (pathname === '/api/chat') {
    const mod = await import('./api/chat.js');
    return mod.default;
  }
  if (pathname === '/api/lead') {
    const mod = await import('./api/lead.js');
    return mod.default;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(url.pathname);

  // 1. Endpoints de la API (/api/chat, /api/lead)
  if (pathname.startsWith('/api/')) {
    const handler = await getApiHandler(pathname);
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Endpoint not found' }));
    }

    // Leer el body para solicitudes POST/PUT
    let rawBody = '';
    req.on('data', chunk => { rawBody += chunk; });
    req.on('end', async () => {
      let parsedBody = {};
      if (rawBody) {
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          parsedBody = rawBody;
        }
      }
      req.body = parsedBody;

      // Adaptador para emular las funciones serverless de Vercel
      res.status = function (code) {
        res.statusCode = code;
        return res;
      };
      res.json = function (data) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
        return res;
      };

      try {
        await handler(req, res);
      } catch (err) {
        console.error(`Error en ${pathname}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal Server Error' });
        }
      }
    });
    return;
  }

  // 2. Servir archivos estáticos
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const filePath = path.join(__dirname, pathname);

  // Seguridad: evitar path traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Acceso denegado');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 No Encontrado');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Servidor de DYS Solutions listo:`);
  console.log(`   ➜ Local:   http://localhost:${PORT}`);
  console.log(`   ➜ API:     http://localhost:${PORT}/api/chat`);
  console.log(`   ➜ Key:     ${process.env.DEEPSEEK_API_KEY ? 'DEEPSEEK_API_KEY detectada ✅' : 'DEEPSEEK_API_KEY no configurada (añádela en .env o Vercel) ⚠️'}\n`);
});
