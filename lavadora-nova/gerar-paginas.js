#!/usr/bin/env node
/* ============================================================
   Gera uma pagina real para cada produto relacionado:

       p/<slug>/index.html

   Cada uma usa o MESMO index.html da loja (mesmo layout, CSS,
   JS e responsividade), so que com o conteudo daquele produto
   ja embutido — nao depende do backend. Funciona no Live Server,
   no GitHub Pages, em qualquer host estatico.

   Rodar na raiz do projeto:   node gerar-paginas.js
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const Module = require('module');

/* pages.js pede express so para registrar rotas; aqui nao subimos
   servidor nenhum, entao um stub basta e dispensa o npm install. */
const _load = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'express') {
    const f = function () {};
    f.static = () => {};
    f.Router = () => ({ get() {}, post() {}, use() {} });
    f.json = () => {};
    return f;
  }
  return _load.call(this, req, ...rest);
};

const ROOT = __dirname;

/* Domínio público da loja. Com ele, canonical, og:url, og:image e o JSON-LD
   saem absolutos (o robô do Facebook e o Google não executam JS). Sem ele,
   ficam relativos à raiz e o navegador completa em tempo de execução.
     SITE_URL=https://minhaloja.com.br node gerar-paginas.js               */
const SITE_URL = String(process.env.SITE_URL || '').replace(/\/+$/, '');
const abs = u => { u = String(u || ''); if (/^https?:/.test(u)) return u; u = '/' + u.replace(/^\/+/, ''); return SITE_URL ? SITE_URL + u : u; };
const pages = require('./nerva/pages');

/* url que funciona de qualquer profundidade (usamos <base> nas paginas) */
const rel = u => {
  if (!u) return '';
  if (u === '/') return './';
  const m = String(u).match(/^\/p\/([a-z0-9-]+)\/?$/i);
  return m ? 'p/' + m[1] + '/' : u;
};

const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

const ANCORA = `<script>
/* Com <base>, um href="#secao" apontaria para a home. Este handler
   mantem as ancoras funcionando dentro da propria pagina, inclusive
   nos links criados pelo JS depois que a pagina carrega. */
document.addEventListener('click', function (e) {
  var a = e.target && e.target.closest && e.target.closest('a[href^="#"]');
  if (!a) return;
  var id = a.getAttribute('href').slice(1);
  if (!id) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  var alvo = document.getElementById(id);
  if (!alvo) return;
  e.preventDefault();
  alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // com <base>, um '#id' solto seria resolvido a partir da raiz:
  // precisa do caminho da propria pagina.
  try { history.replaceState(null, '', location.pathname + location.search + '#' + id); } catch (_) {}
}, true);
</script>`;

function gerar(slug) {
  const offer = pages.build(slug);
  if (!offer) throw new Error('slug sem pagina: ' + slug);

  // links dos cards passam a ser relativos (funcionam sem backend)
  (offer.relacionados || []).forEach(r => { r.url = rel(r.url); });

  const dados = JSON.stringify(offer)
    .replace(/</g, '\\u003c')      // nunca fechar o <script> por acidente
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  let html = INDEX;

  // 1) assets (css, js, imagens) continuam resolvendo a partir da raiz
  html = html.replace('<meta name="referrer" content="no-referrer">',
    '<meta name="referrer" content="no-referrer">\n'
    + '<!-- pagina gerada por gerar-paginas.js — nao edite a mao -->\n'
    + '<base href="../../">');

  // 2) conteudo do produto embutido: dispensa /api/offer.json
  // o marcador pode estar indentado no index.html
  html = html.replace(/<script>\s*\n(\s*)window\.OFFER = null;/,
    (m, ind) => '<script>window.__OFFER_ESTATICO__ = ' + dados + ';</script>\n'
    + ANCORA + '\n<script>\n' + ind + 'window.OFFER = null;');
  if (html.indexOf('__OFFER_ESTATICO__ =') < 0) throw new Error('marcador window.OFFER = null nao encontrado no index.html');

  /* O index.html tem <img> com a foto do produto principal cravada no
     HTML (palco, miniaturas do checkout, seguro, combo da oferta de
     saida). O JS troca isso em tempo de execucao, mas ate la a foto
     errada aparece — e algumas so sao trocadas em telas mais adiante.
     Aqui elas ja nascem com a foto do produto desta pagina. */
  const capa = (offer.fotos && offer.fotos[0]) || '';
  if (capa) {
    const alvo = /src="img\/(?:produto|relacionados)\/[^"]+"/g;
    html = html.replace(
      /(<img[^>]*\bid="(?:stageImg|revThumb|paidThumb|paidProdThumb)"[^>]*)src="[^"]*"/g,
      (m, pre) => pre + 'src="' + capa + '"');
    html = html.replace(
      /(<div class="cho-seguro__prod">\s*<img[^>]*)src="[^"]*"/g,
      (m, pre) => pre + 'src="' + capa + '"');
    // combo da oferta de saida: usa as fotos desta pagina
    let n = 0;
    html = html.replace(/(<div class="bo-offer__imgs">)([\s\S]*?)(<\/div>)/,
      (m, a, meio, z) => a + meio.replace(/(<img[^>]*)src="[^"]*"/g,
        (mm, pre) => pre + 'src="' + ((offer.fotos && offer.fotos[n++ % offer.fotos.length]) || capa) + '"') + z);
    // og:image / twitter:image / preload
    html = html.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")[^"]*(")/g, '$1' + abs(capa) + '$2');
    html = html.replace(/(<link rel="preload" as="image" href=")[^"]*(")/g, '$1' + capa + '$2');
  }

  /* Dados estruturados, canonical e og:url DESTA página. Sem isto, todas as
     páginas de produto diziam ao Google que eram a oferta principal, com o
     nome e o preço dela. */
  const pd = offer.produto || {}, pr = offer.preco || {};
  const urlPagina = abs('p/' + slug + '/');
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: pd.titulo || pd.nomeCurto || '',
    image: (offer.fotos || []).map(abs),
    description: (offer.seo && offer.seo.description) || '',
    sku: pd.sku || undefined,
    brand: pd.marca ? { '@type': 'Brand', name: pd.marca } : undefined,
    aggregateRating: pd.nota ? { '@type': 'AggregateRating', ratingValue: String(pd.nota),
      reviewCount: String(pd.avaliacoes || '').replace(/\D/g, '') || '1', bestRating: '5', worstRating: '1' } : undefined,
    offers: { '@type': 'Offer', url: urlPagina, priceCurrency: 'BRL', price: Number(pr.por || 0).toFixed(2),
      availability: 'https://schema.org/InStock', itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: pd.vendedor || 'Domus' } }
  };
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    '<script type="application/ld+json">\n' + JSON.stringify(ld, null, 2).replace(/</g, '\\u003c') + '\n</script>');
  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + urlPagina + '$2');
  html = html.replace(/<meta property="og:url" content="[^"]*">\n?/, '');
  if (SITE_URL) html = html.replace('<link rel="canonical"', '<meta property="og:url" content="' + urlPagina + '">\n  <link rel="canonical"');

  /* O TTK_CONFIG do index.html e estatico: sem reescrever, o pixel
     reportaria o produto da oferta principal ate a hidratacao rodar. */
  const esc = t => String(t).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  if (offer.produto && offer.produto.sku) {
    html = html.replace(/(product_id:\s*')[^']*(')/, '$1' + offer.produto.sku + '$2');
  }
  const nomeCurto = offer.produto && (offer.produto.nomeCurto || offer.produto.titulo);
  if (nomeCurto) {
    html = html.replace(/(product_name:\s*")[^"]*(")/, '$1' + esc(nomeCurto) + '$2');
  }
  if (offer.preco && offer.preco.por != null) {
    html = html.replace(/(product_price:\s*)[\d.]+/, '$1' + Number(offer.preco.por));
  }
  /* sem marca conhecida fica VAZIO — senao o "Vonder" do template iria como
     brand de um capacete ou de um snow foam */
  html = html.replace(/(product_brand:\s*")[^"]*(")/, '$1' + esc((offer.produto && offer.produto.marca) || '') + '$2');
  const cats = offer.produto && offer.produto.categoria;
  const catFinal = Array.isArray(cats) ? cats[cats.length - 1] : cats;
  if (catFinal) {
    html = html.replace(/(product_category:\s*")[^"]*(")/, '$1' + esc(catFinal) + '$2');
  }

  /* Preco tambem esta cravado no HTML: sem reescrever, a pagina piscava
     com o valor da oferta principal ate a hidratacao rodar. Numa pagina
     de venda, um preco errado por meio segundo e caro. */
  if (offer.preco && offer.preco.por != null) {
    const de = Number(offer.preco.de || 0), por = Number(offer.preco.por);
    const sup = n => { const [i, d] = Number(n).toFixed(2).split('.');
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',<sup>' + d + '</sup>'; };
    const plano = n => { const [i, d] = Number(n).toFixed(2).split('.');
      return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d; };
    const selo = offer.preco.off || (Math.round((1 - por / de) * 100) + '% OFF');

    html = html.replace(/(<p class="price__old"><span class="sr">Preço antigo: <\/span>R\$ )[\d.]+,<sup>\d+<\/sup>/,
                        '$1' + sup(de));
    html = html.replace(/(<span class="amount">R\$ )[\d.]+,<sup>\d+<\/sup>/g, '$1' + sup(por));
    html = html.replace(/(<span class="price__off">)[^<]*/, '$1' + selo);
    html = html.replace(/(<span class="off">)[^<]*/g, '$1' + selo);
    html = html.replace(/(data-pix=")[\d.]+(")/g, '$1' + por.toFixed(2) + '$2');
    html = html.replace(/(<span class="buy-opt__old"><span class="sr">Preço antigo: <\/span>R\$ )[\d.,]+/g,
                        '$1' + plano(de));
    const parc = offer.preco.parcelas || 12;
    const vparc = offer.preco.parcelaValor || (por / parc);
    html = html.replace(/<p class="price__unit">[^<]*<\/p>/,
      '<p class="price__unit">ou em ' + parc + 'x de R$ ' + plano(vparc) + ' sem juros no cartão</p>');
    html = html.replace(/(<span class="buy-opt__inst">)\d+x R\$ [\d.,]+/, '$1' + parc + 'x R$ ' + plano(vparc));
  }

  const dir = path.join(ROOT, 'p', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  return { slug, titulo: offer.produto.titulo, cards: (offer.relacionados || []).length };
}

const slugs = pages.slugs();
console.log('Gerando ' + slugs.length + ' paginas de produto...\n');
slugs.map(gerar).forEach(r =>
  console.log('  p/' + r.slug + '/'.padEnd(Math.max(1, 34 - r.slug.length))
    + r.cards + ' relacionados  ' + r.titulo.slice(0, 42)));
if (SITE_URL) {
  let home = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  home = home.replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + SITE_URL + '/$2');
  home = home.replace(/<meta property="og:url" content="[^"]*">\n?/, '')
             .replace('<link rel="canonical"', '<meta property="og:url" content="' + SITE_URL + '/">\n  <link rel="canonical"');
  home = home.replace(/(<meta (?:property="og:image"|name="twitter:image")\s+content=")([^"]*)(")/g, (m, a, u, z) => a + abs(u) + z);
  home = home.replace(/("image": \[")([^"]*)("\])/, (m, a, u, z) => a + abs(u) + z);
  home = home.replace(/("url": ")\/(",)/, '$1' + SITE_URL + '/$2');
  fs.writeFileSync(path.join(ROOT, 'index.html'), home);
  console.log('index.html: canonical, og:url, og:image e JSON-LD absolutos em ' + SITE_URL);
}
console.log('\nPronto. Abra a loja e clique em qualquer produto relacionado.');
