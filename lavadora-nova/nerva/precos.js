/* =========================================================
   Preços oficiais — a fonte única que o checkout consulta.

   O preço que aparece na página é o que estava no HTML na hora em que
   ele foi gerado (ou no offer.json do painel). Entre a página abrir e o
   comprador ir para o checkout, o preço pode ter mudado no painel, ou o
   navegador pode estar com um carrinho antigo salvo no localStorage.
   Por isso o front, ao abrir o checkout e antes de gerar o Pix, pede a
   tabela daqui e recalcula — e o /api/pix/create recalcula de novo,
   pela mesma tabela, antes de cobrar. O valor que o navegador manda
   nunca é a palavra final.

     GET  /api/precos        -> tabela: principal, relacionados, order
                                bump, oferta de saída e índices por
                                título e por SKU
     POST /api/precos/cotar  -> { itens, extras, backOffer, frete }
                                -> total oficial, item a item

   Fontes: content.get() (oferta principal editada no painel) e
   pages.build(slug) (cada relacionado, já com os ajustes do painel).
   ========================================================= */
'use strict';

const content = require('./content');
const pages   = require('./pages');

const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
const r2  = n => Math.round(n * 100) / 100;
const qtd = v => Math.max(1, Math.min(99, parseInt(v, 10) || 1));

/* ---------- tabela oficial ---------- */
function tabela() {
  const main = content.get() || {};
  const pr = main.preco || {}, pd = main.produto || {};
  const porTitulo = {}, porSku = {};
  const registrar = (titulos, sku, entrada) => {
    titulos.forEach(t => { const k = norm(t); if (k) porTitulo[k] = entrada; });
    if (sku) porSku[String(sku).toUpperCase()] = entrada;
  };

  const principal = {
    sku: pd.sku || '', titulo: pd.titulo || '', nomeCurto: pd.nomeCurto || '',
    por: num(pr.por), de: num(pr.de), parcelas: pr.parcelas || 12, parcelaValor: num(pr.parcelaValor)
  };
  registrar([principal.titulo, principal.nomeCurto], principal.sku,
    { sku: principal.sku, por: principal.por, de: principal.de, tipo: 'principal' });

  /* relacionados: o catálogo com os ajustes do painel (pages.json) */
  const produtos = {};
  pages.slugs().forEach(slug => {
    const o = pages.build(slug);
    if (!o || !o.produto) return;
    const e = {
      slug, sku: o.produto.sku || '', titulo: o.produto.titulo || '',
      por: num(o.preco && o.preco.por), de: num(o.preco && o.preco.de), tipo: 'relacionado'
    };
    produtos[slug] = e;
    const card = (pages.CATALOGO.find(p => p.slug === slug) || {}).card || {};
    registrar([o.produto.titulo, o.produto.nomeCurto, card.t], e.sku, e);
  });
  /* cards editados no painel da oferta principal: só se o título ainda não existir */
  (main.relacionados || []).forEach(r => {
    const k = norm(r.t);
    if (k && !porTitulo[k]) porTitulo[k] = { sku: r.sku || '', por: num(r.p), de: num(r.old), tipo: 'relacionado' };
  });

  /* order bump: itens antes do checkout (podem ter preço próprio, diferente do card) */
  const orderBump = ((main.orderBump && main.orderBump.itens) || [])
    .map(i => ({ t: i.t, por: num(i.p), de: num(i.old) }));

  /* oferta de saída: o produto principal sai pelo preço do combo, brindes a R$ 0 */
  const os = main.ofertaSaida || {};
  const ofertaSaida = { preco: num(os.preco), brindes: (os.brindes || []).map(b => b.t) };
  ofertaSaida.brindes.forEach(t => registrar([t], '', { sku: '', por: 0, de: 0, tipo: 'brinde' }));

  return { ok: true, rev: content.rev(), geradoEm: new Date().toISOString(),
           principal, produtos, orderBump, ofertaSaida, porTitulo, porSku };
}

function precoDe(tab, titulo, sku) {
  const e = (sku && tab.porSku[String(sku).toUpperCase()]) || tab.porTitulo[norm(titulo)];
  return e && e.por != null ? e : null;
}

/* ---------- cotação de um pedido ---------- */
function cotar(pedido, tab) {
  tab = tab || tabela();
  const p = pedido || {};
  const naoEncontrados = [], itens = [], extras = [];
  const backOffer = !!p.backOffer;

  (Array.isArray(p.itens) ? p.itens : []).forEach(i => {
    const e = precoDe(tab, i && i.titulo, i && i.sku);
    if (!e) { naoEncontrados.push(String((i && (i.titulo || i.sku)) || '?')); return; }
    const q = qtd(i.qty);
    let unit = e.por;
    if (backOffer && e.tipo === 'principal' && tab.ofertaSaida.preco != null) unit = tab.ofertaSaida.preco;
    itens.push({ titulo: i.titulo || e.titulo || '', sku: e.sku || '', qty: q, unit, subtotal: r2(unit * q) });
  });

  (Array.isArray(p.extras) ? p.extras : []).forEach(x => {
    const bump = tab.orderBump.find(b => norm(b.t) === norm(x && x.titulo));
    const e = bump ? { por: bump.por, sku: '' } : precoDe(tab, x && x.titulo, x && x.sku);
    if (!e || e.por == null) { naoEncontrados.push(String((x && (x.titulo || x.sku)) || '?')); return; }
    const q = qtd(x.qty);
    extras.push({ titulo: x.titulo || '', sku: e.sku || '', qty: q, unit: e.por, subtotal: r2(e.por * q) });
  });

  /* frete é escolhido no navegador (tabela fixa em app.js); só não pode ser negativo */
  const frete = Math.max(0, num(p.frete) || 0);
  const soma = l => l.reduce((s, i) => s + i.subtotal, 0);
  const total = r2(soma(itens) + soma(extras) + frete);
  return { ok: naoEncontrados.length === 0, total, itens, extras, frete, backOffer, naoEncontrados, rev: tab.rev };
}

/* ---------- rotas ---------- */
function mount(app) {
  app.get('/api/precos', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(tabela());
  });
  app.post('/api/precos/cotar', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const q = cotar(req.body);
    res.status(q.ok ? 200 : 422).json(q);
  });
}

module.exports = { mount, tabela, cotar, precoDe, norm };
