// STARR FLIX backend: admin authentication, settings, featured/hidden content, users, stats, error log.
// Also serves the built frontend (dist/) in production.
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Minimal .env loader (no extra dependency)
try {
  const envFile = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env */ }

const PORT = Number(process.env.PORT) || 8787;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const IS_PROD = process.env.NODE_ENV === 'production';
const ADMIN_READY = Boolean(ADMIN_PASSWORD_HASH && JWT_SECRET.length >= 32);
if (!ADMIN_READY) {
  console.warn('[starrflix] Admin login is DISABLED. Set ADMIN_PASSWORD_HASH and a JWT_SECRET (>=32 chars) in .env. See README.');
}

// ---------- tiny JSON store ----------
const DATA_FILE = path.join(__dirname, 'data.json');
const defaults = () => ({
  settings: { announcement: '', maintenance: false }, featured: [], hidden: [], users: [],
  stats: { visits: 0, paths: {}, daily: {} }, errors: [],
});
let db = defaults();
try { db = { ...defaults(), ...JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }; } catch { /* first run */ }
let dirty = false;
const flush = () => {
  if (!dirty) return; dirty = false;
  try { fs.writeFileSync(DATA_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DATA_FILE + '.tmp', DATA_FILE); } catch (e) { console.error('persist failed', e.message); }
};
setInterval(flush, 5000).unref();
process.on('SIGINT', () => { flush(); process.exit(0); });
process.on('SIGTERM', () => { flush(); process.exit(0); });
const save = () => { dirty = true; };
const today = () => new Date().toISOString().slice(0, 10);
const clip = (v, n) => String(v ?? '').slice(0, n);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Heroku/Render/Nginx: real client IP + secure cookies
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// ---------- rate limiting (in-memory) ----------
const hits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return false; }
  arr.push(now); hits.set(key, arr); return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600_000)) hits.delete(k); }, 600_000).unref();

// ---------- auth ----------
const COOKIE = 'sf_admin';
const cookieOpts = { httpOnly: true, sameSite: 'strict', secure: IS_PROD, path: '/', maxAge: 8 * 3600 * 1000 };

function requireAdmin(req, res, next) {
  if (!ADMIN_READY) return res.status(503).json({ error: 'Admin is not configured on the server.' });
  // CSRF defence in depth: state-changing requests must carry our custom header (SameSite=strict is the primary guard)
  if (req.method !== 'GET' && req.get('X-Requested-With') !== 'starrflix') return res.status(403).json({ error: 'Bad request origin.' });
  try {
    const payload = jwt.verify(req.cookies[COOKIE] || '', JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.role !== 'admin') throw new Error('role');
    req.admin = payload; next();
  } catch { res.status(401).json({ error: 'Not authenticated.' }); }
}

app.post('/api/admin/login', async (req, res) => {
  if (!ADMIN_READY) return res.status(503).json({ error: 'Admin is not configured on the server.' });
  if (req.get('X-Requested-With') !== 'starrflix') return res.status(403).json({ error: 'Bad request origin.' });
  if (!rateLimit('login:' + req.ip, 8, 15 * 60_000)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const { username, password } = req.body || {};
  const userOk = typeof username === 'string' && username.length < 100 &&
    crypto.timingSafeEqual(crypto.createHash('sha256').update(username).digest(), crypto.createHash('sha256').update(ADMIN_USERNAME).digest());
  const passOk = typeof password === 'string' && password.length < 200 && (await bcrypt.compare(password, ADMIN_PASSWORD_HASH));
  if (!userOk || !passOk) return res.status(401).json({ error: 'Invalid username or password.' });
  const token = jwt.sign({ sub: ADMIN_USERNAME, role: 'admin' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '8h' });
  res.cookie(COOKIE, token, cookieOpts);
  res.json({ username: ADMIN_USERNAME });
});
app.post('/api/admin/logout', (_req, res) => { res.clearCookie(COOKIE, { path: '/' }); res.json({ ok: true }); });
app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ username: req.admin.sub }));

// ---------- public ----------
app.get('/api/public/config', (_req, res) => res.json({ settings: db.settings, featured: db.featured, hidden: db.hidden }));
app.post('/api/track', (req, res) => {
  if (!rateLimit('track:' + req.ip, 120, 60_000)) return res.status(204).end();
  const p = clip(req.body?.path, 120).replace(/[^\w\-/.:]/g, '') || '/';
  const base = '/' + (p.split('/')[1] || '');
  db.stats.visits++;
  db.stats.paths[base] = (db.stats.paths[base] || 0) + 1;
  const d = today(); db.stats.daily[d] = (db.stats.daily[d] || 0) + 1;
  const keys = Object.keys(db.stats.daily).sort(); while (keys.length > 30) delete db.stats.daily[keys.shift()];
  save(); res.status(204).end();
});
app.post('/api/log-error', (req, res) => {
  if (!rateLimit('err:' + req.ip, 30, 60_000)) return res.status(204).end();
  db.errors.unshift({ ts: Date.now(), message: clip(req.body?.message, 500), source: clip(req.body?.source, 40), path: clip(req.body?.path, 120) });
  db.errors.length = Math.min(db.errors.length, 200);
  save(); res.status(204).end();
});


// ---------- public TV programme guide (Teleonline XMLTV) ----------
const EPG_URL = process.env.EPG_XMLTV_URL || 'https://github.com/teleonline/epg/releases/download/epg-latest/epg.xml';
let epgCache = { at: 0, programmes: null };
const decodeXml = (value = '') => value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
const xmlTag = (block, tag) => { const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')); return m ? decodeXml(m[1].replace(/<[^>]+>/g, '').trim()) : ''; };
const xmlAttr = (block, tag, attr) => { const m = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["']`, 'i')); return m ? decodeXml(m[1]) : ''; };
const xmlDate = (value) => { const m = String(value || '').match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?/); if (!m) return ''; const offset = m[7] || '+0000'; return new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offset.slice(0,3)}:${offset.slice(3)}`).toISOString(); };
const normEpgName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
app.get('/api/epg', async (req, res) => {
  if (!rateLimit('epg:' + req.ip, 30, 60 * 60_000)) return res.status(429).json({ error: 'EPG refresh limit reached. Try again later.' });
  if (epgCache.programmes && Date.now() - epgCache.at < 6 * 60 * 60_000) return res.json({ updatedAt: new Date(epgCache.at).toISOString(), programmes: epgCache.programmes });
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 45000);
    let xml;
    try {
      const response = await fetch(EPG_URL, { signal: controller.signal, headers: { 'User-Agent': 'STARRFLIX/1.0 (+EPG client)', 'Accept': 'application/xml,text/xml,*/*' } });
      if (!response.ok) throw new Error(`EPG provider returned ${response.status}`);
      const raw = await response.text();
      if (raw.length > 160 * 1024 * 1024) throw new Error('EPG document is too large');
      xml = raw;
    } finally { clearTimeout(timer); }
    const custom = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'data', 'custom-channels.json'), 'utf8'));
    const aliasToCustom = new Map();
    for (const c of custom) for (const name of [c.name, ...(c.epgNames || [])]) aliasToCustom.set(normEpgName(name), c.id);
    const xmltvToCustom = new Map();
    for (const match of xml.matchAll(/<channel\b[^>]*>[\s\S]*?<\/channel>/gi)) {
      const block = match[0]; const id = xmlAttr(block, 'channel', 'id');
      const names = [...block.matchAll(/<display-name\b[^>]*>([\s\S]*?)<\/display-name>/gi)].map(m => decodeXml(m[1].replace(/<[^>]+>/g, '').trim()));
      for (const name of names) { const target = aliasToCustom.get(normEpgName(name)); if (target) { xmltvToCustom.set(id, target); break; } }
      if (!xmltvToCustom.has(id)) { const target = aliasToCustom.get(normEpgName(id)); if (target) xmltvToCustom.set(id, target); }
    }
    const now = Date.now(), cutoff = now - 2 * 60 * 60_000, horizon = now + 36 * 60 * 60_000;
    const programmes = [];
    for (const match of xml.matchAll(/<programme\b[^>]*>[\s\S]*?<\/programme>/gi)) {
      const block = match[0], sourceId = xmlAttr(block, 'programme', 'channel'), customId = xmltvToCustom.get(sourceId);
      if (!customId) continue;
      const start = xmlDate(xmlAttr(block, 'programme', 'start')), stop = xmlDate(xmlAttr(block, 'programme', 'stop'));
      const startMs = Date.parse(start), stopMs = Date.parse(stop);
      if (!start || !stop || !Number.isFinite(startMs) || stopMs < cutoff || startMs > horizon) continue;
      const title = xmlTag(block, 'title'); if (!title) continue;
      const desc = xmlTag(block, 'desc'); const icon = xmlAttr(block, 'icon', 'src');
      programmes.push({ channel: customId, title, description: desc, start, stop, image: icon || undefined, icon: icon || undefined });
    }
    programmes.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    epgCache = { at: Date.now(), programmes };
    res.setHeader('Cache-Control', 'public, max-age=900');
    res.json({ updatedAt: new Date(epgCache.at).toISOString(), programmes });
  } catch (error) {
    console.error('[starrflix] EPG fetch failed:', error.message);
    if (epgCache.programmes) return res.json({ updatedAt: new Date(epgCache.at).toISOString(), stale: true, programmes: epgCache.programmes });
    res.status(502).json({ error: 'EPG data could not be loaded from the provider. Check server network access or configure EPG_XMLTV_URL.' });
  }
});

// ---------- admin ----------
app.get('/api/admin/stats', requireAdmin, (_req, res) => {
  const d = today();
  const daily = Array.from({ length: 14 }, (_, i) => { const dt = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10); return { date: dt, views: db.stats.daily[dt] || 0 }; });
  res.json({
    visits: db.stats.visits, today: db.stats.daily[d] || 0, uptimeSec: Math.round(process.uptime()),
    topPaths: Object.entries(db.stats.paths).map(([path, views]) => ({ path, views })).sort((a, b) => b.views - a.views).slice(0, 8),
    daily, users: db.users.length, errors: db.errors.length,
  });
});
app.get('/api/admin/config', requireAdmin, (_req, res) => res.json({ settings: db.settings, featured: db.featured, hidden: db.hidden }));
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  db.settings = { announcement: clip(req.body?.announcement, 200), maintenance: Boolean(req.body?.maintenance) };
  save(); res.json({ settings: db.settings, featured: db.featured, hidden: db.hidden });
});
app.put('/api/admin/featured', requireAdmin, (req, res) => {
  const arr = Array.isArray(req.body) ? req.body.slice(0, 20) : [];
  db.featured = arr.filter((f) => f && (f.type === 'drama' || f.type === 'channel') && f.id).map((f) => ({ id: clip(f.id, 200), type: f.type, title: clip(f.title, 200), image: f.image ? clip(f.image, 600) : undefined }));
  save(); res.json({ settings: db.settings, featured: db.featured, hidden: db.hidden });
});
app.put('/api/admin/hidden', requireAdmin, (req, res) => {
  const arr = Array.isArray(req.body) ? req.body.slice(0, 2000) : [];
  db.hidden = arr.filter((h) => typeof h === 'string' && /^(drama|channel):/.test(h)).map((h) => clip(h, 220));
  save(); res.json({ settings: db.settings, featured: db.featured, hidden: db.hidden });
});
app.get('/api/admin/users', requireAdmin, (_req, res) => res.json(db.users));
app.post('/api/admin/users', requireAdmin, (req, res) => {
  const { name, email, role } = req.body || {};
  if (!name || !/^\S+@\S+\.\S+$/.test(String(email))) return res.status(400).json({ error: 'Name and a valid email are required.' });
  if (db.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) return res.status(409).json({ error: 'That email already exists.' });
  const u = { id: crypto.randomUUID(), name: clip(name, 80), email: clip(email, 120), role: role === 'editor' ? 'editor' : 'viewer', status: 'active', created: Date.now() };
  db.users.push(u); save(); res.status(201).json(u);
});
app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found.' });
  if (req.body?.role === 'viewer' || req.body?.role === 'editor') u.role = req.body.role;
  if (req.body?.status === 'active' || req.body?.status === 'suspended') u.status = req.body.status;
  save(); res.json(u);
});
app.delete('/api/admin/users/:id', requireAdmin, (req, res) => { db.users = db.users.filter((x) => x.id !== req.params.id); save(); res.json({ ok: true }); });
app.get('/api/admin/errors', requireAdmin, (_req, res) => res.json(db.errors.slice(0, 100)));
app.delete('/api/admin/errors', requireAdmin, (_req, res) => { db.errors = []; save(); res.json({ ok: true }); });

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// ---------- static frontend ----------
const dist = path.join(__dirname, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { maxAge: '1h', index: false }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => console.log(`[starrflix] server on http://localhost:${PORT}${fs.existsSync(dist) ? '' : ' (API only; run "npm run build" to serve the site)'}`));
