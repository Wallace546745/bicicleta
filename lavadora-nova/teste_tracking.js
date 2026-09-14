/* Sobe o servidor contra uma Nerva falsa E uma Events API do TikTok falsa, e
   confere o caminho inteiro do rastreamento server-side:
     • o HTML sai com o produto injetado (__TTK_PRODUTO__) para o ViewContent
       do <head> reportar o SKU/preço certos — na home e em /p/<slug>
     • um evento do navegador chega ao TikTok em milissegundos (não no tick)
     • event_time do navegador é respeitado; futuro/velho demais é corrigido
     • PlaceAnOrder e Purchase saem com os itens por SKU, o mesmo
       event_id do pixel, e-mail/telefone hasheados (telefone em E.164)
     • dedup por event_id                                                */
'use strict';
const http   = require('http');
const crypto = require('crypto');
const path   = require('path');
const fs     = require('fs');

const KEY = 'sk_live_teste', SECRET = 'whsec_teste';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const falhas = [];
const ok = (c, m) => { console.log((c ? '  ok    ' : '  FALHA ') + m); if (!c) falhas.push(m); };
const dormir = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Events API falsa ---------- */
const ttk = [];                                  // { t, body }
const fakeTikTok = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c);
  req.on('end', () => {
    const b = JSON.parse(body || '{}');
    ttk.push({ t: Date.now(), token: req.headers['access-token'], body: b });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    /* como o TikTok de verdade: um evento invalido no lote derruba o lote inteiro */
    if ((b.data || []).some(e => e.event === 'EventoRuim')) return res.end(JSON.stringify({ code: 40002, message: 'invalid event' }));
    res.end(JSON.stringify({ code: 0, message: 'OK' }));
  });
});
const eventos = () => ttk.flatMap(x => (x.body.data || []).map(e => Object.assign({ _t: x.t }, e)));
async function esperar(nome, ms = 1500) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) { const e = eventos().find(x => x.event === nome); if (e) return e; await dormir(20); }
  return null;
}

/* ---------- Nerva falsa (com estado por venda) ---------- */
const nervaEstado = {};                 // id -> { status, amount }
let nVendas = 8;
const fakeNerva = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c);
  req.on('end', () => {
    const j = body ? JSON.parse(body) : {};
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.headers['x-api-key'] !== KEY) return send(401, { message: 'API Key inválida' });
    if (req.method === 'POST' && req.url === '/api/sales') {
      const id = 'venda-uuid-' + (++nVendas);
      nervaEstado[id] = { status: 'pending', amount: j.amount };
      return send(201, { id, status: 'pending', amount: j.amount, pixCode: '000201...', pixQrCode: 'https://x/qr', transactionId: 'gw_1', externalId: j.externalId });
    }
    if (req.method === 'GET' && req.url.startsWith('/api/sales/')) {
      const id = decodeURIComponent(req.url.split('/').pop().split('?')[0]);
      const v = nervaEstado[id];
      if (!v) return send(404, { message: 'nao' });
      return send(200, { id, status: v.status, amount: v.amount, updatedAt: new Date().toISOString() });
    }
    if (req.method === 'GET' && req.url.startsWith('/api/sales')) return send(200, { data: [] });
    send(404, { message: 'nao' });
  });
});

fakeTikTok.listen(9400, () => fakeNerva.listen(9402, async () => {
  const DATA = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nerva-track-'));
  Object.assign(process.env, {
    NERVA_BASE_URL: 'http://127.0.0.1:9402/api', NERVA_API_KEY: KEY, NERVA_WEBHOOK_SECRET: SECRET,
    ADMIN_TOKEN: 'admin-teste', PORT: '9401', DATA_DIR: DATA,
    PUBLIC_URL: 'https://exemplo.com.br', ALLOWED_ORIGIN: 'https://exemplo.com.br',
    TIKTOK_PIXEL_ID: 'PIXEL_TESTE', TIKTOK_ACCESS_TOKEN: 'token-teste',
    TIKTOK_API_URL: 'http://127.0.0.1:9400/track/'
  });
  process.chdir(path.join(__dirname, 'nerva'));
  require('./nerva/server.js');
  await dormir(1000);
  const B = 'http://127.0.0.1:9401';
  const post = (url, obj) => fetch(B + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) });

  console.log('\n1) HTML COM O PRODUTO INJETADO (ViewContent do <head> certo)');
  const home = await (await fetch(B + '/')).text();
  const headHome = home.split('</head>')[0];
  ok(/window\.__TTK_PRODUTO__=\{"sku":"V9MAX-1000W","nome":"[^"]+","preco":189\.75,"marca":"Inow","categoria":"Bicicletas Elétricas/.test(headHome), 'home: __TTK_PRODUTO__ com SKU, preço, marca e categoria da oferta principal');
  ok(/window\.__PIXELS__=\{"meta":"[^"]*","tiktok":"PIXEL_TESTE"/.test(headHome), 'home: Pixel ID do painel injetado');
  ok(headHome.indexOf('TikTok Pixel Code Start') > 0 && headHome.indexOf('window.__TTK_PRODUTO__') < headHome.indexOf('TikTok Pixel Code Start'),
     'home: produto injetado ANTES da base do pixel, dentro do <head>');
  const pp = await (await fetch(B + '/p/snow-foam-500ml')).text();
  ok(/__TTK_PRODUTO__=\{"sku":"SNOWFOAM-500","nome":"[^"]+","preco":19\.9,"categoria":"Produtos de Limpeza"\}/.test(pp.split('</head>')[0]), '/p/snow-foam-500ml: produto daquela página (SNOWFOAM-500, R$ 19,90, sem marca inventada)');
  ok(/product_brand: ""/.test(pp), '/p/snow-foam-500ml: página estática sem brand inventado');

  console.log('\n2) EVENTO DO NAVEGADOR CHEGA NA HORA');
  const t0 = Date.now();
  await post('/api/track', { event: 'Search', event_id: 'search-1', query: 'lavadora vonder', event_time: t0 - 5000, external_id: 'u1', page_url: 'https://loja/x', locale: 'pt-BR' });
  const s = await esperar('Search');
  ok(!!s, 'Search entregue à Events API');
  if (s) {
    ok(s._t - t0 < 700, 'latência até o TikTok: ' + (s._t - t0) + ' ms (antes: até 2000 ms de tick)');
    ok(s.properties.search_string === 'lavadora vonder' && s.properties.query === undefined, 'busca vai como search_string (nome da Events API): ' + s.properties.search_string);
    ok(typeof s.page.url === 'string' && s.page.url.length > 0, 'page.url presente (obrigatorio)');
    ok(s.event_time === Math.floor((t0 - 5000) / 1000), 'event_time = instante do clique no navegador');
    ok(!!s.user.ip && !!s.user.user_agent, 'ip e user-agent preenchidos pelo servidor');
    ok(s.user.external_id === sha('u1'), 'external_id hasheado (SHA-256)');
    ok(s.page.url === 'https://loja/x', 'page.url repassada');
    ok(s.user.locale === 'pt-BR', 'user.locale repassado: ' + s.user.locale);
  }
  ok(ttk[0] && ttk[0].token === 'token-teste' && ttk[0].body.event_source_id === 'PIXEL_TESTE', 'Access-Token e event_source_id certos');

  await post('/api/track', { event: 'Lead', event_id: 'ld-1', description: 'Endereço preenchido', event_time: Date.now() + 3600e3 });
  const cb = await esperar('Lead');
  ok(cb && Math.abs(cb.event_time - Date.now() / 1000) < 5, 'event_time no futuro é corrigido para agora');
  ok(cb && cb.properties.description === 'Endereço preenchido', 'description do Lead repassada');

  console.log('\n2b) IP REAL ATRAS DE PROXY');
  await fetch(B + '/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '10.0.0.1' },
    body: JSON.stringify({ event: 'AddToWishlist', event_id: 'wl-1', value: 67.88 }) });
  const wl = await esperar('AddToWishlist');
  ok(wl && wl.user.ip === '203.0.113.9', 'cf-connecting-ip vence o x-forwarded-for: ' + (wl && wl.user.ip));

  console.log('\n2c) LOTE COM EVENTO INVALIDO NAO DERRUBA OS BONS');
  await Promise.all([
    post('/api/track', { event: 'EventoRuim', event_id: 'ruim-1' }),
    post('/api/track', { event: 'Contact', event_id: 'bom-1' })
  ]);
  const bom = await esperar('Contact', 3000);
  await dormir(200);
  const entregues = ttk.filter(x => x.body.data.length === 1 && x.body.data[0].event === 'Contact').length;
  ok(!!bom && entregues === 1, 'evento bom reenviado sozinho e entregue (' + entregues + 'x)');
  const st2 = await (await fetch(B + '/api/admin/tracking?token=admin-teste')).json();
  ok(st2.falhas === 1 && st2.fila === 0, 'so o invalido foi descartado (falhas=' + st2.falhas + ', fila=' + st2.fila + ')');

  console.log('\n3) DEDUP POR event_id');
  await post('/api/track', { event: 'AddToCart', event_id: 'atc-1', value: 67.88, contents: [{ content_id: 'V9MAX-1000W', price: 67.88, quantity: 1 }] });
  await post('/api/track', { event: 'AddToCart', event_id: 'atc-1', value: 67.88 });
  await esperar('AddToCart'); await dormir(300);
  ok(eventos().filter(e => e.event === 'AddToCart').length === 1, 'mesmo event_id 2x -> 1 evento entregue');

  console.log('\n4) PIX GERADO -> PlaceAnOrder com os itens do pedido');
  const itens = [
    { content_id: 'V9MAX-1000W', content_name: 'Lavadora', price: 67.88, quantity: 1, brand: "Inow", content_category: 'Lavadoras de Alta Pressão' },
    { content_id: 'SNOWFOAM-500',   content_name: 'Snow Foam', price: 19.9, quantity: 1 }
  ];
  const rc = await post('/api/pix/create', {
    value: 96.81, payerCpf: '12345678909', payerName: 'João', payerEmail: 'J@T.com', payerPhone: '(11) 99999-9999',
    description: 'Lavadora + Snow Foam', product_id: 'V9MAX-1000W', ttkContents: itens, locale: 'pt-BR',
    customer_type: 'new', ad: { utm_source: 'tiktok', utm_campaign: 'lavadora-01', campaign_id: '1234567890', creative_id: '__CID__' },
    tiktokClickId: 'TTCLID_X', ttp: 'ttp_x', ttkExternalId: 'u1', landingPageUrl: 'https://loja/?ttclid=TTCLID_X'
  });
  const dc = await rc.json();
  ok(rc.status === 200 && !!dc.purchaseEventId, 'HTTP ' + rc.status + ', purchaseEventId devolvido');
  const pao = await esperar('PlaceAnOrder');
  ok(!!pao, 'PlaceAnOrder entregue');
  if (pao) {
    ok(pao.event_id === 'pao-venda-uuid-9', 'event_id = pao-<txid> (o mesmo do pixel)');
    ok(pao.properties.contents.length === 2 && pao.properties.contents[1].content_id === 'SNOWFOAM-500', 'contents com os 2 SKUs do pedido');
    ok(pao.properties.contents[0].brand === 'Inow' && pao.properties.contents[0].content_category === 'Lavadoras de Alta Pressão', 'brand e content_category no item do catálogo');
    ok(JSON.stringify(pao.properties.content_ids) === '["V9MAX-1000W","SNOWFOAM-500"]' && pao.properties.num_items === 2, 'content_ids no topo (VSA) e num_items');
    ok(pao.properties.customer_type === 'new', 'customer_type = new na primeira compra');
    ok(pao.ad && pao.ad.utm_campaign === 'lavadora-01' && pao.ad.campaign_id === '1234567890' && pao.ad.creative_id === undefined, 'objeto ad: utm_campaign e campaign_id numerico; macro nao substituida ignorada');
    ok(typeof pao.page.url === 'string' && pao.page.url.startsWith('https://loja/'), 'page.url = URL da venda');
    ok(pao.user.locale === 'pt-BR' || pao.user.locale === undefined, 'locale no contexto da venda: ' + pao.user.locale);
    ok(pao.properties.value === 96.81 && pao.properties.order_id === 'venda-uuid-9', 'value do pedido e order_id');
    ok(pao.user.phone === sha('+5511999999999'), 'telefone hasheado em E.164 (+55)');
    ok(pao.user.email === sha('j@t.com'), 'e-mail hasheado em minúsculo');
    ok(pao.user.ttclid === 'TTCLID_X' && pao.user.ttp === 'ttp_x', 'ttclid e _ttp levados');
  }

  console.log('\n5) PAGO (webhook) -> Purchase do servidor');
  const PAGO_EM = new Date(Date.now() - 4000).toISOString();   // a Nerva confirmou 4 s atras
  const payload = JSON.stringify({ event: 'sale.paid', data: { id: 'venda-uuid-9', status: 'paid', amount: 96.81, paidAt: PAGO_EM } });
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');
  const t1 = Date.now();
  const rw = await fetch(B + '/webhooks/nerva', { method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'x-pixnerva-timestamp': String(ts), 'x-pixnerva-signature': sig } });
  ok(rw.status === 200, 'webhook aceito -> HTTP ' + rw.status);
  const cp = await esperar('Purchase');
  ok(!!cp, 'Purchase entregue');
  if (cp) {
    ok(cp._t - t1 < 300, 'latência webhook -> TikTok: ' + (cp._t - t1) + ' ms (sem esperar lote, disco ou push)');
    ok(cp.event_time === Math.floor(Date.parse(PAGO_EM) / 1000), 'event_time = hora em que a Nerva confirmou (paidAt), nao a hora do aviso');
    ok(cp.event_id === dc.purchaseEventId, 'event_id = purchaseEventId (dedup com o pixel)');
    ok(cp.properties.contents.length === 2, 'contents do pedido guardados no contexto e reaproveitados');
    ok(cp.properties.value === 96.81 && cp.properties.currency === 'BRL', 'value R$ 96,81 BRL');
    ok(cp.user.phone === sha('+5511999999999') && cp.user.email === sha('j@t.com'), 'match: e-mail e telefone');
    ok(cp.ad && cp.ad.campaign_id === '1234567890' && cp.properties.customer_type === 'new' && cp.properties.content_ids.length === 2, 'Purchase do servidor leva ad, customer_type e content_ids do contexto');
  }
  // webhook re-entregue não conta de novo
  await fetch(B + '/webhooks/nerva', { method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'x-pixnerva-timestamp': String(ts), 'x-pixnerva-signature': sig } });
  await dormir(300);
  ok(eventos().filter(e => e.event === 'Purchase').length === 1, 'webhook re-entregue -> ainda 1 Purchase');

  console.log('\n7) VIGIA: pagamento detectado SEM webhook e SEM o navegador');
  const rc2 = await post('/api/pix/create', {
    value: 67.88, payerCpf: '98765432100', payerName: 'Maria', payerEmail: 'm@t.com', payerPhone: '21988887777',
    description: 'Lavadora', product_id: 'V9MAX-1000W', ttkExternalId: 'u2'
  });
  const dc2 = await rc2.json();
  ok(rc2.status === 200 && dc2.txid === 'venda-uuid-10', 'segunda cobranca criada: ' + dc2.txid);
  nervaEstado[dc2.txid].status = 'paid';           // a pessoa pagou no app do banco, aba fechada
  const t2 = Date.now();
  const cp2 = await (async () => { const fim = Date.now() + 8000; while (Date.now() < fim) { const e = eventos().find(x => x.event === 'Purchase' && x.event_id === dc2.purchaseEventId); if (e) return e; await dormir(50); } return null; })();
  ok(!!cp2, 'Purchase saiu pelo vigia do servidor');
  if (cp2) ok(cp2._t - t2 < 4500, 'detectado em ' + (cp2._t - t2) + ' ms (antes: ate 4 min, na reconciliacao)');
  const lista = await (await fetch(B + '/api/admin/sales?token=admin-teste&status=paid')).json();
  ok(lista.rows.some(r => r.id === dc2.txid && r.status === 'paid'), 'painel ja mostra a venda como paga');
  // o front pergunta o status: resposta local, sem ir a Nerva (que aqui ja diria outra coisa)
  nervaEstado[dc2.txid].status = 'pending';
  const stLocal = await (await fetch(B + '/api/pix/status/' + dc2.txid)).json();
  ok(stLocal.status === 'PAID' && stLocal.purchaseEventId === dc2.purchaseEventId, 'GET /api/pix/status responde PAID do registro local, com o purchaseEventId');

  console.log('\n6) PAINEL');
  const st = await (await fetch(B + '/api/admin/tracking?token=admin-teste')).json();
  ok(st.ativo === true && st.fila === 0 && st.falhas === 1, 'fila vazia, 1 falha (o evento invalido de proposito), enviados: ' + st.enviados);
  const cps = eventos().filter(e => e.event === 'Purchase').length;
  ok(cps === 2, 'exatamente 2 Purchase no total (uma por venda paga): ' + cps);

  console.log('\n' + '='.repeat(52));
  console.log('falhas:', falhas.length);
  falhas.forEach(f => console.log('  -', f));
  process.exit(falhas.length ? 1 : 0);
}));
