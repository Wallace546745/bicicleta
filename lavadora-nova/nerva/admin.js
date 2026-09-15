/* =========================================================
   Painel admin — presença ao vivo, funil, vendas e métricas.
   Montado sobre o mesmo processo do adaptador Nerva.

   Fonte da verdade dos números:
   • Vendas / PIX / faturamento  -> data/sales.json (persistente, por id).
     status 'paid' só é marcado por markPaid (webhook sale.paid ou status
     oficial 'PAID' do gateway). PIX gerado = 'pending' NUNCA conta como pago.
   • Visitantes / checkouts iniciados -> data/daily.json (agregados diários
     persistentes; presença em memória é só para "agora"/tempo real).
   • Dias/horas são calculados em horário de Brasília (UTC-3), não do servidor.
   ========================================================= */
'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');
const monitor = require('./monitor');

const DATA_DIR  = process.env.DATA_DIR || path.join(__dirname, 'data');
const SALES_DB  = path.join(DATA_DIR, 'sales.json');
const EVENTS_DB = path.join(DATA_DIR, 'events.json');
const DAILY_DB  = path.join(DATA_DIR, 'daily.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* ---------- horário de Brasília (UTC-3, sem horário de verão) ---------- */
const BR_OFFSET = -3 * 3600e3;
function brStartOfDay(ts) { const d = new Date(ts + BR_OFFSET); d.setUTCHours(0, 0, 0, 0); return d.getTime() - BR_OFFSET; }
function brDateKey(ts)    { return new Date(ts + BR_OFFSET).toISOString().slice(0, 10); }
function brHour(ts)       { return new Date(ts + BR_OFFSET).getUTCHours(); }
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

/* ---------- persistência simples em arquivo ---------- */
function load(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
let salesDb  = load(SALES_DB, {});    // id -> venda
let eventsDb = load(EVENTS_DB, []);   // log recente
let dailyDb  = load(DAILY_DB, {});    // 'YYYY-MM-DD' (BR) -> { visitors, checkouts }

let dirty = false;
function persist() { dirty = true; }
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  try {
    fs.writeFileSync(SALES_DB, JSON.stringify(salesDb));
    fs.writeFileSync(EVENTS_DB, JSON.stringify(eventsDb));
    fs.writeFileSync(DAILY_DB, JSON.stringify(dailyDb));
  } catch (e) { console.error('persist:', e.message); }
}, 5000);

/* grava o sales.json IMEDIATAMENTE (vendas são críticas: um pedido não pode
   sumir se o processo reiniciar/cair nos 5s do debounce acima) */
function flushSales() {
  try { fs.writeFileSync(SALES_DB, JSON.stringify(salesDb)); }
  catch (e) { console.error('flushSales:', e.message); }
}

function dayBucket(ts) {
  const k = brDateKey(ts);
  return (dailyDb[k] = dailyDb[k] || { visitors: 0, checkouts: 0 });
}

function logEvent(type, detail) {
  eventsDb.push({ t: Date.now(), type, ...detail });
  /* session_start chega centenas de vezes por hora e empurrava sale_paid e
     purchase_tracked para fora do log de 500. Cada tipo tem sua cota. */
  if (eventsDb.length > 800) {
    const sess = eventsDb.filter(e => e.type === 'session_start').slice(-100);
    const resto = eventsDb.filter(e => e.type !== 'session_start').slice(-500);
    eventsDb = resto.concat(sess).sort((a, b) => a.t - b.t);
  }
  persist();
}

/* ---------- presença ao vivo ---------- */
const ONLINE_MS = 30000;              // sessão viva se pingou nos últimos 30s (o site pinga a cada 10s)
const sessions = new Map();           // sid -> { stage, first, last, ua, ip, utm, device, ref }

const STAGE_LABELS = {
  page_view:      'Página do produto',
  order_bump:     'Oferta antes de finalizar',
  seguro:         'Tela de seguro',
  checkout_addr:  'Checkout · Endereço',
  checkout_dados: 'Checkout · Dados',
  checkout_pgto:  'Checkout · Pagamento',
  checkout_review:'Checkout · Revisão',
  pix_gerado:     'PIX gerado (aguardando)',
  pago:           'Pagou',
  back_offer:     'Oferta de saída',
  carrinho:       'Carrinho aberto'
};
const STAGE_ORDER = ['page_view','carrinho','order_bump','seguro','checkout_addr','checkout_dados',
                     'checkout_pgto','checkout_review','back_offer','pix_gerado','pago'];
const CHECKOUT_STAGES = new Set(['seguro','checkout_addr','checkout_dados','checkout_pgto','checkout_review']); // conta ao ENTRAR no fluxo (seguro e a 1a tela)

function deviceOf(ua) {
  ua = String(ua || '');
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
  if (/Android/i.test(ua)) return 'Android';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Mac OS/i.test(ua)) return 'Mac';
  return 'Outro';
}

function touchSession(sid, data, req) {
  const now = Date.now();
  let s = sessions.get(sid);
  if (!s) {
    s = { sid, first: now, stage: 'page_view', utm: {}, ref: '' };
    sessions.set(sid, s);
    dayBucket(now).visitors++;                     // visitante persistente (por dia BR)
    persist();
    logEvent('session_start', { sid, utm: data.utm || {} });
    monitor.passo(sid, 'entrou');
    monitor.enriquecer(sid, {
      utm: data.utm || {}, origem: (data.utm && data.utm.utmSource) || '',
      ref: data.ref || '', landing: data.landing || '',
      ttclid: (data.utm && data.utm.ttclid) || data.ttclid || '',
      device: deviceOf(req.headers['user-agent'])
    });
    monitor.emitir('visitante', { sid, t: now });
  }
  s.last = now;
  if (data.stage) {
    const mudou = s.stage !== data.stage;
    s.stage = data.stage;
    if (mudou) monitor.passo(sid, data.stage);
    // checkout iniciado: conta 1x por sessão, persistente
    if (CHECKOUT_STAGES.has(data.stage) && !s.checkoutCounted) {
      s.checkoutCounted = true;
      dayBucket(now).checkouts++;
      persist();
    }
  }
  if (data.utm && Object.keys(data.utm).length) s.utm = Object.assign(s.utm, data.utm);
  if (data.ref) s.ref = data.ref;
  s.ua = req.headers['user-agent'] || s.ua;
  s.device = deviceOf(s.ua);
  s.ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || s.ip || '';
  return s;
}

// limpeza de sessões mortas
setInterval(() => {
  const cut = Date.now() - 30 * 60 * 1000;      // guarda 30 min de histórico
  for (const [sid, s] of sessions) if (s.last < cut) sessions.delete(sid);
}, 60000);

const isOnline = s => Date.now() - s.last < ONLINE_MS;

/* ---------- presença em tempo real ----------
   O painel recebe 'online' por SSE. Antes só a cada 5 s (tique do stream);
   agora TAMBÉM na hora em que alguém entra, muda de etapa, sai (bye) ou expira:
   o servidor compara com o último retrato enviado e só empurra se mudou. */
function onlineAgora() {
  const vivos = [...sessions.values()].filter(isOnline);
  const porEtapa = {};
  vivos.forEach(s => { porEtapa[s.stage] = (porEtapa[s.stage] || 0) + 1; });
  return { total: vivos.length, porEtapa, rotulos: STAGE_LABELS, ordem: STAGE_ORDER, t: Date.now() };
}
let ultimoRetrato = '';
function emitirOnlineSeMudou() {
  const o = onlineAgora();
  const chave = o.total + '|' + JSON.stringify(o.porEtapa);
  if (chave === ultimoRetrato) return;
  ultimoRetrato = chave;
  monitor.emitir('online', o);
}
setInterval(emitirOnlineSeMudou, 1000);   // pega quem expirou sem mandar bye

/* ---------- estatística de vendas a partir do sales.json (fonte da verdade) ----------
   pagos são contados por paidAt (quando o dinheiro entrou); criados por createdAt. */
function tOf(v) { return v ? new Date(v).getTime() : 0; }
function salesStats(since, until) {
  const hi = (until == null) ? Infinity : until;
  const all = Object.values(salesDb);
  const criados  = all.filter(s => { const t = tOf(s.createdAt); return t >= since && t < hi; });
  const pagos    = all.filter(s => s.status === 'paid' && (() => { const t = tOf(s.paidAt || s.createdAt); return t >= since && t < hi; })());
  const pendentes = criados.filter(s => s.status === 'pending');
  const bruto   = pagos.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  const liquido = pagos.reduce((a, s) => a + (Number(s.netAmount) || 0), 0);
  const pendVal = pendentes.reduce((a, s) => a + (Number(s.amount) || 0), 0);
  return {
    pixCriados: criados.length,
    pixPagos: pagos.length,
    vendasAprovadas: pagos.length,
    pendentes: pendentes.length,
    faturamento: r2(bruto),
    liquido: r2(liquido),
    pendenteValor: r2(pendVal),
    conversao: criados.length ? r2(pagos.length / criados.length * 100) : 0,
    ticket: pagos.length ? r2(bruto / pagos.length) : 0
  };
}

/* visitantes/checkouts persistentes de um intervalo (por dia BR) */
function trafficStats(since) {
  const today = brStartOfDay(Date.now());
  let visitors = 0, checkouts = 0;
  for (let d = brStartOfDay(since); d <= today; d += 86400e3) {
    const b = dailyDb[brDateKey(d)];
    if (b) { visitors += b.visitors || 0; checkouts += b.checkouts || 0; }
  }
  return { visitantes: visitors, checkouts };
}

function windowStats(since) {
  const s = salesStats(since);
  const t = trafficStats(since);
  return Object.assign(s, t, {
    taxaVisitaPago: t.visitantes ? r2(s.vendasAprovadas / t.visitantes * 100) : 0
  });
}

/* ---------- séries diárias para os gráficos (dias BR) ---------- */
function dailySeries(days) {
  const now = Date.now();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = brStartOfDay(now - i * 86400e3);
    const dayEnd = dayStart + 86400e3;
    const st = salesStats(dayStart, dayEnd);
    const key = brDateKey(dayStart);
    const b = dailyDb[key] || {};
    out.push({
      date: key,
      label: key.slice(8) + '/' + key.slice(5, 7),
      faturamento: st.faturamento,
      vendas: st.vendasAprovadas,
      pixCriados: st.pixCriados,
      pixPagos: st.pixPagos,
      visitantes: b.visitors || 0,
      checkouts: b.checkouts || 0
    });
  }
  return out;
}

/* linha do tempo por hora (24h, horas BR) */
function hourlySeries() {
  const now = Date.now();
  const all = Object.values(salesDb);
  const hours = [];
  for (let i = 23; i >= 0; i--) {
    const h0 = now - i * 3600e3;
    const start = new Date(h0 + BR_OFFSET); start.setUTCMinutes(0, 0, 0);
    const t0 = start.getTime() - BR_OFFSET, t1 = t0 + 3600e3;
    const criados = all.filter(s => { const t = tOf(s.createdAt); return t >= t0 && t < t1; });
    const pagos = all.filter(s => s.status === 'paid' && (() => { const t = tOf(s.paidAt || s.createdAt); return t >= t0 && t < t1; })());
    hours.push({
      label: String(brHour(t0)).padStart(2, '0') + 'h',
      criados: criados.length,
      pagos: pagos.length,
      receita: r2(pagos.reduce((a, s) => a + (Number(s.amount) || 0), 0))
    });
  }
  return hours;
}

/* agrupamento (origem / campanha) — sobre vendas pagas do intervalo */
/* como group(), mas com o denominador certo: conta cobrancas CRIADAS e
   pagas, para dar taxa de conversao por corte (aparelho, campanha, fonte).
   group() so enxerga vendas pagas e por isso nunca mostra o que nao converteu. */
function groupConv(arr, keyFn) {
  const m = {};
  arr.forEach(s => {
    const k = keyFn(s) || '(sem origem)';
    m[k] = m[k] || { criados: 0, pagos: 0, revenue: 0 };
    m[k].criados++;
    if (s.status === 'paid') { m[k].pagos++; m[k].revenue += Number(s.amount || 0); }
  });
  return Object.entries(m).sort((a, b) => b[1].criados - a[1].criados).slice(0, 12)
    .map(([k, v]) => ({
      key: k, criados: v.criados, pagos: v.pagos,
      conversao: v.criados ? r2(v.pagos / v.criados * 100) : 0,
      revenue: r2(v.revenue)
    }));
}

function group(arr, keyFn) {
  const m = {};
  arr.forEach(s => { const k = keyFn(s) || '(direto)'; m[k] = m[k] || { count: 0, revenue: 0 }; m[k].count++; m[k].revenue += Number(s.amount || 0); });
  return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 12)
    .map(([k, v]) => ({ key: k, count: v.count, revenue: r2(v.revenue) }));
}

/* ---------- venda enriquecida para tabela/histórico ---------- */
function saleRow(s) {
  return {
    id: s.id,
    transactionId: s.transactionId || '',
    createdAt: s.createdAt,
    paidAt: s.paidAt || null,
    product: s.description || '',
    amount: r2(s.amount),
    netAmount: r2(s.netAmount),
    method: 'pix',
    status: s.status,
    payerName: s.payerName || '',
    utmSource: s.utmSource || '',
    utmCampaign: s.utmCampaign || '',
    utmMedium: s.utmMedium || '',
    utmContent: s.utmContent || '',
    utmTerm: s.utmTerm || '',
    ttclid: s.ttclid || '',
    externalId: s.externalId || ''
  };
}

/* ---------- métricas (dashboard) ---------- */
function metrics(rangeMs) {
  const now = Date.now();
  const since = rangeMs ? now - rangeMs : brStartOfDay(now);
  const all = Object.values(salesDb);
  const paidAll = all.filter(s => s.status === 'paid');
  const inRangePaid = paidAll.filter(s => { const t = tOf(s.paidAt || s.createdAt); return t >= since; });
  const inRangeAll  = all.filter(s => tOf(s.createdAt) >= since);

  // janelas fixas (independentes do filtro de período)
  const windows = {
    hoje:  windowStats(brStartOfDay(now)),
    d7:    windowStats(now - 7 * 86400e3),
    d30:   windowStats(now - 30 * 86400e3),
    total: windowStats(0)
  };
  const range = windowStats(since);

  // sessões (presença ao vivo)
  const live = [...sessions.values()];
  const online = live.filter(isOnline);
  const sessionsInRange = live.filter(s => s.first >= since);

  const byStage = {}; STAGE_ORDER.forEach(k => byStage[k] = 0);
  online.forEach(s => { byStage[s.stage] = (byStage[s.stage] || 0) + 1; });

  const reached = {}; STAGE_ORDER.forEach(k => reached[k] = 0);
  sessionsInRange.forEach(s => {
    const idx = STAGE_ORDER.indexOf(s.stage);
    STAGE_ORDER.slice(0, idx + 1).forEach(k => reached[k]++);
  });

  const devices = {};
  online.forEach(s => { devices[s.device || 'Outro'] = (devices[s.device || 'Outro'] || 0) + 1; });

  return {
    now,
    // presença/tempo real
    online: online.length,
    onlineByStage: byStage,
    stageLabels: STAGE_LABELS,
    stageOrder: STAGE_ORDER,
    reached,
    devices,
    // período selecionado (compat: pix)
    range,
    pix: {
      criados: range.pixCriados, pagos: range.pixPagos, pendentes: range.pendentes,
      conversao: range.conversao, bruto: range.faturamento, liquido: range.liquido,
      pendenteValor: range.pendenteValor, ticket: range.ticket
    },
    sessions: range.visitantes,
    visitantes: range.visitantes,
    checkouts: range.checkouts,
    taxaVisitaPago: range.taxaVisitaPago,
    // janelas fixas para os cards
    windows,
    // gráficos
    daily: dailySeries(30),
    hours: hourlySeries(),
    porCampanha: group(inRangePaid, s => s.utmCampaign),
    porFonte:    group(inRangePaid, s => s.utmSource),
    // mesmos cortes, com taxa de pagamento (denominador = PIX gerados)
    porAparelho:      groupConv(inRangeAll, s => s.device || 'Desconhecido'),
    porCampanhaConv:  groupConv(inRangeAll, s => s.utmCampaign),
    porFonteConv:     groupConv(inRangeAll, s => s.utmSource),
    // presença ao vivo (listas)
    online_list: online.sort((a, b) => b.last - a.last).slice(0, 60).map(s => ({
      sid: s.sid.slice(0, 10), stage: s.stage, device: s.device,
      seg: Math.round((now - s.first) / 1000),
      utmSource: (s.utm && s.utm.utmSource) || '',
      utmCampaign: (s.utm && s.utm.utmCampaign) || ''
    })),
    // vendas recentes (dashboard) e pagas recentes (notificações)
    ultimasVendas: all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 25).map(saleRow),
    ultimasPagas: paidAll.sort((a, b) => new Date(b.paidAt || b.createdAt) - new Date(a.paidAt || a.createdAt)).slice(0, 10).map(saleRow),
    eventos: eventsDb.slice(-40).reverse()
  };
}

/* ---------- registro de vendas (chamado pelo adaptador) ---------- */
function recordSale(sale, extra = {}) {
  salesDb[sale.id] = Object.assign({}, salesDb[sale.id], {
    id: sale.id,
    status: sale.status,
    amount: Number(sale.amount),
    fee: Number(sale.fee || 0),
    netAmount: Number(sale.netAmount || 0),
    description: sale.description || extra.description || '',
    payerName: sale.payerName || extra.payerName || '',
    payerDocument: undefined,           // não guardamos documento
    externalId: sale.externalId,
    transactionId: sale.transactionId,
    utmSource: sale.utmSource || extra.utmSource || '',
    utmCampaign: sale.utmCampaign || extra.utmCampaign || '',
    utmMedium: sale.utmMedium || extra.utmMedium || '',
    utmContent: sale.utmContent || extra.utmContent || '',
    utmTerm: sale.utmTerm || extra.utmTerm || '',
    ttclid: sale.ttclid || extra.ttclid || '',
    device: extra.device || salesDb[sale.id]?.device || '',
    eventId: sale.eventId || extra.eventId || '',
    orderFp: sale.orderFp || extra.orderFp || salesDb[sale.id]?.orderFp || '',
    sid: extra.sid || salesDb[sale.id]?.sid || '',
    gateway: sale.gateway || extra.gateway || salesDb[sale.id]?.gateway || 'nerva',
    createdAt: sale.createdAt || salesDb[sale.id]?.createdAt || new Date().toISOString(),
    paidAt: sale.paidAt || salesDb[sale.id]?.paidAt || null
  });
  persist();
  flushSales();          // pedido gravado JÁ — sobrevive a restart/queda
  return salesDb[sale.id];
}

/* pedido equivalente recente: mesma impressao digital (CPF+valor+produto,
   guardada como hash — o documento nunca e gravado) e ainda pendente. Serve
   para o mesmo carrinho clicado 2x nao virar 2 cobrancas. */
function findRecentByFp(fp, maxAgeMs) {
  if (!fp) return null;
  const min = Date.now() - maxAgeMs;
  let best = null, bestT = 0;
  for (const s of Object.values(salesDb)) {
    if (s.orderFp !== fp) continue;
    if (String(s.status || '').toLowerCase() !== 'pending') continue;
    const t = new Date(s.createdAt || 0).getTime();
    if (!(t >= min) || t < bestT) continue;
    best = s; bestT = t;
  }
  return best;
}

function markPaid(id, data) {
  try {
    const v = salesDb[id];
    if (v && v.sid) monitor.passo(v.sid, 'pago', { valor: Number(data && data.amount) || v.amount });
  } catch (_) {}
  let s = salesDb[id];
  /* Venda desconhecida: o webhook chegou para um pedido que este servidor
     nunca viu. Acontece de verdade quando o disco e efemero (o plano free
     do Render apaga a cada deploy) ou quando o pedido foi gerado por outra
     instancia. Antes o pagamento era descartado em silencio: confirmado na
     Nerva e invisivel no painel. Agora o registro nasce do proprio webhook,
     que ja traz valor, taxa, liquido e pagador. */
  if (!s && data && data.id) {
    recordSale({
      id: data.id,
      status: 'paid',
      amount: Number(data.amount) || 0,
      fee: Number(data.fee) || 0,
      netAmount: Number(data.netAmount) || 0,
      description: data.description || '',
      payerName: data.payerName || '',
      externalId: data.externalId || '',
      transactionId: data.transactionId || '',
      createdAt: data.createdAt || new Date().toISOString()
    }, { origem: 'webhook' });
    s = salesDb[id];
    if (s) logEvent('sale_recuperada', { id, amount: s.amount });
  }
  if (!s) return null;
  const already = s.status === 'paid';
  s.status = 'paid';
  s.paidAt = (data && (data.paidAt || data.updatedAt)) || s.paidAt || (data && data.createdAt) || s.createdAt || new Date().toISOString();
  if (data && data.netAmount != null) s.netAmount = Number(data.netAmount);
  persist();
  flushSales();
  if (!already) logEvent('sale_paid', { id, amount: s.amount, utmCampaign: s.utmCampaign });
  /* empurra para o painel DEPOIS de gravar (o painel recarrega ao receber e
     precisa encontrar a venda ja como paga) — e so na primeira confirmacao */
  if (!already) {
    try { monitor.emitir('venda', { id, status: 'paid', amount: s.amount, product: s.description || '', payerName: s.payerName || '', paidAt: s.paidAt }); } catch (_) {}
  }
  return s;
}

/* cobrancas ainda pendentes (para o servidor vigiar o pagamento sozinho) */
function pendingSales(maxAgeMs) {
  const min = Date.now() - (maxAgeMs || 24 * 3600e3);
  return Object.values(salesDb).filter(s =>
    String(s.status || '').toLowerCase() === 'pending' && new Date(s.createdAt || 0).getTime() >= min);
}

function setStatus(id, status) {
  const s = salesDb[id];
  if (!s) return null;
  s.status = status;
  persist();
  flushSales();
  return s;
}

/* ---------- rotas ---------- */
function mount(app, opts = {}) {
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  // ping de presença (público — vem do site)
  app.post('/api/funnel/ping', (req, res) => {
    const b = req.body || {};
    if (!b.sid) return res.status(400).json({ ok: false });
    if (b.bye) {
      const s = sessions.get(b.sid);
      if (s) s.last = 0;                       // marca offline na hora
      emitirOnlineSeMudou();
      return res.json({ ok: true });
    }
    touchSession(String(b.sid).slice(0, 64), { stage: b.stage, utm: b.utm, ref: b.ref }, req);
    emitirOnlineSeMudou();                     // painel vê a pessoa no mesmo segundo
    res.json({ ok: true });
  });

  // auth do painel
  function auth(req, res, next) {
    if (!ADMIN_TOKEN) return res.status(500).json({ error: 'ADMIN_TOKEN não configurado' });
    const t = req.query.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const a = Buffer.from(String(t)); const b = Buffer.from(ADMIN_TOKEN);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    next();
  }

  /* Painel de monitoramento. Recebe referências vivas — não cópias — para
     ler sempre o estado atual sem duplicar dado em memória. */
  monitor.mount(app, auth, {
    sessions, salesDb, eventsDb, dailyDb,
    tracking: (() => { try { return require('./tracking'); } catch (_) { return null; } })(),
    online: onlineAgora
  });

  app.get('/api/admin/metrics', auth, (req, res) => {
    const range = { '1h': 3600e3, '24h': 24*3600e3, '7d': 7*24*3600e3, '30d': 30*24*3600e3 }[req.query.range];
    res.json(metrics(range));
  });

  // tabela de vendas com filtros: from/to (ms epoch ou ISO), status
  app.get('/api/admin/sales', auth, (req, res) => {
    const parse = v => { if (!v) return null; const n = Number(v); return Number.isFinite(n) ? n : new Date(v).getTime(); };
    const from = parse(req.query.from);
    const to   = parse(req.query.to);
    const status = (req.query.status || 'all').toLowerCase();
    let rows = Object.values(salesDb).map(saleRow);
    if (from != null) rows = rows.filter(r => tOf(r.createdAt) >= from);
    if (to   != null) rows = rows.filter(r => tOf(r.createdAt) <= to);
    if (status !== 'all') rows = rows.filter(r => r.status === status);
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const limit = Math.min(2000, Number(req.query.limit) || 500);
    res.json({ total: rows.length, rows: rows.slice(0, limit) });
  });

  app.get(['/admin', '/nerva/admin.html'], (_req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(__dirname, 'admin.html')); });

  return { recordSale, markPaid, setStatus, logEvent, auth };
}

module.exports = { mount, recordSale, markPaid, setStatus, logEvent, metrics, findRecentByFp, deviceOf, pendingSales,
  getSale: (id) => salesDb[id] || null, salesList: () => Object.values(salesDb),
  /* sessoes vivas para a geo em tempo real (so o necessario, nada de PII) */
  onlineSessions: () => [...sessions.values()].filter(isOnline)
    .map(s => ({ ip: s.ip || '', stage: s.stage || 'page_view', device: s.device || '', ageSec: Math.round((Date.now() - s.last) / 1000) })),
  stageLabel: (st) => STAGE_LABELS[st] || 'Navegando' };
