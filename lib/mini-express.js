// A tiny Express-style micro framework (routing, JSON body, static files).
// It keeps SkillSwap dependency-free: no `npm install` needed, just `node server.js`.
const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

function compile(p, prefix) {
  const keys = [];
  const body = p.replace(/\/:(\w+)/g, (_, k) => { keys.push(k); return '/([^/]+)'; });
  return { re: new RegExp('^' + body + (prefix ? '(?=/|$)' : '/?$')), keys };
}

function runFns(fns, req, res, out, err) {
  let j = 0;
  const step = (e) => {
    if (e) return out(e);
    const f = fns[j++];
    if (!f) return out();
    try {
      if (err !== undefined && f.length === 4) f(err, req, res, step);
      else f(req, res, step);
    } catch (x) { out(x); }
  };
  step();
}

function Router() {
  const stack = [];
  const router = function (req, res, done) {
    const base = req.path;
    let i = 0;
    const next = (err) => {
      req.path = base;
      let layer;
      while ((layer = stack[i++])) {
        const isErr = layer.fns[0].length === 4;
        if (err ? !isErr : isErr) continue;
        if (layer.method && layer.method !== req.method) continue;
        const m = layer.re.exec(base);
        if (!m) continue;
        if (layer.prefix) req.path = base.slice(m[0].length) || '/';
        else req.params = Object.fromEntries(layer.keys.map((k, n) => [k, decodeURIComponent(m[n + 1])]));
        return runFns(layer.fns, req, res, next, err);
      }
      done(err);
    };
    next();
  };
  for (const m of ['get', 'post', 'put', 'patch', 'delete']) {
    router[m] = (p, ...fns) => { stack.push({ method: m.toUpperCase(), ...compile(p, false), fns }); return router; };
  }
  router.use = (first, ...rest) => {
    if (typeof first === 'string') stack.push({ prefix: true, ...compile(first.replace(/\/$/, ''), true), fns: rest });
    else stack.push({ prefix: true, re: /^/, keys: [], fns: [first, ...rest] });
    return router;
  };
  return router;
}

function json() {
  return (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 1e6) req.destroy(); });
    req.on('end', () => {
      if (!raw) return next();
      try { req.body = JSON.parse(raw); next(); }
      catch { res.status(400).json({ error: 'Invalid JSON' }); }
    });
  };
}

function serveStatic(dir) {
  const root = path.resolve(dir);
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let file = path.join(root, req.path);
    if (!file.startsWith(root)) return next();
    try {
      if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
      const buf = fs.readFileSync(file);
      res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(buf);
    } catch { next(); }
  };
}

function express() {
  const app = Router();
  app.listen = (port, cb) => http.createServer((req, res) => {
    const u = new URL(req.url, 'http://localhost');
    try { req.path = decodeURIComponent(u.pathname); } catch { req.path = u.pathname; }
    req.query = Object.fromEntries(u.searchParams);
    req.body = {};
    req.params = {};
    res.status = (c) => { res.statusCode = c; return res; };
    res.set = (k, v) => { res.setHeader(k, v); return res; };
    res.send = (s) => res.end(s);
    res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    app(req, res, (err) => {
      if (err) { console.error(err); res.statusCode = 500; res.end('Server error'); }
      else { res.statusCode = 404; res.end('Not found'); }
    });
  }).listen(port, cb);
  return app;
}
express.Router = Router;
express.json = json;
express.static = serveStatic;

module.exports = express;
