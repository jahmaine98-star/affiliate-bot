import 'dotenv/config';
import crypto from 'node:crypto';
import express from 'express';
import * as store from './src/store.js';
import * as google from './src/google.js';
import * as meta from './src/meta.js';
import * as assistant from './src/assistant.js';
import * as managed from './src/managed.js';
import * as rules from './src/rules.js';
import * as market from './src/market.js';

const app = express();
app.use(express.json({ limit: '100kb' }));
app.disable('x-powered-by');

// ---------- helpers ----------
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
  res.status(status).json({ error: true, detail: e.body || e.message });
});
const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|preview|monitor|curl|wget|python-requests/i;

// ---------- public: tracked redirect ----------
// Send your audience to https://yourdomain.com/go/<slug>. Real visitors are counted, then redirected.
app.get('/go/:slug', (req, res) => {
  const link = store.getLink(req.params.slug);
  if (!link) return res.status(404).send('Link not found');
  if (!BOTS.test(req.get('user-agent') || '')) store.recordClick(link.slug);
  const dest = new URL(link.url);
  for (const [k, v] of Object.entries(req.query)) {
    if (/^utm_/.test(k) && typeof v === 'string') dest.searchParams.set(k, v);
  }
  res.set('cache-control', 'no-store').redirect(302, dest.toString());
});

// ---------- public: network postback ----------
// Point your affiliate network's server-to-server postback at:
//   https://yourdomain.com/postback?slug=<slug>&amount=<commission>&secret=<POSTBACK_SECRET>
app.get('/postback', wrap((req, res) => {
  if (!process.env.POSTBACK_SECRET || !safeEqual(req.query.secret || '', process.env.POSTBACK_SECRET)) {
    return res.status(401).json({ error: true, detail: 'Bad secret' });
  }
  const amount = Number(req.query.amount);
  if (!(amount >= 0)) return res.status(400).json({ error: true, detail: 'amount must be a number' });
  const link = store.recordSale(String(req.query.slug || ''), amount);
  if (!link) return res.status(404).json({ error: true, detail: 'Unknown slug' });
  res.json({ ok: true, slug: link.slug, sales: link.sales, revenue: link.revenue });
}));

// ---------- admin API ----------
const api = express.Router();
api.use((req, res, next) => {
  const m = /^Bearer (.+)$/.exec(req.get('authorization') || '');
  if (!process.env.ADMIN_TOKEN || !m || !safeEqual(m[1], process.env.ADMIN_TOKEN)) {
    return res.status(401).json({ error: true, detail: 'Missing or wrong admin token' });
  }
  next();
});

api.get('/links', (req, res) => {
  const links = store.listLinks().map((l) => ({
    ...l,
    conversionRate: l.clicks ? l.sales / l.clicks : 0,
    epc: l.clicks ? l.revenue / l.clicks : 0,
    trackedUrl: `${req.protocol}://${req.get('host')}/go/${l.slug}`,
  }));
  res.json({ links });
});

api.post('/links', wrap((req, res) => {
  const { slug, name, url, program } = req.body || {};
  if (!/^[a-z0-9-]{2,40}$/.test(slug || '')) return res.status(400).json({ error: true, detail: 'slug: 2-40 characters, a-z, 0-9, hyphen' });
  if (!name) return res.status(400).json({ error: true, detail: 'name is required' });
  try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) throw 0; }
  catch { return res.status(400).json({ error: true, detail: 'url must be a full http(s) URL' }); }
  res.json(store.upsertLink({ slug, name, url, program }));
}));

api.delete('/links/:slug', (req, res) => res.json({ removed: store.removeLink(req.params.slug) }));

const flag = (platform) => (c) => ({ ...c, managed: managed.isManaged(platform, c.id) });
api.get('/google/campaigns', wrap(async (req, res) => res.json({ campaigns: (await google.listCampaigns(req.query.range)).map(flag('google')) })));
api.post('/google/campaigns/:id/status', wrap(async (req, res) => res.json(await google.setCampaignStatus(req.params.id, req.body?.status))));
api.post('/google/launch', wrap(async (req, res) => {
  const created = await google.launchSearchCampaign(req.body || {});
  const id = /campaigns\/(\d+)/.exec(created.campaign || '');
  if (id) managed.addManaged('google', id[1]);
  res.status(201).json({ created, note: 'Everything is PAUSED. Review it in Google Ads, then enable it.' });
}));

api.get('/meta/campaigns', wrap(async (req, res) => res.json({ campaigns: (await meta.listCampaigns(req.query.range)).map(flag('meta')) })));
api.post('/meta/campaigns/:id/status', wrap(async (req, res) => res.json(await meta.setCampaignStatus(req.params.id, req.body?.status))));
api.post('/meta/launch', wrap(async (req, res) => {
  const created = await meta.launchLinkCampaign(req.body || {});
  if (created.campaign) managed.addManaged('meta', created.campaign);
  res.status(201).json({ created, note: 'Everything is PAUSED. Review it in Ads Manager, then enable it.' });
}));

api.get('/rules', (req, res) => res.json({ rules: rules.getRules() }));
api.put('/rules', wrap((req, res) => res.json({ rules: rules.setRules(req.body) })));
// Dry run unless the body says dryRun:false, so a stray call never pauses anything.
api.post('/rules/run', wrap(async (req, res) => res.json(await rules.runRules({ dryRun: req.body?.dryRun !== false }))));
api.get('/rules/log', (req, res) => res.json({ log: rules.readLog() }));

api.post('/assistant', wrap(async (req, res) => {
  if (!assistant.allowRequest()) return res.status(429).json({ error: true, detail: 'Too many questions. Wait a minute.' });
  res.json(await assistant.askClaude(req.body?.messages));
}));

// Public, read-only market data (Coinbase). Not under /api, so the page can use it without the admin token.
app.get('/market/candles', wrap(async (req, res) => {
  res.set('cache-control', 'no-store');
  res.json(await market.getCandles(req.query.product, req.query.granularity));
}));

app.use('/api', api);
app.get('/health', (req, res) => res.json({ ok: true, assistant: Boolean(process.env.ANTHROPIC_API_KEY) }));
app.use(express.static('public'));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log(`Commission Desk backend on :${port}`);
  rules.startScheduler();
});
