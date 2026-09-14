/* =========================================================
   TikTok Ads no painel — gasto, cliques, CTR e conversão das
   campanhas, cruzados com as VENDAS REAIS PAGAS do painel.

   Por que cruzar: o relatório do TikTok só enxerga o que ele
   conseguiu atribuir. O painel sabe o que de fato foi pago
   (sales.json). Juntando os dois sai o ROI de verdade.

   Precisa de um token com escopo de RELATÓRIO — o token do
   Events API NÃO serve (responde 40001 lacks required scope).
   Token e advertiser_id são configurados pelo painel.
   ========================================================= */
'use strict';

const settings = require('./settings');
const admin    = require('./admin');

const BASE = 'https://business-api.tiktok.com/open_api/v1.3';
const API  = BASE + '/report/integrated/get/';
const AUTH_URL   = 'https://business-api.tiktok.com/portal/auth';
const TOKEN_URL  = BASE + '/oauth2/access_token/';
const ADV_INFO   = BASE + '/advertiser/info/';

/* metricas completas; se o TikTok recusar alguma, cai na lista basica */
const METRICAS = ['campaign_name','spend','impressions','clicks','ctr','cpc','cpm',
                  'conversion','cost_per_conversion','conversion_rate',
                  'complete_payment','complete_payment_roas'];
const METRICAS_BASE = ['campaign_name','spend','impressions','clicks','ctr','cpc','cpm',
                       'conversion','cost_per_conversion'];

const n2 = x => Math.round((Number(x) || 0) * 100) / 100;
const num = x => Number(x) || 0;

/* ---------- janelas de tempo em horário de Brasília ---------- */
const MS_DIA = 86400000;
function inicioDoDiaBR(ts) {
  const d = new Date(ts - 3 * 3600e3);                 // desloca para BRT
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) + 3 * 3600e3;
}
function dataBR(ts) {
  return new Date(ts - 3 * 3600e3).toISOString().slice(0, 10);
}
function janela(range) {
  const agora = Date.now();
  const hoje0 = inicioDoDiaBR(agora);
  if (range === '7d')  return { desde: hoje0 - 6 * MS_DIA, ate: agora };
  if (range === '30d') return { desde: hoje0 - 29 * MS_DIA, ate: agora };
  return { desde: hoje0, ate: agora };                 // hoje
}

/* ---------- vendas reais do painel, agrupadas por campanha ---------- */
function vendasPorCampanha(desde, ate) {
  const porCamp = new Map();
  let total = { vendas: 0, receita: 0, liquido: 0, pixCriados: 0 };
  for (const v of admin.salesList()) {
    const camp = String(v.utmCampaign || '').trim();
    const criado = v.createdAt ? new Date(v.createdAt).getTime() : 0;
    const pago   = v.paidAt ? new Date(v.paidAt).getTime() : criado;
    const c = porCamp.get(camp) || { vendas: 0, receita: 0, liquido: 0, pixCriados: 0 };

    if (criado >= desde && criado <= ate) { c.pixCriados++; total.pixCriados++; }
    if (v.status === 'paid' && pago >= desde && pago <= ate) {
      c.vendas++;  c.receita += num(v.amount);  c.liquido += num(v.netAmount) || num(v.amount);
      total.vendas++; total.receita += num(v.amount); total.liquido += num(v.netAmount) || num(v.amount);
    }
    porCamp.set(camp, c);
  }
  return { porCamp, total };
}

/* ---------- chamada ao TikTok ---------- */
async function relatorio(token, advertiser, de, ate, metricas) {
  const q = new URLSearchParams({
    advertiser_id: advertiser,
    report_type: 'BASIC',
    data_level: 'AUCTION_CAMPAIGN',
    dimensions: JSON.stringify(['campaign_id']),
    metrics: JSON.stringify(metricas),
    start_date: de, end_date: ate,
    page: '1', page_size: '200'
  });
  const r = await fetch(API + '?' + q.toString(), { headers: { 'Access-Token': token } });
  return r.json();
}

/* ---------- cache curto: a API do TikTok tem limite de chamadas ---------- */
const cache = new Map();
const TTL = 120e3;

async function painel(range) {
  const cfg = settings.get();
  const token = cfg.tiktokAdsToken, adv = cfg.tiktokAdvertiserId;
  if (!token || !adv) return { configurado: false };

  const chave = range + '|' + adv;
  const hit = cache.get(chave);
  if (hit && Date.now() - hit.t < TTL) return hit.v;

  const { desde, ate } = janela(range);
  const de = dataBR(desde), ateD = dataBR(ate);

  let j = await relatorio(token, adv, de, ateD, METRICAS);
  if (j && j.code !== 0) j = await relatorio(token, adv, de, ateD, METRICAS_BASE);
  if (!j || j.code !== 0) {
    return { configurado: true, erro: (j && j.message) || 'falha ao consultar o TikTok', code: j && j.code };
  }

  const linhas = (j.data && j.data.list) || [];
  const real = vendasPorCampanha(desde, ate);

  const campanhas = linhas.map(l => {
    const m = l.metrics || {};
    const nome = m.campaign_name || '(sem nome)';
    const r = real.porCamp.get(nome) || { vendas: 0, receita: 0, liquido: 0, pixCriados: 0 };
    const gasto = num(m.spend);
    return {
      id: (l.dimensions || {}).campaign_id || '',
      nome,
      gasto: n2(gasto),
      impressoes: num(m.impressions),
      cliques: num(m.clicks),
      ctr: n2(m.ctr),
      cpc: n2(m.cpc),
      cpm: n2(m.cpm),
      convTikTok: num(m.complete_payment != null ? m.complete_payment : m.conversion),
      roasTikTok: n2(m.complete_payment_roas),
      // do painel — dinheiro que entrou de verdade
      pixCriados: r.pixCriados,
      vendas: r.vendas,
      receita: n2(r.receita),
      liquido: n2(r.liquido),
      cpa: r.vendas ? n2(gasto / r.vendas) : 0,
      roas: gasto ? n2(r.receita / gasto) : 0,
      lucro: n2(r.liquido - gasto)
    };
  }).sort((a, b) => b.gasto - a.gasto);

  const som = (k) => campanhas.reduce((a, c) => a + c[k], 0);
  const gasto = n2(som('gasto')), cliques = som('cliques'), impressoes = som('impressoes');
  const total = {
    gasto, impressoes, cliques,
    ctr: impressoes ? n2(cliques / impressoes * 100) : 0,
    cpc: cliques ? n2(gasto / cliques) : 0,
    cpm: impressoes ? n2(gasto / impressoes * 1000) : 0,
    convTikTok: som('convTikTok'),
    vendas: real.total.vendas,
    receita: n2(real.total.receita),
    liquido: n2(real.total.liquido),
    cpa: real.total.vendas ? n2(gasto / real.total.vendas) : 0,
    roas: gasto ? n2(real.total.receita / gasto) : 0,
    lucro: n2(real.total.liquido - gasto),
    /* quanto o TikTok deixou de atribuir: vendas reais menos as que ele contou */
    naoAtribuidas: Math.max(0, real.total.vendas - som('convTikTok'))
  };

  const out = { configurado: true, periodo: { de, ate: ateD }, total, campanhas };
  cache.set(chave, { t: Date.now(), v: out });
  return out;
}


/* ================== CONECTAR PELO BOTAO (OAuth) ==================
   O usuario cria UMA vez um app em business-api.tiktok.com/portal,
   cola App ID + Secret aqui, clica em Conectar e autoriza no TikTok.
   O token e o advertiser_id chegam sozinhos — sem copiar token.
   ================================================================ */

/* states pendentes: valor aleatorio criado numa chamada JA autenticada
   do painel. O callback do TikTok nao carrega o token do admin, entao e
   o state que prova que aquele retorno veio de um pedido nosso. */
const states = new Map();
function novoState() {
  const st = require('crypto').randomBytes(24).toString('hex');
  states.set(st, Date.now());
  for (const [k, t] of states) if (Date.now() - t > 15 * 60e3) states.delete(k);
  return st;
}
const redirectUri = req =>
  (process.env.PUBLIC_URL || ('https://' + req.headers.host)).replace(/\/+$/, '') + '/api/admin/ads/callback';

async function trocarCodigo(appId, secret, code) {
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, secret: secret, auth_code: code, grant_type: 'auth_code' })
  });
  return r.json();
}

async function nomesDosAnunciantes(token, ids) {
  try {
    const q = new URLSearchParams({ advertiser_ids: JSON.stringify(ids) });
    const r = await fetch(ADV_INFO + '?' + q.toString(), { headers: { 'Access-Token': token } });
    const j = await r.json();
    if (j.code !== 0) return ids.map(id => ({ id, nome: id }));
    return ((j.data || {}).list || []).map(a => ({ id: String(a.advertiser_id), nome: a.name || String(a.advertiser_id) }));
  } catch (_) { return ids.map(id => ({ id, nome: id })); }
}

function mount(app, auth) {
  app.get('/api/admin/ads', auth, async (req, res) => {
    try {
      const range = ['hoje', '7d', '30d'].includes(req.query.range) ? req.query.range : 'hoje';
      res.set('Cache-Control', 'no-store');
      res.json(await painel(range));
    } catch (e) {
      res.status(500).json({ configurado: true, erro: e.message });
    }
  });

  /* passo 1: o painel pede o link de autorização (já autenticado) */
  app.get('/api/admin/ads/auth-url', auth, (req, res) => {
    const cfg = settings.get();
    const uri = redirectUri(req);
    if (!cfg.tiktokAppId || !cfg.tiktokAppSecret) {
      return res.json({ ok: false, redirectUri: uri, erro: 'Salve o App ID e o Secret antes de conectar.' });
    }
    const st = novoState();
    const url = AUTH_URL + '?' + new URLSearchParams({
      app_id: cfg.tiktokAppId, state: st, redirect_uri: redirectUri(req)
    }).toString();
    res.json({ ok: true, url, redirectUri: redirectUri(req) });
  });

  /* passo 2: o TikTok manda o navegador de volta para cá com o auth_code.
     Sem token de admin na URL — quem autentica é o state. */
  app.get('/api/admin/ads/callback', async (req, res) => {
    const volta = (q) => res.redirect(302, '/nerva/admin.html?ads=' + q);
    const st = String(req.query.state || '');
    if (!states.has(st)) return volta('estado_invalido');
    states.delete(st);
    const code = String(req.query.auth_code || req.query.code || '');
    if (!code) return volta('sem_codigo');
    const cfg = settings.get();
    try {
      const j = await trocarCodigo(cfg.tiktokAppId, cfg.tiktokAppSecret, code);
      if (!j || j.code !== 0 || !j.data || !j.data.access_token) {
        console.error('[ads] troca de código falhou:', j && j.message);
        return volta('falhou');
      }
      const ids = (j.data.advertiser_ids || []).map(String);
      const patch = { tiktokAdsToken: j.data.access_token };
      // uma conta só: já deixa escolhida
      if (ids.length === 1) patch.tiktokAdvertiserId = ids[0];
      settings.save(patch);
      cache.clear();
      volta(ids.length === 1 ? 'ok' : 'escolher');
    } catch (e) {
      console.error('[ads] callback:', e.message);
      volta('falhou');
    }
  });

  /* contas que a autorização liberou (para o usuário escolher) */
  app.get('/api/admin/ads/advertisers', auth, async (_req, res) => {
    const cfg = settings.get();
    if (!cfg.tiktokAdsToken) return res.json({ ok: false, contas: [] });
    try {
      const r = await fetch(BASE + '/oauth2/advertiser/get/?' + new URLSearchParams({
        app_id: cfg.tiktokAppId, secret: cfg.tiktokAppSecret
      }).toString(), { headers: { 'Access-Token': cfg.tiktokAdsToken } });
      const j = await r.json();
      const lista = ((j.data || {}).list || []).map(a => ({
        id: String(a.advertiser_id), nome: a.advertiser_name || String(a.advertiser_id)
      }));
      if (lista.length) return res.json({ ok: true, contas: lista, escolhida: cfg.tiktokAdvertiserId });
      return res.json({ ok: false, contas: [], erro: (j && j.message) || 'nenhuma conta retornada' });
    } catch (e) { res.json({ ok: false, contas: [], erro: e.message }); }
  });

  /* testa as credenciais na hora em que o usuário salva */
  app.post('/api/admin/ads/test', auth, async (_req, res) => {
    const cfg = settings.get();
    if (!cfg.tiktokAdsToken || !cfg.tiktokAdvertiserId) {
      return res.json({ ok: false, erro: 'Falta o token de relatório ou o ID do anunciante.' });
    }
    try {
      const hoje = dataBR(Date.now());
      const j = await relatorio(cfg.tiktokAdsToken, cfg.tiktokAdvertiserId, hoje, hoje, METRICAS_BASE);
      cache.clear();
      if (j && j.code === 0) return res.json({ ok: true, linhas: ((j.data || {}).list || []).length });
      res.json({ ok: false, erro: (j && j.message) || 'resposta inesperada', code: j && j.code });
    } catch (e) { res.json({ ok: false, erro: e.message }); }
  });
}

module.exports = { mount };
