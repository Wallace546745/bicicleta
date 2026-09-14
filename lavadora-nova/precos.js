#!/usr/bin/env node
/* ============================================================
   PREÇOS — edite só a tabela abaixo e rode:

       node precos.js

   O script atualiza todos os lugares onde cada preço aparece:
   index.html, app.js, nerva/content.js e nerva/pages.js, e
   regenera as páginas de produto.

   Formato:  [ 'chave', de, por ]
     de   = preço riscado (o "de R$")
     por  = preço à vista, o que o cliente paga no Pix
   O selo de desconto é recalculado sozinho.
   ============================================================ */
'use strict';

const PRECOS = {
  // ---------- PRODUTO PRINCIPAL ----------
  principal: { de: 416.30, por: 67.88, parcelas: 12, parcelaValor: 7.49,
               parcelado: 89.90 },   // preço em "outros meios", na buybox

  // ---------- PRODUTOS RELACIONADOS ----------
  // a chave é o slug da página /p/<slug>/
  'snow-foam-500ml':              { de:  59.90, por:  19.90 },
  'kit-vonixx-vexus':             { de: 129.90, por:  27.90 },
  'kit-lavadora-aspirador-vonder':{ de:1099.00, por: 127.00 },
  'mangueira-trama-aco-wap':      { de: 279.00, por:  32.90 },
  'mangueira-jardim-tramontina':  { de: 249.90, por:    29.90 },
  'extensao-eletrica-10m':        { de: 119.90, por:  79.90 },
  'kit-multi-ferramentas-48v':    { de: 799.00, por:    59.00 },
  'kit-ferramentas-46-pecas':     { de: 149.90, por:     39.90 },
  'serra-marmore-makita':         { de: 749.00, por:    23.10 },
  'inversora-solda-mig-130a':     { de: 899.00, por:    97.76 },
  'capacete-norisk-razor':        { de: 349.00, por:    59.30 },
  'capacete-norisk-ff302-grand-prix': { de: 649.00, por:    69.70 },
  'fone-bluetooth-capacete':      { de: 199.90, por:    12.90 },

  // ---------- OFERTA DE SAÍDA ----------
  // popup de quem tenta fechar a página. Deve ser MENOR que o "por" principal.
  /* Oferta de saída. Pode ser MENOR que o preço principal (desconto) ou
     MAIOR (combo com brindes, como está agora: 3 brindes por R$ 99,70). */
  ofertaSaida: {
    por: 99.70,
    // produtos que entram de brinde — o riscado é a soma de tudo
    brindes: ['snow-foam-500ml', 'kit-lavadora-aspirador-vonder', 'kit-vonixx-vexus'],
  },
};

/* ============================================================
   Daqui para baixo é a mecânica. Não precisa mexer.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

const brl = n => {
  const [i, d] = Number(n).toFixed(2).split('.');
  return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d;
};
const off = (de, por) => Math.round((1 - por / de) * 100) + '% OFF';
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/* Os titulos variam entre card, pagina e order bump: um tem ", Verde" no
   fim, outro nao. Comparar caractere a caractere falhava. */
const norm = s => String(s).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
function slugDoTitulo(titulo, mapa) {
  const n = norm(titulo);
  if (mapa[titulo]) return mapa[titulo];
  let melhor = null, tam = 0;
  Object.entries(mapa).forEach(([t, slug]) => {
    const m = norm(t);
    if ((n.startsWith(m) || m.startsWith(n)) && m.length > tam) { melhor = slug; tam = m.length; }
  });
  return melhor;
}

const ler = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const gravar = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

const avisos = [];
let trocas = 0;

/* Testa se a regex CASOU, e não se o texto mudou: quando o preço já está
   correto a substituição devolve o mesmo texto, e comparar strings daria
   um falso "não encontrei". */
function sub(texto, regex, novo, rotulo) {
  const re = new RegExp(regex.source, regex.flags.replace('g', ''));
  if (!re.test(texto)) { avisos.push(rotulo); return texto; }
  trocas++;
  return texto.replace(regex, novo);
}

// ---------- validação antes de escrever ----------
Object.entries(PRECOS).forEach(([k, v]) => {
  if (k === 'ofertaSaida') return;
  if (v.por >= v.de) avisos.push(`${k}: o "por" (${v.por}) não é menor que o "de" (${v.de})`);
  if (v.por < 1) avisos.push(`${k}: preço abaixo de R$ 1,00 — a Nerva recusa`);
});
if (PRECOS.ofertaSaida.por < 1) {
  avisos.push('ofertaSaida: abaixo de R$ 1,00 — a Nerva recusa');
}

const P = PRECOS.principal;
const OFF = off(P.de, P.por);

// ================= index.html =================
let h = ler('index.html');
const [pInt, pDec] = P.por.toFixed(2).split('.');
const [dInt, dDec] = P.de.toFixed(2).split('.');
const [xInt, xDec] = P.parcelado.toFixed(2).split('.');
const m = n => n.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

h = sub(h, /(<p class="price__old"><span class="sr">Preço antigo: <\/span>R\$ )[\d.]+,<sup>\d+<\/sup>/,
        `$1${m(dInt)},<sup>${dDec}</sup>`, 'index: preço antigo');
h = sub(h, /(<span class="amount">R\$ )[\d.]+,<sup>\d+<\/sup>(<\/span>\s*<span class="price__off">)[^<]*/,
        `$1${m(pInt)},<sup>${pDec}</sup>$2${OFF}`, 'index: preço atual e selo');
h = sub(h, /<p class="price__unit">[^<]*<\/p>/,
        `<p class="price__unit">ou R$ ${brl(P.parcelado)} em outros meios, em ${P.parcelas}x de R$ ${brl(P.parcelaValor)} sem juros</p>`,
        'index: parcelamento');
// buybox: opção parcelada
h = sub(h, /(<div class="buy-opt" data-pix=")[\d.]+(")/, `$1${P.parcelado.toFixed(2)}$2`, 'index: data-pix parcelado');
h = sub(h, /(<div class="buy-opt" data-pix="[\d.]+">[\s\S]{0,400}?<span class="amount">R\$ )[\d.]+,<sup>\d+<\/sup>/,
        `$1${m(xInt)},<sup>${xDec}</sup>`, 'index: valor parcelado');
h = sub(h, /(<span class="buy-opt__inst">)\d+x R\$ [\d.,]+/,
        `$1${P.parcelas}x R$ ${brl(P.parcelaValor)}`, 'index: linha de parcelas');
// buybox: melhor preço
h = sub(h, /(<div class="buy-opt is-sel" data-pix=")[\d.]+(")/, `$1${P.por.toFixed(2)}$2`, 'index: data-pix à vista');
h = sub(h, /(<div class="buy-opt is-sel"[\s\S]{0,400}?<span class="amount">R\$ )[\d.]+,<sup>\d+<\/sup>/,
        `$1${m(pInt)},<sup>${pDec}</sup>`, 'index: valor à vista');
h = h.replace(/(<span class="buy-opt__old"><span class="sr">Preço antigo: <\/span>R\$ )[\d.,]+/g,
              `$1${brl(P.de)}`);
h = h.replace(/(<span class="off">)\d+% OFF/g, `$1${OFF}`);
h = sub(h, /("price": ")[\d.]+(")/, `$1${P.por.toFixed(2)}$2`, 'index: schema price');
h = sub(h, /(product_price: )[\d.]+/, `$1${P.por.toFixed(2)}`, 'index: pixel TikTok');
/* O riscado da oferta de saída é o combo inteiro: produto + brindes.
   Antes mostrava só o preço do produto, o que dava "de R$ 67,88 por
   R$ 99,70" — mais caro que o riscado. */
const valorCombo = P.por + (PRECOS.ofertaSaida.brindes || [])
  .reduce((soma, slug) => soma + ((PRECOS[slug] || {}).por || 0), 0);
h = sub(h, /(<p class="bo-offer__old">de R\$ )[\d.,]+/, `$1${brl(valorCombo)}`, 'index: oferta de saída (de)');
h = sub(h, /(<p class="bo-offer__price">R\$ )[\d.,]+/, `$1${brl(PRECOS.ofertaSaida.por)}`, 'index: oferta de saída (por)');
gravar('index.html', h);

// ================= app.js =================
let a = ler('app.js');
a = sub(a, /(const OLD_UNIT = )[\d.]+/, `$1${P.de.toFixed(2)}`, 'app: OLD_UNIT');
a = sub(a, /(\|\| )[\d.]+(\);\s*\/\/ preco final|\);)/, `$1${PRECOS.ofertaSaida.por.toFixed(2)}$2`, 'app: oferta de saída');
Object.entries(PRECOS).forEach(([slug, v]) => {
  if (slug === 'principal' || slug === 'ofertaSaida') return;
  const re = new RegExp(`(url: '${esc('p/' + slug + '/')}'[^}]*?p: ')[\\d.,]+(', old: ')[\\d.,]+(', off: ')[^']+`, 'g');
  if (!new RegExp(re.source).test(a)) { avisos.push(`app: ${slug}`); return; }
  a = a.replace(re, `$1${brl(v.por)}$2${brl(v.de)}$3${off(v.de, v.por)}`);
  trocas++;
});
gravar('app.js', a);

// ================= nerva/content.js =================
let c = ler('nerva/content.js');
c = sub(c, /(de: )[\d.]+(,\s*\n\s*por: )[\d.]+(,\s*\n\s*off: ')[^']+/,
        `$1${P.de}$2${P.por}$3${OFF}`, 'content: preço principal');
c = sub(c, /(parcelas: )\d+(,\s*\n\s*parcelaValor: )[\d.]+/, `$1${P.parcelas}$2${P.parcelaValor}`, 'content: parcelas');
c = sub(c, /(preco: )[\d.]+(,\s*\n\s*brindeTitulo)/, `$1${PRECOS.ofertaSaida.por}$2`, 'content: oferta de saída');
gravar('nerva/content.js', c);

// ================= nerva/pages.js =================
let g = ler('nerva/pages.js');
Object.entries(PRECOS).forEach(([slug, v]) => {
  if (slug === 'principal' || slug === 'ofertaSaida') return;
  const re = new RegExp(`(slug: '${esc(slug)}'[\\s\\S]*?preco: \\{ de: )[\\d.]+(, por: )[\\d.]+(, off: ')[^']+`);
  if (!re.test(g)) { avisos.push(`pages: ${slug}`); return; }
  g = g.replace(re, `$1${v.de}$2${v.por}$3${off(v.de, v.por)}`);
  trocas++;
});
gravar('nerva/pages.js', g);

// ================= relacionados no content.js =================
// casados pelo título do card em pages.js -> preço do slug
/* O mesmo produto aparece com titulos diferentes: o card usa o curto
   ("Mangueira Jardim ... 30 m Tramontina Verde") e o order bump usa o da
   pagina ("Mangueira de Jardim ... 30 Metros — Tramontina"). Casar so
   pelo card deixava o order bump com o preco velho. */
const titulos = {};
const blocos = g.split(/\n  \{\n    slug: '/).slice(1);
blocos.forEach(bl => {
  const slug = (bl.match(/^([a-z0-9-]+)'/) || [])[1];
  if (!slug) return;
  const capt = re => [...bl.matchAll(re)].map(x => x[1].replace(/\\'/g, "'"));
  [...capt(/card: \{ t: '((?:[^'\\]|\\.)*)'/g),
   ...capt(/titulo: '((?:[^'\\]|\\.)*)'/g),
   ...capt(/nomeCurto: '((?:[^'\\]|\\.)*)'/g)]
    .forEach(t => { if (t) titulos[t] = slug; });
});
c = ler('nerva/content.js');
Object.entries(titulos).forEach(([titulo, slug]) => {
  const v = PRECOS[slug];
  if (!v) return;
  const re = new RegExp(`(\\{ t: '${esc(titulo.replace(/'/g, "\\'"))}', p: )[\\d.]+(, old: )[\\d.]+(, off: ')[^']+`);
  if (re.test(c)) { c = c.replace(re, `$1${v.por}$2${v.de}$3${off(v.de, v.por)}`); trocas++; }
});
gravar('nerva/content.js', c);

// ================= order bump e brindes =================
/* O order bump oferece produtos do proprio catalogo. Sem atualizar aqui,
   o card mostrava um preco e o popup de finalizacao cobrava outro. */
c = ler('nerva/content.js');
let g2 = ler('nerva/pages.js');
[c, g2].forEach(() => {});
const trocaBump = txt => txt.replace(/\{ t: '((?:[^'\\]|\\.)*)', p: ([\d.]+), old: ([\d.]+)/g,
  (todo, titulo, pAtual, oldAtual) => {
    const slug = slugDoTitulo(titulo.replace(/\\'/g, "'"), titulos);
    const v = slug && PRECOS[slug];
    if (!v) { avisos.push('order bump sem preco: ' + titulo.slice(0, 40)); return todo; }
    trocas++;
    return `{ t: '${titulo}', p: ${v.por}, old: ${v.de}`;
  });
c  = trocaBump(c);
g2 = trocaBump(g2);
gravar('nerva/content.js', c);
gravar('nerva/pages.js', g2);

/* index.html tem os 3 itens do order bump cravados no HTML */
h = ler('index.html');
h = h.replace(/(data-price=")[\d.]+("\s+data-title=")([^"]+)(")/g, (todo, a, b, titulo, d) => {
  const slug = slugDoTitulo(titulo, titulos); const v = slug && PRECOS[slug];
  if (!v) return todo;
  trocas++; return a + v.por.toFixed(2) + b + titulo + d;
});
h = h.replace(/(<p class="ob-item__name">)([^<]+)(<\/p>\s*<p class="ob-item__price">)[\s\S]*?(<\/p>)/g,
  (todo, a, titulo, b, d) => {
    const slug = slugDoTitulo(titulo, titulos); const v = slug && PRECOS[slug];
    if (!v) return todo;
    trocas++;
    return a + titulo + b + `<s style="font-weight:400;font-size:13px;color:#999;">R$ ${brl(v.de)}</s> R$ ${brl(v.por)}` + d;
  });
gravar('index.html', h);

// ---------- relatório ----------
console.log('\n\x1b[36mPreços atualizados\x1b[0m');
console.log('─'.repeat(52));
console.log('  principal:  R$ ' + brl(P.de) + '  →  R$ ' + brl(P.por) + '   ' + OFF);
console.log('  parcelado:  R$ ' + brl(P.parcelado) + ' em ' + P.parcelas + 'x de R$ ' + brl(P.parcelaValor));
console.log('  saída:      R$ ' + brl(PRECOS.ofertaSaida.por));
console.log('');
Object.entries(PRECOS).forEach(([slug, v]) => {
  if (slug === 'principal' || slug === 'ofertaSaida') return;
  console.log('  ' + slug.padEnd(34) + 'R$ ' + brl(v.de).padStart(9) + '  →  R$ ' + brl(v.por).padStart(9) + '   ' + off(v.de, v.por));
});
console.log('─'.repeat(52));
console.log(trocas + ' substituições');

if (avisos.length) {
  console.log('\n\x1b[33mNão encontrei (confira se o texto mudou):\x1b[0m');
  avisos.forEach(x => console.log('  - ' + x));
}

// regenera as páginas de produto
try {
  require('child_process').execSync('node gerar-paginas.js', { cwd: ROOT, stdio: 'ignore' });
  console.log('\nPáginas de produto regeradas.');
} catch (e) {
  console.log('\n\x1b[33mRode manualmente: node gerar-paginas.js\x1b[0m');
}
console.log('');
