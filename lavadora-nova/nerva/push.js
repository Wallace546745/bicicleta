/* =========================================================
   Web Push — notificações de venda no iPhone (e qualquer navegador).
   • Chaves VAPID próprias (data/vapid.json) — a identidade do servidor.
   • Inscrições dos aparelhos em data/push-subs.json.
   • Dispara em PIX gerado (pendente) e venda paga (aprovada).
   No iOS exige que o painel seja "Adicionado à Tela de Início" (iOS 16.4+).
   ========================================================= */
'use strict';

const fs   = require('fs');
const path = require('path');

let webpush = null;
try { webpush = require('web-push'); } catch (_) { console.warn('[push] web-push não instalado — notificações desligadas'); }

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SUBS_DB  = path.join(DATA_DIR, 'push-subs.json');
const VAPID_DB = path.join(DATA_DIR, 'vapid.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load(f, fb) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return fb; } }
function save(f, v) { try { fs.writeFileSync(f, JSON.stringify(v)); } catch (e) { console.error('[push] save', e.message); } }

/* chaves VAPID persistentes (geradas 1x) */
let vapid = load(VAPID_DB, null);
if (webpush && (!vapid || !vapid.publicKey)) { vapid = webpush.generateVAPIDKeys(); save(VAPID_DB, vapid); }
if (webpush && vapid) {
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@precinhoonline.online';
  try { webpush.setVapidDetails(subject, vapid.publicKey, vapid.privateKey); } catch (e) { console.error('[push] vapid', e.message); }
}

let subs = load(SUBS_DB, []);   // [{endpoint, keys:{p256dh,auth}}]

function addSub(sub) {
  if (!sub || !sub.endpoint) return;
  subs = subs.filter(s => s.endpoint !== sub.endpoint);
  subs.push(sub);
  save(SUBS_DB, subs);
}
function removeSub(endpoint) { subs = subs.filter(s => s.endpoint !== endpoint); save(SUBS_DB, subs); }

/* envia para todos os aparelhos inscritos (best effort; limpa os expirados) */
async function send(payload) {
  if (!webpush || !vapid || !subs.length) return { sent: 0 };
  const body = JSON.stringify(payload);
  let sent = 0;
  await Promise.all(subs.slice().map(sub =>
    webpush.sendNotification(sub, body, { TTL: 3600 })
      .then(() => { sent++; })
      .catch(err => {
        const code = err && err.statusCode;
        if (code === 404 || code === 410) removeSub(sub.endpoint);   // inscrição morta
        else console.error('[push] send', code || (err && err.message));
      })
  ));
  return { sent };
}

const money = n => 'R$ ' + (Number(n) || 0).toFixed(2).replace('.', ',');
// comissão = líquido (valor menos a taxa da Nerva). Se o líquido não vier, usa o valor cheio.
const comissao = (sale, gross) => {
  const net = (sale && sale.netAmount != null && sale.netAmount !== '') ? Number(sale.netAmount) : null;
  if (net != null && net > 0) return net;
  return Number((gross != null ? gross : (sale && sale.amount)) || 0);
};
const short = s => { s = String(s || 'pedido'); return s.length > 40 ? s.slice(0, 40) + '…' : s; };

/* uma notificação por cobrança: o mesmo PIX pode ser gerado várias vezes
   (comprador recarregou a tela, voltou depois) e isso não é venda nova. */
const jaAvisado = new Set();
function umaVez(chave) {
  if (jaAvisado.has(chave)) return false;
  if (jaAvisado.size > 5000) jaAvisado.clear();
  jaAvisado.add(chave);
  return true;
}

function notifyPixCreated(sale) {
  if (!sale || !umaVez('gerado:' + sale.id)) return;
  send({
    title: '🎭 PIX gerado',
    body: 'Comissão ' + money(comissao(sale)),
    tag: 'pix-' + sale.id, kind: 'pending', url: '/nerva/admin.html'
  });
}
function notifyPaid(sale, amount) {
  if (!sale || !umaVez('pago:' + sale.id)) return;
  send({
    title: '💰 PIX pago',
    body: 'Comissão ' + money(comissao(sale, amount)),
    tag: 'paid-' + ((sale && sale.id) || Date.now()), kind: 'paid', url: '/nerva/admin.html'
  });
}

/* ---------- conteúdo do service worker e do manifest (servidos por rota) ---------- */
const SW_JS = `
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });
self.addEventListener('push', function(e){
  var d = {}; try { d = e.data.json(); } catch(_) { d = { title: 'Venda', body: e.data ? e.data.text() : '' }; }
  var opts = { body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: '/nerva/icon-192.png', badge: '/nerva/icon-192.png',
    data: { url: d.url || '/nerva/admin.html' }, vibrate: [80,40,80] };
  e.waitUntil(self.registration.showNotification(d.title || 'Venda', opts));
});
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/nerva/admin.html';
  e.waitUntil(self.clients.matchAll({ type:'window', includeUncontrolled:true }).then(function(cl){
    for (var i=0;i<cl.length;i++){ if (cl[i].url.indexOf('/nerva/') > -1 && 'focus' in cl[i]) return cl[i].focus(); }
    return self.clients.openWindow(url);
  }));
});`;

const MANIFEST = {
  name: '⠀', short_name: '⠀',
  start_url: '/nerva/admin.html', scope: '/nerva/', display: 'standalone',
  background_color: '#0e1014', theme_color: '#0e1014',
  icons: [
    { src: '/nerva/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
    { src: '/nerva/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
  ]
};

function mount(app, auth) {
  // service worker + manifest (rotas explícitas: passam antes do bloqueio de /nerva/*.js|json)
  app.get('/nerva/sw.js', (_req, res) => { res.set('Content-Type', 'application/javascript'); res.set('Service-Worker-Allowed', '/nerva/'); res.set('Cache-Control', 'no-store'); res.send(SW_JS); });
  app.get('/nerva/manifest.json', (_req, res) => { res.set('Content-Type', 'application/manifest+json'); res.set('Cache-Control', 'no-store'); res.json(MANIFEST); });

  // chave pública p/ o navegador se inscrever
  app.get('/api/admin/push/vapid', auth, (_req, res) => res.json({ key: vapid ? vapid.publicKey : null, enabled: !!(webpush && vapid), devices: subs.length }));
  // registra/desregistra um aparelho
  app.post('/api/admin/push/subscribe', auth, (req, res) => { addSub(req.body); res.json({ ok: true, devices: subs.length }); });
  app.post('/api/admin/push/unsubscribe', auth, (req, res) => { if (req.body && req.body.endpoint) removeSub(req.body.endpoint); res.json({ ok: true, devices: subs.length }); });
  // teste
  app.post('/api/admin/push/test', auth, async (_req, res) => {
    const r = await send({ title: '🎭 PIX pago', body: 'Comissão R$ 12,34 · teste', kind: 'test', url: '/nerva/admin.html' });
    res.json({ ok: true, sent: r.sent, devices: subs.length });
  });
}

module.exports = { mount, notifyPixCreated, notifyPaid, count: () => subs.length };
