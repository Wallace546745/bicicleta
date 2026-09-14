/* =========================================================
   Localização dos clientes no painel.

   O IP de quem chega ao checkout já é capturado e guardado no
   contexto de rastreamento (tracking.js -> data/track-ctx.json).
   Aqui esse IP vira estado + cidade via ipwho.is (HTTPS, sem
   chave), com cache em disco para nunca consultar o mesmo IP
   duas vezes. A resposta ao painel sai na hora com o que já está
   em cache; os IPs novos são resolvidos em segundo plano e
   aparecem no próximo refresh.

   Só analytics agregado do próprio tráfego da loja — estado,
   cidade e operadora. Nada de cartão, nada de PII de pagamento.
   ========================================================= */
'use strict';

const fs   = require('fs');
const path = require('path');
const admin    = require('./admin');
const tracking = require('./tracking');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const CACHE_DB = path.join(DATA_DIR, 'geo-cache.json');
const GEO_URL  = process.env.GEO_API_URL || 'https://ipwho.is/';

/* ---------- cache ip -> local ---------- */
let cache = {};
try { cache = JSON.parse(fs.readFileSync(CACHE_DB, 'utf8')) || {}; } catch (_) { cache = {}; }
let sujo = false;
setInterval(() => {
  if (!sujo) return; sujo = false;
  try { fs.writeFileSync(CACHE_DB, JSON.stringify(cache)); }
  catch (e) { console.error('[geo] cache:', e.message); }
}, 5000);

/* IP privado/reservado não tem geo pública */
function interno(ip) {
  if (!ip) return true;
  if (ip === '::1' || ip.startsWith('127.') || ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  const m = /^172\.(\d+)\./.exec(ip); if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  if (ip.startsWith('::ffff:')) return interno(ip.slice(7));
  return false;
}

/* ---------- resolução em segundo plano ---------- */
let resolvendo = false;
async function resolver(ips) {
  if (resolvendo) return;
  const faltam = ips.filter(ip => ip && !interno(ip) && !cache[ip]);
  if (!faltam.length) return;
  resolvendo = true;
  try {
    for (const ip of faltam.slice(0, 120)) {                 // teto por rodada; o resto vem no próximo refresh
      try {
        const r = await fetch(GEO_URL + encodeURIComponent(ip) +
          '?fields=success,country,country_code,region,region_code,city,connection');
        const j = await r.json();
        cache[ip] = j && j.success
          ? { cc: j.country_code || '', pais: j.country || '', uf: j.region_code || '',
              regiao: j.region || '', cidade: j.city || '',
              isp: (j.connection && (j.connection.isp || j.connection.org)) || '', ts: Date.now() }
          : { erro: true, ts: Date.now() };
        sujo = true;
      } catch (_) { /* rede: tenta de novo num próximo ciclo */ }
      await new Promise(r => setTimeout(r, 45));             // gentil com o limite do provedor
    }
  } finally { resolvendo = false; }
}

/* ---------- janelas em horário de Brasília ---------- */
const DIA = 86400000;
const inicioDiaBR = ts => { const d = new Date(ts - 3 * 3600e3);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * 3600e3; };
function janela(range) {
  const agora = Date.now(), h0 = inicioDiaBR(agora);
  if (range === '7d')  return h0 - 6 * DIA;
  if (range === '30d') return h0 - 29 * DIA;
  return h0;                                                 // hoje
}

const PAGO = new Set(['paid', 'pago', 'approved']);
const n2 = x => Math.round((Number(x) || 0) * 100) / 100;

/* ---------- monta o panorama ---------- */
function panorama(range) {
  const desde = janela(range);
  const ctx = tracking.contexts() || {};

  const linhas = [];               // { ip, pago, valor }
  for (const saleId of Object.keys(ctx)) {
    const c = ctx[saleId]; if (!c || !c.ip) continue;
    if ((c.t || 0) < desde) continue;
    const venda = admin.getSale(saleId);
    const pago = venda ? PAGO.has(String(venda.status || '').toLowerCase()) : false;
    linhas.push({ ip: c.ip, pago, valor: pago ? Number((venda && venda.amount) || c.amount || 0) : 0 });
  }

  // dispara a resolução dos que ainda não têm geo (não bloqueia a resposta)
  resolver([...new Set(linhas.map(l => l.ip))]);

  const estados = new Map(), cidades = new Map();
  let resolvidos = 0, pendentes = 0, fora = 0;

  for (const l of linhas) {
    if (interno(l.ip)) continue;
    const g = cache[l.ip];
    if (!g) { pendentes++; continue; }
    if (g.erro) { fora++; continue; }
    resolvidos++;
    if (g.cc && g.cc !== 'BR') { fora++; }               // conta como "fora do BR" mas ainda entra no estado abaixo
    const ufKey = g.cc === 'BR' ? (g.uf || '??') : (g.cc || '??');
    const ufNome = g.cc === 'BR' ? (g.regiao || g.uf || 'Outro') : (g.pais || g.cc || 'Outro');
    const e = estados.get(ufKey) || { uf: ufKey, nome: ufNome, cc: g.cc, checkouts: 0, pagos: 0, receita: 0 };
    e.checkouts++; if (l.pago) { e.pagos++; e.receita += l.valor; }
    estados.set(ufKey, e);

    if (g.cidade) {
      const ck = g.cidade + '|' + ufKey;
      const cd = cidades.get(ck) || { cidade: g.cidade, uf: ufKey, checkouts: 0, pagos: 0 };
      cd.checkouts++; if (l.pago) cd.pagos++;
      cidades.set(ck, cd);
    }
  }

  const totalGeo = resolvidos || 1;
  const porEstado = [...estados.values()]
    .map(e => ({ ...e, receita: n2(e.receita), pct: Math.round(e.checkouts / totalGeo * 100) }))
    .sort((a, b) => b.checkouts - a.checkouts);
  const porCidade = [...cidades.values()]
    .sort((a, b) => b.checkouts - a.checkouts).slice(0, 15);

  return {
    range,
    total: linhas.length,
    resolvidos, pendentes, foraBR: fora,
    atualizando: pendentes > 0,
    estados: porEstado,
    cidades: porCidade
  };
}

/* ---------- tempo real: quem está navegando agora ---------- */
function aoVivo() {
  const sess = admin.onlineSessions ? admin.onlineSessions() : [];
  resolver([...new Set(sess.map(x => x.ip))]);            // resolve os que faltam, em 2o plano

  const estados = new Map();
  const agora = [];
  let localizados = 0;
  for (const x of sess) {
    if (interno(x.ip)) continue;
    const g = cache[x.ip];
    const label = admin.stageLabel ? admin.stageLabel(x.stage) : x.stage;
    if (!g || g.erro) {
      agora.push({ cidade: '—', uf: g && g.erro ? '??' : '…', etapa: label, device: x.device, ageSec: x.ageSec });
      continue;
    }
    localizados++;
    const ufKey = g.cc === 'BR' ? (g.uf || '??') : (g.cc || '??');
    const nome  = g.cc === 'BR' ? (g.regiao || g.uf || 'Outro') : (g.pais || g.cc || 'Outro');
    const e = estados.get(ufKey) || { uf: ufKey, nome, n: 0 };
    e.n++; estados.set(ufKey, e);
    agora.push({ cidade: g.cidade || '—', uf: ufKey, etapa: label, device: x.device, ageSec: x.ageSec });
  }
  // etapas mais avancadas primeiro (quem esta perto de pagar aparece no topo)
  const peso = { 'PIX gerado (aguardando)': 5, 'Checkout · Revisão': 4, 'Checkout · Pagamento': 4,
                 'Checkout · Dados': 3, 'Checkout · Endereço': 3, 'Oferta de saída': 2, 'Pagou': 6 };
  agora.sort((a, b) => (peso[b.etapa] || 1) - (peso[a.etapa] || 1) || a.ageSec - b.ageSec);

  return {
    online: sess.length, localizados, atualizando: sess.length > localizados,
    estados: [...estados.values()].sort((a, b) => b.n - a.n),
    agora: agora.slice(0, 40)
  };
}

function mount(app, auth) {
  app.get('/api/admin/geo/live', auth, (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try { res.json(aoVivo()); } catch (e) { res.status(500).json({ erro: e.message }); }
  });

  app.get('/api/admin/geo', auth, (req, res) => {
    const range = ['hoje', '7d', '30d'].includes(req.query.range) ? req.query.range : 'hoje';
    res.set('Cache-Control', 'no-store');
    try { res.json(panorama(range)); }
    catch (e) { res.status(500).json({ erro: e.message }); }
  });
}

module.exports = { mount };
