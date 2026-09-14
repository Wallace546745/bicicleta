/* Simula o funil inteiro contra o servidor real e confere se cada etapa
   aparece no painel. API Nerva simulada; nada de dado inventado no painel. */
'use strict';
const http = require('http');
const crypto = require('crypto');
const path = require('path');

const KEY = 'sk_live_teste', SECRET = 'whsec_teste', ADM = 'admin-teste';

const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const j = body ? JSON.parse(body) : {};
    const send = (c, o) => { res.writeHead(c, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.method === 'POST' && req.url === '/api/sales')
      return send(201, { id: 'venda-1', status: 'pending', amount: j.amount, fee: 24.63,
                         netAmount: j.amount - 24.63, pixCode: '00020101021226580014br...',
                         pixQrCode: 'x', transactionId: 'gw_1', externalId: j.externalId });
    if (req.method === 'GET' && req.url.startsWith('/api/sales/'))
      return send(200, { id: 'venda-1', status: 'paid', amount: 323.91, updatedAt: new Date().toISOString() });
    send(200, { data: {} });
  });
});

fake.listen(9600, async () => {
  Object.assign(process.env, {
    NERVA_BASE_URL: 'http://127.0.0.1:9600/api', NERVA_API_KEY: KEY,
    NERVA_WEBHOOK_SECRET: SECRET, ADMIN_TOKEN: ADM, PORT: '9601',
    DATA_DIR: '/tmp/monitor-teste-' + Date.now(), PUBLIC_URL: 'https://exemplo.com.br',
    /* vazio de propósito: o env.js só preenche o que está indefinido. Sem isto o
       teste pegava o token do .env real e mandava evento falso ao pixel de verdade. */
    TIKTOK_PIXEL_ID: '', TIKTOK_ACCESS_TOKEN: '', TIKTOK_TEST_EVENT_CODE: ''
  });
  process.chdir(path.join(__dirname, 'nerva'));
  require('./nerva/server.js');
  await new Promise(r => setTimeout(r, 1200));

  const B = 'http://127.0.0.1:9601';
  const T = '?token=' + ADM;
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ok    ' : '  FALHA ') + m); if (!c) falhas.push(m); };
  const jget = async u => (await fetch(B + u)).json();
  const ping = (sid, stage, extra) => fetch(B + '/api/funnel/ping', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'user-agent': 'Mozilla/5.0 (iPhone)' },
    body: JSON.stringify(Object.assign({ sid, stage }, extra || {}))
  });

  const SID = 'visitante-teste-1';

  // ---------- 1. visitante entra ----------
  console.log('\n1) VISITANTE ENTRA');
  await ping(SID, 'page_view', {
    utm: { utmSource: 'tiktok', utmCampaign: 'campanha01', ttclid: 'TTCLID-ABC123' },
    ref: 'https://www.tiktok.com/', landing: 'https://loja.com/?ttclid=TTCLID-ABC123'
  });
  await new Promise(r => setTimeout(r, 300));

  let on = await jget('/api/admin/metrics' + T);
  ok(on.online >= 1, 'online: ' + on.online);
  ok((on.onlineByStage || {}).page_view >= 1, 'na etapa "página do produto": ' + (on.onlineByStage || {}).page_view);

  // ---------- 2. percorre o funil ----------
  console.log('\n2) PERCORRE O FUNIL');
  for (const et of ['carrinho', 'order_bump', 'checkout_addr', 'checkout_dados', 'checkout_pgto']) {
    await ping(SID, et); await new Promise(r => setTimeout(r, 120));
  }
  let v = await jget('/api/admin/monitor/visitante/' + SID + T);
  const etapas = v.passos.map(p => p.etapa);
  ok(etapas.includes('entrou'), 'jornada registrou a entrada');
  ok(etapas.includes('checkout_pgto'), 'jornada registrou o checkout: ' + etapas.join(' → '));
  ok(v.ttclid === 'TTCLID-ABC123', 'ttclid guardado: ' + v.ttclid);
  ok(v.utm.utmCampaign === 'campanha01', 'utm_campaign: ' + v.utm.utmCampaign);
  ok(v.device === 'iOS', 'dispositivo: ' + v.device);
  ok(v.online === true, 'marcado como online');

  // ---------- 3. gera o Pix ----------
  console.log('\n3) GERA O PIX');
  const r = await fetch(B + '/api/pix/create', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 323.91, payerCpf: '12345678909', sid: SID,
                           description: 'Lavadora de Alta Pressão Vonder LAV 1300' })
  });
  const pix = await r.json();
  ok(!!pix.qrCode, 'Pix gerado');
  await new Promise(r2 => setTimeout(r2, 300));

  v = await jget('/api/admin/monitor/visitante/' + SID + T);
  ok(v.passos.some(p => p.etapa === 'pix_gerado'), 'jornada registrou o Pix gerado');
  ok(v.vendas.length === 1, 'venda ligada ao visitante: ' + v.vendas.length);

  let f = await jget('/api/admin/monitor/funil' + T + '&range=hoje');
  const n = c => (f.passos.find(p => p.chave === c) || {}).n;
  ok(n('visitantes') >= 1, 'funil · visitantes: ' + n('visitantes'));
  ok(n('checkout') >= 1, 'funil · iniciaram checkout: ' + n('checkout'));
  ok(n('pix_gerado') === 1, 'funil · geraram Pix: ' + n('pix_gerado'));
  ok(f.resumo.pixPendente === 1, 'Pix pendente: ' + f.resumo.pixPendente);

  // ---------- 4. webhook confirma o pagamento ----------
  console.log('\n4) WEBHOOK CONFIRMA O PAGAMENTO');
  const payload = JSON.stringify({ event: 'sale.paid',
    data: { id: 'venda-1', status: 'paid', amount: 323.91, paidAt: new Date().toISOString() } });
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', SECRET).update(ts + '.' + payload).digest('hex');
  const rw = await fetch(B + '/webhooks/nerva', { method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'x-pixnerva-timestamp': String(ts), 'x-pixnerva-signature': sig } });
  ok(rw.status === 200, 'webhook aceito');
  await new Promise(r2 => setTimeout(r2, 400));

  f = await jget('/api/admin/monitor/funil' + T + '&range=hoje');
  ok(n('pix_pago') === 1, 'funil · Pix pago: ' + n('pix_pago'));
  ok(f.resumo.faturamento === 323.91, 'faturamento: R$ ' + f.resumo.faturamento);
  ok(f.resumo.taxaAprovacao === 100, 'taxa de aprovação: ' + f.resumo.taxaAprovacao + '%');
  ok(f.resumo.ticketMedio === 323.91, 'ticket médio: R$ ' + f.resumo.ticketMedio);

  v = await jget('/api/admin/monitor/visitante/' + SID + T);
  ok(v.passos.some(p => p.etapa === 'pago'), 'jornada registrou o pagamento');
  ok(v.vendas[0].status === 'paid', 'venda do visitante marcada como paga');

  // ---------- 5. ranking de produtos ----------
  console.log('\n5) RANKING DE PRODUTOS');
  const pr = await jget('/api/admin/monitor/produtos' + T + '&range=hoje');
  const top = pr.lista[0];
  ok(top && top.produto.includes('Vonder'), 'produto: ' + (top && top.produto));
  ok(top && top.vendas === 1 && top.faturamento === 323.91,
     'vendas: ' + (top && top.vendas) + ' · faturamento: R$ ' + (top && top.faturamento));
  ok(top && top.taxaAprovacao === 100, 'aprovação do produto: ' + (top && top.taxaAprovacao) + '%');

  // ---------- 6. eventos do TikTok ----------
  console.log('\n6) EVENTOS DO TIKTOK');
  for (const ev of ['ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'])
    await fetch(B + '/api/track/pixel', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: ev, event_id: ev + '-1' }) });
  await new Promise(r2 => setTimeout(r2, 300));
  const tk = await jget('/api/admin/monitor/tiktok' + T + '&range=hoje');
  ok(tk.eventos.length >= 4, 'eventos registrados: ' + tk.eventos.map(e => e.evento).join(', '));
  ok(tk.compraOk === true, 'Purchase disparando: ' + tk.compraOk);
  ok(tk.ligado === false && !!tk.motivo, 'Events API desligada e o painel diz por quê: ' + tk.motivo);

  // ---------- 7. lista e filtros ----------
  console.log('\n7) LISTA DE VISITANTES E FILTROS');
  let lv = await jget('/api/admin/monitor/visitantes' + T + '&range=hoje');
  ok(lv.lista.length >= 1, 'visitantes listados: ' + lv.lista.length);
  ok(lv.lista[0].origem === 'tiktok', 'origem: ' + lv.lista[0].origem);
  lv = await jget('/api/admin/monitor/visitantes' + T + '&range=hoje&device=iOS');
  ok(lv.lista.length >= 1, 'filtro por dispositivo iOS: ' + lv.lista.length);
  lv = await jget('/api/admin/monitor/visitantes' + T + '&range=hoje&device=Android');
  ok(lv.lista.length === 0, 'filtro por Android devolve vazio (não há)');

  // ---------- 8. períodos ----------
  console.log('\n8) PERÍODOS');
  const ontem = await jget('/api/admin/monitor/funil' + T + '&range=ontem');
  ok(ontem.passos.find(p => p.chave === 'pix_pago').n === 0, 'ontem sem vendas (correto)');
  const sete = await jget('/api/admin/monitor/funil' + T + '&range=7d');
  ok(sete.passos.find(p => p.chave === 'pix_pago').n === 1, '7 dias inclui a venda de hoje');

  // ---------- 9. segurança ----------
  console.log('\n9) SEGURANÇA');
  ok((await fetch(B + '/api/admin/monitor/funil')).status === 401, 'sem token -> 401');
  ok((await fetch(B + '/api/admin/monitor/funil?token=errado')).status === 401, 'token errado -> 401');

  // ---------- 10. tempo real ----------
  console.log('\n10) TEMPO REAL (SSE)');
  const ctrl = new AbortController();
  const sse = await fetch(B + '/api/admin/monitor/stream' + T, { signal: ctrl.signal });
  ok(sse.headers.get('content-type').includes('text/event-stream'), 'stream aberto');
  const reader = sse.body.getReader();
  const primeiro = await reader.read();
  const txt = new TextDecoder().decode(primeiro.value);
  ok(txt.includes('retry:') || txt.includes('event: online'), 'servidor empurra evento sem o painel pedir');
  ctrl.abort();

  console.log('\n' + '='.repeat(54));
  console.log('falhas:', falhas.length);
  falhas.forEach(x => console.log('  -', x));
  process.exit(falhas.length ? 1 : 0);
});
