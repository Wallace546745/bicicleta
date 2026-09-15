/* =========================================================
   Rastreamento TikTok próprio — Events API v1.3
   • fila persistente em disco com retry e backoff
   • dedup por event_id (o mesmo id vai no pixel e aqui)
   • advanced matching: e-mail/telefone/external_id em SHA-256,
     ttclid, _ttp, IP e user-agent
   • CompletePayment sai do SERVIDOR no webhook da Nerva
   ========================================================= */
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const settings = require('./settings');

/* pixel/token vem da config editavel (settings) — muda sem reiniciar */
function enabled() { const c = settings.get(); return !!(c.tiktokPixelId && c.tiktokAccessToken); }
const API_URL    = process.env.TIKTOK_API_URL || 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
const FETCH_TIMEOUT_MS = Number(process.env.TIKTOK_FETCH_TIMEOUT_MS) || 15000;

const DATA_DIR   = process.env.DATA_DIR || path.join(__dirname, 'data');
const QUEUE_DB   = path.join(DATA_DIR, 'track-queue.json');
const CTX_DB     = path.join(DATA_DIR, 'track-ctx.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

if (!enabled()) console.warn('[tiktok] pixel/token ausentes — Events API desligada, so o pixel do navegador vai rodar (ligue pelo painel).');

/* ---------- normalização e hash (exigido pela Events API) ---------- */
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');

/* objeto "ad" da Events API (utm_* e IDs numericos), validado */
function sanitizeAd(ad) {
  if (!ad || typeof ad !== 'object') return null;
  const out = {};
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_id']) if (ad[k]) out[k] = String(ad[k]).slice(0, 200);
  for (const k of ['campaign_id', 'ad_id', 'creative_id']) if (/^\d{6,}$/.test(String(ad[k] || ''))) out[k] = String(ad[k]);
  return Object.keys(out).length ? out : null;
}
const tipoCliente = v => (v === 'new' || v === 'returning') ? v : undefined;

/* contents vindos do navegador: valida e limita antes de guardar/enviar */
function sanitizeContents(list) {
  if (!Array.isArray(list) || !list.length) return null;
  const out = [];
  for (const c of list.slice(0, 20)) {
    if (!c || typeof c !== 'object') continue;
    const id = String(c.content_id || '').trim().slice(0, 100);
    if (!id) continue;
    out.push({
      content_id:   id,
      content_name: c.content_name != null ? String(c.content_name).slice(0, 200) : undefined,
      content_category: c.content_category ? String(c.content_category).slice(0, 100) : undefined,
      brand:        c.brand ? String(c.brand).slice(0, 100) : undefined,
      price:        Number.isFinite(Number(c.price)) ? Math.round(Number(c.price) * 100) / 100 : undefined,
      quantity:     Math.max(1, parseInt(c.quantity, 10) || 1)
    });
  }
  return out.length ? out : null;
}
const isSha = s => /^[a-f0-9]{64}$/i.test(String(s || ''));

function hEmail(e) {
  if (!e) return undefined;
  if (isSha(e)) return String(e).toLowerCase();
  const v = String(e).trim().toLowerCase();
  return v.includes('@') ? sha(v) : undefined;
}
function hPhone(p) {
  if (!p) return undefined;
  if (isSha(p)) return String(p).toLowerCase();
  let d = String(p).replace(/\D/g, '');
  if (!d) return undefined;
  if (d.length === 12 && d[0] === '0') d = d.slice(1);     // "0" de operadora antes do DDD
  if (d.length === 10 || d.length === 11) d = '55' + d;   // BR sem DDI
  return sha('+' + d);                                     // E.164
}
function hExt(x) {
  if (!x) return undefined;
  return isSha(x) ? String(x).toLowerCase() : sha(String(x));
}

/* ---------- persistência ---------- */
function load(f, fb) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return fb; } }
let queue = load(QUEUE_DB, []);          // [{ payload, tries, next, id }]
let ctx   = load(CTX_DB, {});            // saleId -> contexto de match
const seen = new Set(load(path.join(DATA_DIR, 'track-seen.json'), []));
const stats = { enviados: 0, falhas: 0, ultimoErro: '', ultimoEnvio: null, ultimoCodigo: null };
/* contadores por evento e por origem, para o painel medir paridade pixel↔servidor */
const counters = load(path.join(DATA_DIR, 'track-counters.json'),
  { porEvento: {}, matchSoma: 0, matchN: 0, comCompra: 0, compraComMatchFraco: 0 });

/* qualidade do match (0-100): quantos identificadores fortes o evento carrega */
function matchScore(ev) {
  let s = 0;
  if (ev.external_id) s += 20;
  if (ev.email) s += 25;
  if (ev.phone) s += 25;
  if (ev.ttclid) s += 20;
  if (ev.ttp) s += 5;
  if (ev.ip && ev.user_agent) s += 5;
  return Math.min(100, s);
}

let dirty = false;
function persist() { dirty = true; }
setInterval(() => {
  if (!dirty) return; dirty = false;
  try {
    fs.writeFileSync(QUEUE_DB, JSON.stringify(queue));
    fs.writeFileSync(CTX_DB, JSON.stringify(ctx));
    fs.writeFileSync(path.join(DATA_DIR, 'track-seen.json'), JSON.stringify([...seen].slice(-20000)));
    fs.writeFileSync(path.join(DATA_DIR, 'track-counters.json'), JSON.stringify(counters));
  } catch (e) { console.error('[tiktok] persist:', e.message); }
}, 3000);

/* ---------- monta um evento no formato da API ---------- */
function buildEvent(ev) {
  const user = {};
  if (ev.ttclid)      user.ttclid      = ev.ttclid;
  if (ev.ttp)         user.ttp         = ev.ttp;
  if (ev.ip)          user.ip          = ev.ip;
  if (ev.user_agent)  user.user_agent  = ev.user_agent;
  if (ev.locale)      user.locale      = String(ev.locale).slice(0, 10);   // BCP 47, ex.: pt-BR
  const ex = hExt(ev.external_id);   if (ex) user.external_id = ex;
  const em = hEmail(ev.email);       if (em) user.email       = em;
  const ph = hPhone(ev.phone);       if (ph) user.phone       = ph;

  const props = {};
  if (ev.value != null)  props.value    = Number(ev.value);
  props.currency = ev.currency || 'BRL';
  if (ev.order_id) props.order_id = String(ev.order_id);
  /* No pixel o termo de busca e "query"; na Events API o campo e search_string */
  if (ev.query)       props.search_string = String(ev.query).slice(0, 100);
  if (ev.description) props.description   = String(ev.description).slice(0, 100);
  const tc = tipoCliente(ev.customer_type); if (tc) props.customer_type = tc;
  if (ev.contents && ev.contents.length) {
    props.content_type = 'product';
    /* content_ids no topo e obrigatorio para Video Shopping Ads; num_items e o total de itens */
    props.content_ids = ev.contents.map(c => String(c.content_id || ''));
    props.num_items   = ev.contents.reduce((s, c) => s + (Number(c.quantity) || 1), 0);
    props.contents = ev.contents.map(c => ({
      content_id:   String(c.content_id || ''),
      content_type: 'product',
      content_name: c.content_name || undefined,
      content_category: c.content_category || undefined,
      brand:        c.brand || undefined,
      price:        c.price != null ? Number(c.price) : undefined,
      quantity:     c.quantity != null ? Number(c.quantity) : 1
    }));
  }

  /* page.url e OBRIGATORIO na Events API: sem a URL da venda (contexto antigo),
     vai a URL da loja */
  const page = {};
  page.url = String(ev.page_url || urlPadrao()).slice(0, 2000);
  if (ev.referrer) page.referrer = String(ev.referrer).slice(0, 2000);
  const ad = sanitizeAd(ev.ad);

  const out = {
    event:      ev.event,
    event_time: Math.floor((ev.event_time || Date.now()) / 1000),
    event_id:   String(ev.event_id),
    user,
    page,
    properties: props
  };
  if (ad) out.ad = ad;
  return out;
}
function urlPadrao() {
  const pub = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
  return pub ? pub + '/' : 'https://v9maxoficial.com/';
}

/* ---------- fila ---------- */
const VALID = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
function enqueue(ev, opts) {
  opts = opts || {};
  if (!ev || !ev.event || !VALID.test(ev.event)) return { ok: false, motivo: 'evento inválido' };
  if (!ev.event_id) ev.event_id = ev.event.toLowerCase() + '-' + crypto.randomUUID();
  if (seen.has(ev.event_id)) return { ok: true, duplicado: true };
  seen.add(ev.event_id);

  /* métricas de paridade e match (contam mesmo com a API desligada) */
  const origem = ev._origem || (ev.event_id && String(ev.event_id).startsWith('pao-') ? 'servidor' : 'servidor');
  counters.porEvento[ev.event] = counters.porEvento[ev.event] || { total: 0, pixel: 0, servidor: 0 };
  counters.porEvento[ev.event].total++;
  counters.porEvento[ev.event][ev._origem === 'pixel' ? 'pixel' : 'servidor']++;
  const compra = ev.event === 'Purchase' || ev.event === 'CompletePayment';
  if (compra || ev.event === 'PlaceAnOrder') {
    const ms = matchScore(ev);
    counters.matchSoma += ms; counters.matchN++;
    if (compra) { counters.comCompra++; if (ms < 50) counters.compraComMatchFraco++; }
  }
  persist();

  if (!enabled()) return { ok: true, desligado: true };
  queue.push({ id: ev.event_id, payload: buildEvent(ev), tries: 0, next: 0 });
  if (queue.length > 5000) queue = queue.slice(-5000);
  persist();
  /* compra (CompletePayment) nao espera nem os 30 ms de juntar lote: sai no
     proximo tick do event loop, antes de qualquer outra coisa */
  if (opts.imediato) { clearTimeout(flushTimer); flushTimer = null; setImmediate(flush); }
  else agendarFlush();
  return { ok: true };
}

/* Envio imediato: o evento sai para o TikTok logo depois de entrar na fila
   (uns 30 ms para juntar a rajada de um mesmo clique num lote só), em vez de
   esperar o tick de 2 s. O intervalo continua existindo para as retentativas
   com backoff e para o que ficou pendente de uma execução anterior. */
let flushTimer = null;
function agendarFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 30);
}

let flushing = false;
async function flush() {
  if (flushing || !enabled()) return;
  const now = Date.now();
  let lote = queue.filter(q => q.next <= now).slice(0, 200);
  if (!lote.length) return;
  /* item marcado para ir sozinho (lote anterior recusado por dado invalido):
     vai um por vez, para o evento ruim nao derrubar os bons */
  const solo = lote.find(q => q.solo);
  if (solo) lote = [solo];
  flushing = true;
  const cfg = settings.get();
  const PIXEL_ID = cfg.tiktokPixelId, TOKEN = cfg.tiktokAccessToken, TEST_CODE = cfg.tiktokTestEventCode;
  const body = { event_source: 'web', event_source_id: PIXEL_ID, data: lote.map(q => q.payload) };
  if (TEST_CODE) body.test_event_code = TEST_CODE;
  /* sem limite de tempo, uma conexao travada segurava a fila inteira por ate
     5 min (timeout padrao do Node) sem registrar erro nenhum */
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Access-Token': TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ac.signal
    });
    let j = {}; try { j = await r.json(); } catch (_) {}
    stats.ultimoCodigo = j.code;
    if (r.ok && j.code === 0) {
      const ids = new Set(lote.map(q => q.id));
      queue = queue.filter(q => !ids.has(q.id));
      stats.enviados += lote.length; stats.ultimoEnvio = new Date().toISOString(); stats.ultimoErro = '';
    } else {
      // 40xxx = erro de dados (não adianta repetir); outros = tenta de novo com backoff
      const fatal = j.code && String(j.code).startsWith('4');
      if (fatal && lote.length > 1) {
        /* o TikTok recusa o LOTE inteiro por um evento invalido. Antes os
           outros iam junto para o lixo; agora cada um sai sozinho e so o
           ruim e descartado. */
        lote.forEach(q => { q.solo = true; q.next = now; });
      } else {
        lote.forEach(q => {
          q.tries++;
          if (fatal || q.tries >= 8) { queue = queue.filter(x => x.id !== q.id); stats.falhas++; }
          else q.next = now + Math.min(3600e3, 2000 * Math.pow(2, q.tries));
        });
      }
      stats.ultimoErro = (j.message || `HTTP ${r.status}`).slice(0, 200);
      console.error('[tiktok]', stats.ultimoErro);
    }
  } catch (e) {
    lote.forEach(q => { q.tries++; q.next = now + Math.min(3600e3, 2000 * Math.pow(2, q.tries)); });
    stats.ultimoErro = (e.name === 'AbortError' ? `timeout apos ${FETCH_TIMEOUT_MS / 1000}s` : e.message).slice(0, 200);
    console.error('[tiktok]', stats.ultimoErro);
  }
  clearTimeout(timer);
  persist();
  flushing = false;
  // sobrou algo pronto para sair (lote maior que 200, ou chegou durante o envio)? vai já
  if (queue.some(q => q.next <= Date.now())) agendarFlush();
}
setInterval(flush, 2000);

/* ---------- contexto por venda (para o CompletePayment sem navegador) ---------- */
function remember(saleId, c) {
  ctx[saleId] = Object.assign({}, ctx[saleId], c, { t: Date.now() });
  // limpa contextos com mais de 7 dias
  const cut = Date.now() - 7 * 86400e3;
  for (const k of Object.keys(ctx)) if (ctx[k].t < cut) delete ctx[k];
  persist();
}
const contextOf = saleId => ctx[saleId] || null;

/* ---------- rotas ---------- */
/* idioma do navegador (Accept-Language: "pt-BR,pt;q=0.9") -> "pt-BR" */
function localeDe(req) {
  const m = String(req.headers['accept-language'] || '').match(/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})?/);
  return m ? m[0] : undefined;
}

/* IP real do visitante atras de Cloudflare / proxy reverso. Sem isto o
   servidor mandava o IP do proxy e o TikTok casava a pessoa errada. */
function clientIp(req) {
  const h = req.headers;
  return (h['cf-connecting-ip'] || h['x-real-ip'] || (h['x-forwarded-for'] || '').split(',')[0]).trim()
    || req.socket.remoteAddress || '';
}

function mount(app, auth, express) {
  // do navegador (sendBeacon manda text/plain; fetch no-cors também)
  app.post('/api/track', express.json({ type: ['application/json', 'text/plain'], limit: '64kb' }), (req, res) => {
    let b = req.body;
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = null; } }
    if (!b || !b.event) return res.status(400).json({ ok: false });
    /* event_time: o instante do clique no navegador, se veio e é plausível
       (até 7 dias atrás — fila offline reenviada na visita seguinte); senão,
       agora. O TikTok recusa evento com timestamp no futuro. */
    let quando = Number(b.event_time);
    const agora = Date.now();
    if (!Number.isFinite(quando) || quando > agora + 60e3 || quando < agora - 7 * 86400e3) quando = agora;
    const r = enqueue({
      event: b.event, event_id: b.event_id, event_time: quando,
      value: b.value, currency: b.currency, order_id: b.order_id,
      contents: sanitizeContents(b.contents) || undefined,
      query: b.query, description: b.description,
      ttclid: b.ttclid, ttp: b.ttp, external_id: b.external_id,
      email: b.email, phone: b.phone,
      page_url: b.page_url, referrer: b.referrer,
      customer_type: b.customer_type, ad: b.ad,
      ip: clientIp(req), user_agent: req.headers['user-agent'],
      locale: b.locale || localeDe(req)
    });
    res.json(r);
  });

  // o navegador confirma que o pixel disparou (para medir paridade)
  app.post('/api/track/pixel', express.json({ type: ['application/json', 'text/plain'], limit: '16kb' }), (req, res) => {
    let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (_) { b = null; } }
    if (b && b.event) {
      counters.porEvento[b.event] = counters.porEvento[b.event] || { total: 0, pixel: 0, servidor: 0 };
      counters.porEvento[b.event].pixel++;
      persist();
    }
    res.json({ ok: true });
  });

  app.get('/api/admin/tracking', auth, (_req, res) => {
    const now = Date.now();
    // saúde da fila: se o item mais antigo está preso há muito, algo travou
    const cfg = settings.get();
    const maisAntigo = queue.reduce((m, q) => Math.min(m, q.next || now), now);
    const presaMin = queue.length ? Math.round((now - maisAntigo) / 60000) : 0;
    const matchMedio = counters.matchN ? Math.round(counters.matchSoma / counters.matchN) : null;

    // paridade: por evento, quanto o pixel e o servidor divergem
    const paridade = Object.entries(counters.porEvento).map(([ev, c]) => {
      const div = c.pixel && c.servidor ? Math.round(Math.abs(c.pixel - c.servidor) / Math.max(c.pixel, c.servidor) * 100) : (c.pixel || c.servidor ? 100 : 0);
      return { evento: ev, pixel: c.pixel, servidor: c.servidor, divergencia: div };
    }).sort((a, b) => b.divergencia - a.divergencia);

    // diagnóstico de saúde para o painel pintar verde/amarelo/vermelho
    let saude = 'ok', motivo = '';
    if (!enabled()) { saude = 'off'; motivo = 'Events API desligada (falta token).'; }
    else if (stats.ultimoCodigo != null && stats.ultimoCodigo !== 0) { saude = 'erro'; motivo = 'TikTok recusou o último lote: ' + (stats.ultimoErro || 'código ' + stats.ultimoCodigo); }
    else if (queue.length > 50 && stats.enviados === 0 && stats.falhas === 0 && (stats.ultimoErro || presaMin > 3)) { saude = 'travado'; motivo = 'Eventos enfileirando sem entregar — verifique o token/rede.'; }
    else if (queue.length > 200 || presaMin > 15) { saude = 'travado'; motivo = 'Fila acumulando — entrega travada.'; }
    else if (cfg.tiktokTestEventCode) { saude = 'teste'; motivo = 'Modo teste ativo: eventos NÃO contam para o anúncio.'; }

    res.json({
      ativo: enabled(), pixel: cfg.tiktokPixelId, teste: !!cfg.tiktokTestEventCode, saude, motivo,
      fila: queue.length, filaPresaMin: presaMin, ...stats,
      matchMedio,
      comprasRastreadas: counters.comCompra,
      comprasMatchFraco: counters.compraComMatchFraco,
      paridade
    });
  });
}

/* O monitor lê daqui em vez de recontar: counters.porEvento ja separa o
   que o pixel do navegador confirmou do que o servidor mandou pela
   Events API, e a fila diz o que ainda nao saiu. */
function estatisticas() {
  const cfg = settings.get();
  const agora = Date.now();
  return {
    ligado: enabled(),
    motivo: enabled() ? '' :
      (!cfg.tiktokPixelId ? 'TIKTOK_PIXEL_ID ausente' : 'TIKTOK_ACCESS_TOKEN ausente'),
    porEvento: counters.porEvento || {},
    fila: queue.map(q => ({
      event: (q.payload && q.payload.event) || '?',
      tries: q.tries || 0,
      proximaTentativa: q.next || 0,
      atrasadoMin: q.next && q.next < agora ? Math.round((agora - q.next) / 60000) : 0
    }))
  };
}

module.exports = { mount, enqueue, remember, contextOf, matchScore, enabled, estatisticas, sanitizeContents, sanitizeAd, localeDe, contexts: () => ctx };
