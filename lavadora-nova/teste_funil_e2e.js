// Navega a loja inteira (home + páginas de produto) em desktop e celular,
// registra erros de JS, requisições locais com falha, imagens quebradas,
// overflow horizontal, links internos mortos, e roda o fluxo de compra
// completo (comprar agora → order bump → checkout → Pix) e a compra direta.
/* Uso: BASE=https://v9maxoficial.com node teste_funil_e2e.js   (precisa do pacote playwright)
   Rodado pelo GitHub Actions ("Teste do funil na loja"), que salva as capturas de tela. */
const { chromium } = require('playwright');
const BASE = (process.env.BASE || process.argv[2] || 'http://localhost:3000').replace(/\/+$/, '');
const EXT = /facebook|tiktok|jsdelivr|google|gvt1|mlstatic|cloudinary|viacep|binlist|onrender/;
const fs = require('fs');
const S = (process.env.SAIDA || './capturas') + '/'; fs.mkdirSync(S, { recursive: true });
const PAGES = ['/', '/p/carregador-48v-2ah/', '/p/patinete-eletrico-gm5-p1/', '/p/bicicleta-eletrica-cavalletta-c2/',
  '/p/capacete-gta-start-led/', '/p/mini-compressor-rezzet/', '/p/caixa-de-som-jbl-boombox-4/'];
const out = [];
const log = (...a) => { const s = a.join(' '); out.push(s); console.log(s); };

async function auditPage(b, path, mobile) {
  const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' : undefined,
    isMobile: !!mobile, hasTouch: !!mobile });
  const p = await ctx.newPage();
  const errs = [], fails = [], cons = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !EXT.test(m.text())) cons.push(m.text().slice(0, 160)); });
  p.on('requestfailed', r => { if (!EXT.test(r.url())) fails.push(r.url().replace(BASE, '') + ' ' + (r.failure() || {}).errorText); });
  p.on('response', r => { if (r.status() >= 400 && !EXT.test(r.url())) fails.push(r.url().replace(BASE, '') + ' HTTP ' + r.status()); });
  const t0 = Date.now();
  await p.goto(BASE + path, { waitUntil: 'networkidle', timeout: 40000 }).catch(e => errs.push('goto: ' + e.message));
  const ms = Date.now() - t0;
  await p.waitForTimeout(800);
  const info = await p.evaluate(() => {
    const imgs = [...document.images].filter(i => i.getAttribute('src') && !/^data:/.test(i.src));
    const broken = imgs.filter(i => i.complete && i.naturalWidth === 0 && !/facebook|tiktok|mlstatic/.test(i.src)).map(i => i.getAttribute('src'));
    const noAlt = imgs.filter(i => !i.hasAttribute('alt')).length;
    const links = [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')).filter(h => h && !/^(#|http|mailto|tel|javascript)/.test(h));
    const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > document.documentElement.clientWidth + 2 && getComputedStyle(e).position !== 'fixed'; }).slice(0, 5).map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''));
    const title = document.title, h1 = (document.querySelector('h1') || {}).textContent || '';
    const price = (document.querySelector('.price__now .amount') || {}).textContent || '';
    const canon = (document.querySelector('link[rel=canonical]') || {}).href || '';
    const ogurl = (document.querySelector('meta[property="og:url"]') || {}).content || '';
    let ld = null; try { ld = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent); } catch (_) {}
    const ttk = window.TTK_CONFIG || {}, fb = (window.VONIXX_PIX || {}).pixelId;
    const cards = document.querySelectorAll('#relTrack li').length;
    const lav = /lavadora|vonder|lav ?1300/i.test(document.body.innerText) ? (document.body.innerText.match(/[^\n]*(lavadora|vonder|lav ?1300)[^\n]*/i) || [''])[0].trim().slice(0, 100) : '';
    return { base: document.baseURI, imgs: imgs.length, broken, noAlt, links: [...new Set(links)], overflow, wide, title, h1: h1.trim(), price: price.trim(), canon, ogurl,
      ld: ld && { name: ld.name, sku: ld.sku, price: ld.offers && ld.offers.price, brand: ld.brand && ld.brand.name, url: ld.url },
      ttk: { id: ttk.product_id, name: ttk.product_name, price: ttk.product_price, brand: ttk.product_brand, cat: ttk.product_category, pixel: ttk.pixelId }, fb, cards, lav };
  });
  // links internos existem?
  const dead = [];
  for (const h of info.links) {
    const u = new URL(h, info.base).href;   // respeita o <base href> das páginas de produto
    const r = await p.request.get(u).catch(() => null);
    if (!r || r.status() >= 400) dead.push(h + ' → ' + (r ? r.status() : 'erro'));
  }
  log(`\n### ${path} ${mobile ? '[celular 390px]' : '[desktop]'}  ${ms}ms`);
  log(`  title: ${info.title} | h1: ${info.h1.slice(0, 60)} | preço: ${info.price}`);
  log(`  pixel meta: ${info.fb} | ttk: ${info.ttk.pixel} sku=${info.ttk.id} nome=${String(info.ttk.name).slice(0, 30)} preço=${info.ttk.price} marca=${info.ttk.brand} cat=${info.ttk.cat}`);
  log(`  ld+json: ${JSON.stringify(info.ld)} | canonical: ${info.canon} | og:url: ${info.ogurl}`);
  log(`  imgs: ${info.imgs} (quebradas: ${info.broken.length}${info.broken.length ? ' → ' + info.broken.slice(0, 3).join(', ') : ''}, sem alt: ${info.noAlt}) | cards relacionados: ${info.cards}`);
  if (info.overflow) log(`  !! OVERFLOW horizontal: ${info.wide.join(', ')}`);
  if (info.lav) log(`  !! texto da lavadora visível: "${info.lav}"`);
  if (errs.length) log(`  !! erros JS: ${errs.join(' | ')}`);
  if (cons.length) log(`  !! console.error: ${[...new Set(cons)].join(' | ')}`);
  if (fails.length) log(`  !! requisições locais com falha: ${[...new Set(fails)].join(' | ')}`);
  if (dead.length) log(`  !! links mortos: ${dead.join(' | ')}`);
  if (mobile) await p.screenshot({ path: S + 'crawl-' + (path.replace(/[^a-z0-9]+/gi, '_') || 'home') + '-mobile.png', fullPage: false });
  await ctx.close();
}

const domClick = async (p, sel, msg) => { const ok = await p.$eval(sel, e => { e.click(); return true; }).catch(() => false); if (!ok && msg) log('  !! ' + msg); return ok; };
async function fluxoCompra(b) {
  log('\n### FLUXO DE COMPRA (home, desktop)');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const reqs = []; p.on('request', r => { if (/\/api\//.test(r.url())) reqs.push(r.method() + ' ' + r.url().replace(BASE, '')); });
  let pixResp = null; p.on('response', async r => { if (/\/api\/pix\/create/.test(r.url())) { try { pixResp = await r.json(); } catch (_) { pixResp = { erro: 'resposta não é JSON', status: r.status() }; } } });
  await p.goto(BASE + '/' + (process.env.QUERY || ''), { waitUntil: 'networkidle', timeout: 40000 });   // QUERY: ex. ?ttclid=… para testar o match
  await p.click('#buyNow', { force: true }); await p.waitForTimeout(500);
  log('  order bump aberto: ' + await p.$eval('#orderBumpModal', e => e.classList.contains('is-open')));
  await p.click('#obItem0', { force: true }); await p.click('#obConfirm', { force: true }); await p.waitForTimeout(2500);
  log('  checkout aberto: ' + await p.$eval('#checkout', e => !e.hidden) + ' | total: ' + await p.$eval('#sumTotal', e => e.textContent));
  // formulário: etapa 1 = CEP → endereço → contato; etapa 2 = pagamento; etapa 3 = revisão → Pix
  const fill = async (sel, v) => { try { await p.fill(sel, v, { timeout: 6000 }); } catch (e) { log('  !! não deu para preencher ' + sel + ': ' + String(e.message).split('\n')[0]); } };
  p.setDefaultTimeout(6000);
  await fill('#fCep', '01310100'); await p.waitForTimeout(1200);
  await fill('#fRua', 'Av Paulista'); await fill('#fNum', '1000'); await fill('#fBairro', 'Bela Vista'); await fill('#fCidade', 'São Paulo'); await fill('#fUf', 'SP');
  await p.waitForTimeout(400);
  await domClick(p, '#addrPhase1Btn').catch(() => log('  !! botão Continuar (fase 1) não encontrado')); await p.waitForTimeout(700);
  log('  frete visível após 1º Continuar: ' + await p.$eval('#shipSection', e => !e.hidden).catch(() => '?') + ' | frete escolhido: ' + await p.$eval('input[name="ship"]:checked', e => e.value).catch(() => 'nenhum') + ' | total: ' + await p.$eval('#sumTotal', e => e.textContent));
  await domClick(p, '#addrPhase1Btn').catch(() => {}); await p.waitForTimeout(700);
  log('  meli+ ofertado: ' + await p.$eval('#meliModal', e => e.classList.contains('is-open')).catch(() => '?'));
  await domClick(p, '#meliSkip', 'botão pular meli+ não encontrado'); await p.waitForTimeout(700);
  log('  contato visível: ' + await p.$eval('#addrPhase2', e => !e.hidden).catch(() => '?'));
  await fill('#fEmail', 'teste@exemplo.com'); await fill('#fFone', '11999998888'); await fill('#fNome', 'Teste Comprador'); await fill('#fCpf', '52998224725');
  await domClick(p, '.step[data-step="1"] button[type="submit"]', 'Continuar da etapa 1 não encontrado'); await p.waitForTimeout(900);
  log('  etapa 2 ativa: ' + await p.$eval('.step[data-step="2"]', e => e.classList.contains('is-active')));
  await domClick(p, '.step[data-step="2"] [data-continue="2"]', 'Continuar da etapa 2 não encontrado'); await p.waitForTimeout(900);
  log('  etapa 3 ativa: ' + await p.$eval('.step[data-step="3"]', e => e.classList.contains('is-active')) + ' | total revisão: ' + await p.$eval('#sumTotal', e => e.textContent));
  await domClick(p, '#ftBtn', 'botão confirmar (#ftBtn) não encontrado').catch(() => log('  !! botão confirmar (#ftBtn) não encontrado')); await p.waitForTimeout(4000);
  const qr = await p.$eval('#choQr img', e => e.naturalWidth > 0 || /^data:/.test(e.src)).catch(() => false);
  const code = await p.$eval('#pixCode', e => e.textContent.trim()).catch(() => '');
  log('  QR renderizado: ' + qr + ' | código pix: ' + (code ? code.slice(0, 20) + '…' : '(vazio)') + ' | cabeçalho: ' + await p.$eval('#doneHeading', e => e.textContent).catch(() => '?'));
  if (pixResp) {
    const r = pixResp;
    log('  resposta /api/pix/create: ok=' + r.ok + ' gateway=' + r.gateway + ' txid=' + r.txid + ' valor=' + r.valor + (r.error ? ' ERRO=' + r.error : '') + ' | código válido (BR Code): ' + /^000201/.test(r.qrCode || '') + ' | imagem QR: ' + !!r.base64QrCode);
    if (r.txid) {
      try { const st = await (await p.request.get(BASE + '/api/pix/status/' + r.txid)).json(); log('  status no gateway: ' + JSON.stringify(st)); }
      catch (e) { log('  !! status falhou: ' + e.message); }
    }
    if (!r.ok) log('  !! PIX NÃO GERADO');
  } else log('  !! nenhuma chamada a /api/pix/create foi vista');
  log('  chamadas de API: ' + [...new Set(reqs)].join(', '));
  if (errs.length) log('  !! erros JS: ' + errs.join(' | '));
  await p.screenshot({ path: S + 'crawl-checkout.png' });
  await ctx.close();
}

async function cliqueCard(b) {
  log('\n### CLIQUE EM CARD numa página de produto (base href)');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  await p.goto(BASE + '/p/carregador-48v-2ah/', { waitUntil: 'networkidle', timeout: 40000 });
  const card = await p.$('#relTrack li a[href*="patinete"], #relTrack li[data-url*="patinete"], #relTrack .pcard__title');
  if (!card) { log('  !! card não encontrado'); await ctx.close(); return; }
  await card.click({ force: true }); await p.waitForTimeout(2500);
  log('  foi para: ' + p.url().replace(BASE, '') + ' | h1: ' + await p.$eval('h1', e => e.textContent.trim().slice(0, 50)).catch(() => '?') + ' | status ok: ' + (await p.evaluate(() => document.title)).length + ' chars de title');
  await ctx.close();
}

async function compraDireta(b) {
  log('\n### COMPRA DIRETA de um card (home → capacete)');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 40000 });
  const btn = await p.$('#relTrack .pcard__buy[data-buy*="Capacete"]');
  if (!btn) { log('  !! botão comprar do card não encontrado'); await ctx.close(); return; }
  await btn.click({ force: true }); await p.waitForTimeout(2500);
  log('  total: ' + await p.$eval('#sumTotal', e => e.textContent) + ' (esperado R$ 19,90) | itens: ' + await p.$$eval('#cartItemsList > *', l => l.map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 50)).join(' | ')));
  if (errs.length) log('  !! erros JS: ' + errs.join(' | '));
  await ctx.close();
}

async function carrinho(b) {
  log('\n### CARRINHO (adicionar 2 produtos pelo ícone e finalizar)');
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 40000 });
  await p.click('#addCart', { force: true }); await p.waitForTimeout(800);
  log('  drawer abriu ao adicionar: ' + await p.$eval('#miniCart', e => !e.hidden).catch(() => '?'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  const carts = await p.$$('#relTrack .pcard__cart');
  if (carts[1]) { await carts[1].click({ force: true }); await p.waitForTimeout(800); } else log('  !! ícone de carrinho do card não encontrado');
  log('  badge do carrinho: ' + await p.$eval('#cartCountTop', e => e.textContent).catch(() => '?') + ' | drawer aberto: ' + await p.$eval('#miniCart', e => !e.hidden).catch(() => '?') + ' | itens no drawer: ' + await p.$$eval('#mcBody > *', l => l.length).catch(() => '?'));
  await p.click('#mcCheckout', { force: true }).catch(() => log('  !! botão finalizar do drawer não encontrado')); await p.waitForTimeout(600);
  await p.click('#obSkip', { force: true }).catch(() => {}); await p.waitForTimeout(2200);
  log('  total: ' + await p.$eval('#sumTotal', e => e.textContent) + ' | itens: ' + await p.$$eval('#cartItemsList > *', l => l.map(e => e.innerText.replace(/\s+/g, ' ').slice(0, 45)).join(' | ')));
  if (errs.length) log('  !! erros JS: ' + errs.join(' | '));
  await ctx.close();
}

(async () => {
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  if (!process.env.FLOWS_ONLY) { for (const path of PAGES) { await auditPage(b, path, false); } for (const path of PAGES) { await auditPage(b, path, true); } }
  await fluxoCompra(b); await cliqueCard(b); await compraDireta(b); await carrinho(b);
  await b.close();
  fs.writeFileSync(S + 'crawl-report.txt', out.join('\n'));
  const problemas = out.filter(l => l.includes('!!'));
  console.log('\n=== RESUMO: ' + (problemas.length ? problemas.length + ' problema(s) encontrado(s)' : 'nenhum problema encontrado') + ' ===');
  problemas.forEach(l => console.log(l));
  process.exit(problemas.length ? 1 : 0);
})();
