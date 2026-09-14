/* =========================================================
   Configuração de pixel / rastreamento — editável pelo admin.
   • Pixel IDs (Meta, TikTok) são PÚBLICOS: vão para o navegador.
   • Access Token do TikTok é SECRETO: nunca sai do servidor,
     nunca volta para a tela do admin (só um resumo mascarado).
   Guardado em data/settings.json (bloqueado da web). Enquanto o
   admin não salvar nada, cai no .env / valores atuais do front.
   ========================================================= */
'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE     = path.join(DATA_DIR, 'settings.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

/* fallback: mantém o comportamento de hoje até o admin salvar algo */
const FALLBACK = {
  /* SEM fallback: cada loja tem o seu pixel. Em branco o Meta Pixel fica
     desligado até cadastrar o id desta loja no painel (Rastreamento). */
  metaPixelId:         process.env.META_PIXEL_ID         || '',
  tiktokPixelId:       process.env.TIKTOK_PIXEL_ID       || '',
  tiktokAccessToken:   process.env.TIKTOK_ACCESS_TOKEN   || '',
  tiktokTestEventCode: process.env.TIKTOK_TEST_EVENT_CODE || '',
  /* relatorio de campanhas: token com escopo de RELATORIO (o do Events API nao serve) */
  tiktokAdsToken:      process.env.TIKTOK_ADS_TOKEN      || '',
  tiktokAdvertiserId:  process.env.TIKTOK_ADVERTISER_ID  || '',
  /* app do TikTok for Business: liga a conta pelo botao Conectar (OAuth) */
  tiktokAppId:         process.env.TIKTOK_APP_ID         || '',
  tiktokAppSecret:     process.env.TIKTOK_APP_SECRET     || '',
  postPaymentUrl:      process.env.POST_PAYMENT_URL || '',
  /* gateway de pagamento: podem vir do .env ou ser cadastradas no painel */
  nervaApiKey:         process.env.NERVA_API_KEY        || '',
  nervaWebhookSecret:  process.env.NERVA_WEBHOOK_SECRET || ''
};
const KEYS = Object.keys(FALLBACK);

function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch (_) { return {}; } }
let store = load();

/* Migração: o pixel do Meta da LAVADORA ficou gravado no settings.json de
   instalações antigas (o painel reenviava o valor padrão ao salvar qualquer
   campo). Esse id é de outra loja: é descartado e o campo volta a vazio até o
   dono cadastrar o pixel desta loja. */
const PIXEL_META_OUTRA_LOJA = new Set(['1593228632374084', '1676043856783119']);
if (PIXEL_META_OUTRA_LOJA.has(String(store.metaPixelId || '').replace(/\D/g, ''))) {
  delete store.metaPixelId;
  try { fs.writeFileSync(FILE, JSON.stringify(store, null, 2)); } catch (_) {}
  console.warn('[settings] pixel do Meta de outra loja removido; cadastre o pixel desta loja no painel (Rastreamento).');
}

/* valores efetivos: o que o admin salvou tem prioridade; vazio cai no fallback */
function get() {
  const out = {};
  for (const k of KEYS) {
    const v = store[k];
    out[k] = (v != null && v !== '') ? v : FALLBACK[k];
  }
  return out;
}

/* só o que pode ir para o navegador (NUNCA o token) */
function getPublic() {
  const s = get();
  return {
    metaPixelId:         s.metaPixelId,
    tiktokPixelId:       s.tiktokPixelId,
    tiktokTestEventCode: s.tiktokTestEventCode,
    postPaymentUrl:      s.postPaymentUrl
  };
}

function mask(tok) {
  if (!tok) return '';
  const s = String(tok);
  return s.length <= 4 ? '••••' : '••••••••' + s.slice(-4);
}

/* estado seguro para o painel: token mascarado, nunca o valor real */
function adminView() {
  const s = get();
  return {
    metaPixelId:           s.metaPixelId,
    tiktokPixelId:         s.tiktokPixelId,
    tiktokTestEventCode:   s.tiktokTestEventCode,
    postPaymentUrl:        s.postPaymentUrl,
    tiktokAccessTokenSet:  !!s.tiktokAccessToken,
    tiktokAccessTokenMask: mask(s.tiktokAccessToken),
    tiktokAdvertiserId:    s.tiktokAdvertiserId,
    tiktokAdsTokenSet:     !!s.tiktokAdsToken,
    tiktokAdsTokenMask:    mask(s.tiktokAdsToken),
    tiktokAppId:           s.tiktokAppId,
    tiktokAppSecretSet:    !!s.tiktokAppSecret,
    nervaApiKeySet:        !!s.nervaApiKey,
    nervaApiKeyMask:       mask(s.nervaApiKey),
    nervaWebhookSecretSet: !!s.nervaWebhookSecret
  };
}

function save(patch) {
  patch = patch || {};
  const next = Object.assign({}, store);
  for (const k of ['metaPixelId', 'tiktokPixelId', 'tiktokTestEventCode', 'postPaymentUrl', 'tiktokAdvertiserId', 'tiktokAppId']) {
    if (typeof patch[k] === 'string') next[k] = patch[k].trim();
  }
  // token: só troca se veio um valor novo de verdade (não vazio e não a máscara)
  if (typeof patch.tiktokAccessToken === 'string') {
    const t = patch.tiktokAccessToken.trim();
    if (t && !/^[•]/.test(t)) next.tiktokAccessToken = t;
  }
  if (typeof patch.tiktokAdsToken === 'string') {
    const t = patch.tiktokAdsToken.trim();
    if (t && !/^[•]/.test(t)) next.tiktokAdsToken = t;
  }
  if (typeof patch.tiktokAppSecret === 'string') {
    const t = patch.tiktokAppSecret.trim();
    if (t && !/^[•]/.test(t)) next.tiktokAppSecret = t;
  }
  for (const k of ['nervaApiKey', 'nervaWebhookSecret']) {
    if (typeof patch[k] === 'string') { const t = patch[k].trim(); if (t && !/^[•]/.test(t)) next[k] = t; }
  }
  store = next;
  try { fs.writeFileSync(FILE, JSON.stringify(store, null, 2)); }
  catch (e) { console.error('[settings] persist:', e.message); }
  return get();
}

/* produto que o pixel deve reportar nesta página: {sku, nome, preco}.
   Aceita a oferta principal (content.js) ou uma página /p/<slug> (pages.build) */
function produtoPixel(offer) {
  if (!offer || !offer.produto) return null;
  const preco = offer.preco && offer.preco.por != null ? Number(offer.preco.por) : undefined;
  const cat = offer.produto.categoria;
  return {
    sku:   offer.produto.sku ? String(offer.produto.sku) : undefined,
    nome:  offer.produto.nomeCurto || offer.produto.titulo || undefined,
    preco: Number.isFinite(preco) ? preco : undefined,
    /* brand e content_category dos contents (catálogo / Video Shopping Ads) */
    marca: offer.produto.marca ? String(offer.produto.marca) : undefined,
    categoria: Array.isArray(cat) ? String(cat[cat.length - 1] || '') || undefined : (cat ? String(cat) : undefined)
  };
}

/* <script> injetado logo depois do <head>: Pixel IDs, link de pós-venda e o
   produto desta página. O rastreamento no <head> lê window.__TTK_PRODUTO__ e
   dispara o ViewContent na hora, com o SKU e o preço certos — sem esperar o
   offer.json. JSON escapado para nunca fechar a tag por acidente. */
const jsInline = o => JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
function pixelTag(produto) {
  const p = getPublic();
  const meta = String(p.metaPixelId || '').replace(/\D/g, '');
  return '<script>window.__PIXELS__=' + jsInline({
    meta:     meta,
    tiktok:   p.tiktokPixelId || '',
    testCode: p.tiktokTestEventCode || ''
  }) + ';window.__POSTPAY__=' + jsInline(p.postPaymentUrl || '')
    + (produto ? ';window.__TTK_PRODUTO__=' + jsInline(produto) : '') + ';</script>'
    /* <noscript> do Meta com o id do painel (antes era fixo no HTML, com o id de outra loja) */
    + (meta ? '<noscript><img height="1" width="1" style="display:none" alt="" src="https://www.facebook.com/tr?id=' + meta + '&ev=PageView&noscript=1"></noscript>' : '');
}

/* index.html da loja com os Pixel IDs e o link de pos-venda injetados.
   Usado pela home E pelas paginas /p/<produto> (pages.js) — sem isso, trocar
   o pixel no painel nao chegava nas paginas de produto. */
const INDEX_FILE = path.join(__dirname, '..', 'index.html');
function renderIndex(produto) { return renderHtml(INDEX_FILE, produto); }
/* qualquer página da loja (index, presell) com os pixels do painel injetados */
function renderHtml(file, produto) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); } catch (_) { return null; }
  const tag = pixelTag(produto);
  return html.replace(/<head(\s[^>]*)?>/i, m => m + '\n' + tag);
}

function mount(app, auth) {
  // ler/salvar a config do pixel (protegido pelo token do admin)
  app.get('/api/admin/pixel-config',  auth, (_req, res) => res.json(adminView()));
  app.post('/api/admin/pixel-config', auth, (req, res) => { save(req.body || {}); res.json(adminView()); });

  // serve o index.html injetando os Pixel IDs atuais (o front usa window.__PIXELS__)
  // e o produto da oferta principal, com o preço que está no painel agora
  app.get(['/', '/index.html'], (req, res, next) => {
    let produto = null;
    try { produto = produtoPixel(require('./content').get()); } catch (_) { produto = null; }
    const html = renderIndex(produto);
    if (!html) return next();
    res.set('Cache-Control', 'no-store').type('html').send(html);
  });
}

module.exports = { get, getPublic, save, adminView, mount, renderIndex, renderHtml, pixelTag, produtoPixel };
