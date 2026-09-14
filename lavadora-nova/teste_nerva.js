/* Sobe o servidor contra uma API Nerva falsa e exercita o fluxo inteiro:
   criar cobrança, consultar status, webhook assinado, saldo e saque.   */
'use strict';
const http = require('http');
const crypto = require('crypto');
const path = require('path');

const KEY = 'sk_live_teste';
const SECRET = 'whsec_teste';
const recebido = [];

/* ---------- API Nerva falsa ---------- */
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const j = body ? JSON.parse(body) : {};
    recebido.push({ url: req.url, method: req.method, headers: req.headers, body: j });
    const send = (code, obj) => {
      res.writeHead(code, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    if (req.headers['x-api-key'] !== KEY) return send(401, { message: 'API Key inválida', statusCode: 401 });

    if (req.method === 'POST' && req.url === '/api/sales') {
      return send(201, {
        id: 'venda-uuid-1', status: 'pending', amount: j.amount,
        fee: +(j.amount * 0.0699 + 1.99).toFixed(2),
        netAmount: +(j.amount - (j.amount * 0.0699 + 1.99)).toFixed(2),
        pixCode: '00020101021226580014br.gov.bcb...',
        pixQrCode: 'https://pixnerva.com.br/api/qr/1',
        transactionId: 'gw_tx_abc123', externalId: j.externalId
      });
    }
    if (req.method === 'GET' && req.url.startsWith('/api/sales/')) {
      return send(200, { id: 'venda-uuid-1', status: 'paid', amount: 323.91, updatedAt: '2026-03-23T10:05:00Z' });
    }
    if (req.method === 'GET' && req.url === '/api/withdrawals/balance') {
      return send(200, { data: { available: 150000, withheld: 7500 } });
    }
    if (req.method === 'POST' && req.url === '/api/withdrawals') {
      return send(201, { id: 'saque-uuid-1', amount: j.amount, fee: 0, status: 'pending',
                         method: j.method, pixKeyType: j.pixKeyType, pixKey: j.pixKey, reference: j.reference });
    }
    if (req.method === 'GET' && req.url.startsWith('/api/withdrawals/my-withdrawals')) {
      return send(200, { data: [{ id: 'saque-uuid-1', amount: 500, status: 'completed' }], total: 1, page: 1, limit: 20 });
    }
    send(404, { message: 'Não encontrado', statusCode: 404 });
  });
});

fake.listen(9300, async () => {
  process.env.NERVA_BASE_URL = 'http://127.0.0.1:9300/api';
  process.env.NERVA_API_KEY = KEY;
  process.env.NERVA_WEBHOOK_SECRET = SECRET;
  process.env.ADMIN_TOKEN = 'admin-teste';
  process.env.PORT = '9301';
  process.env.DATA_DIR = '/tmp/nerva-teste';
  process.env.PUBLIC_URL = 'https://exemplo.com.br';
  process.env.ALLOWED_ORIGIN = 'https://exemplo.com.br';
  // vazio de propósito: sem isto o teste pegava o token do .env real e mandava
  // evento falso ao pixel de verdade (o env.js só preenche o que está indefinido)
  process.env.TIKTOK_PIXEL_ID = ''; process.env.TIKTOK_ACCESS_TOKEN = ''; process.env.TIKTOK_TEST_EVENT_CODE = '';

  process.chdir(path.join(__dirname, 'nerva'));
  require('./nerva/server.js');
  await new Promise(r => setTimeout(r, 1200));

  const B = 'http://127.0.0.1:9301';
  const falhas = [];
  const ok = (c, m) => { console.log((c ? '  ok    ' : '  FALHA ') + m); if (!c) falhas.push(m); };

  // 1. criar cobrança
  const r1 = await fetch(`${B}/api/pix/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 323.91, payerCpf: '12345678909', payerName: 'João Teste',
                           payerEmail: 'j@t.com', payerPhone: '11999999999' })
  });
  const d1 = await r1.json();
  console.log('\n1) CRIAR COBRANÇA');
  ok(r1.status === 200 || r1.status === 201, 'HTTP ' + r1.status);
  ok(!!d1.qrCode && d1.qrCode.startsWith('000201'), 'código Pix copia-e-cola devolvido');
  ok(!!d1.txid && !!d1.purchaseEventId, 'txid e purchaseEventId devolvidos');
  const req1 = recebido.find(x => x.url === '/api/sales');
  ok(req1 && req1.headers['x-api-key'] === KEY, 'API Key enviada no header');
  ok(req1 && !!req1.headers['idempotency-key'], 'idempotency-key enviada');
  ok(req1 && req1.body.customer.document === '12345678909', 'CPF só com dígitos');
  ok(req1 && req1.body.amount === 323.91, 'valor: ' + (req1 && req1.body.amount));
  ok(req1 && !!req1.body.externalId, 'externalId presente');
  ok(req1 && req1.body.postbackUrl === 'https://exemplo.com.br/webhooks/nerva', 'postbackUrl https');
  ok(req1 && req1.body.description === 'Lavadora de Alta Pressão Vonder LAV 1300',
     'descrição: ' + (req1 && req1.body.description));

  // 2. CPF inválido é barrado antes de chamar a API
  const antes = recebido.length;
  const r2 = await fetch(`${B}/api/pix/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 10, payerCpf: '123' })
  });
  console.log('\n2) VALIDAÇÃO');
  ok(r2.status === 400, 'CPF inválido -> HTTP ' + r2.status);
  ok(recebido.length === antes, 'não chamou a API com dado inválido');

  // 2b. teto de R$ 10.000
  const rMax = await fetch(`${B}/api/pix/create`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 15000, payerCpf: '12345678909' })
  });
  const dMax = await rMax.json();
  ok(rMax.status === 400, 'acima de R$ 10.000 -> HTTP ' + rMax.status);
  ok(/10\.000/.test(dMax.error || ''), 'mensagem clara: ' + (dMax.error || '').slice(0, 54));

  // 3. status
  const r3 = await fetch(`${B}/api/pix/status/venda-uuid-1`);
  const d3 = await r3.json();
  console.log('\n3) CONSULTAR STATUS');
  ok(d3.status === 'PAID', 'status: ' + d3.status);

  // 4. webhook — assinatura válida e inválida
  console.log('\n4) WEBHOOK');
  const payload = JSON.stringify({ event: 'sale.paid', data: { id: 'venda-uuid-1', status: 'paid', amount: 323.91 } });
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', SECRET).update(`${ts}.${payload}`).digest('hex');
  const rw = await fetch(`${B}/webhooks/nerva`, {
    method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'x-pixnerva-timestamp': String(ts), 'x-pixnerva-signature': sig }
  });
  ok(rw.status === 200, 'assinatura válida -> HTTP ' + rw.status);

  const rw2 = await fetch(`${B}/webhooks/nerva`, {
    method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'x-pixnerva-timestamp': String(ts), 'x-pixnerva-signature': 'f'.repeat(64) }
  });
  ok(rw2.status === 401, 'assinatura inválida -> HTTP ' + rw2.status);

  const velho = ts - 600;
  const sigVelho = crypto.createHmac('sha256', SECRET).update(`${velho}.${payload}`).digest('hex');
  const rw3 = await fetch(`${B}/webhooks/nerva`, {
    method: 'POST', body: payload,
    headers: { 'Content-Type': 'application/json', 'x-pixnerva-timestamp': String(velho), 'x-pixnerva-signature': sigVelho }
  });
  ok(rw3.status === 401, 'timestamp de 10 min -> HTTP ' + rw3.status + ' (replay bloqueado)');

  // estorno
  const pe = JSON.stringify({ event: 'sale.refunded', data: { id: 'venda-uuid-1', status: 'refunded', amount: 323.91 } });
  const ts2 = Math.floor(Date.now() / 1000);
  const sig2 = crypto.createHmac('sha256', SECRET).update(`${ts2}.${pe}`).digest('hex');
  const rw4 = await fetch(`${B}/webhooks/nerva`, {
    method: 'POST', body: pe,
    headers: { 'Content-Type': 'application/json', 'x-pixnerva-timestamp': String(ts2), 'x-pixnerva-signature': sig2 }
  });
  ok(rw4.status === 200, 'sale.refunded aceito -> HTTP ' + rw4.status);

  // 5. saldo e saque
  console.log('\n5) SALDO E SAQUE');
  const rs = await fetch(`${B}/api/admin/nerva/saldo?token=admin-teste`);
  const ds = await rs.json();
  ok(ds.disponivel === 1500, 'saldo em reais: R$ ' + ds.disponivel + ' (API devolve 150000 centavos)');
  ok(ds.retido === 75, 'retido: R$ ' + ds.retido);

  const rsn = await fetch(`${B}/api/admin/nerva/saldo`);
  ok(rsn.status === 401, 'sem token -> HTTP ' + rsn.status);

  const rq = await fetch(`${B}/api/admin/nerva/saques?token=admin-teste`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 500, pixKeyType: 'CPF', pixKey: '12345678909', reference: 'saque-1' })
  });
  const dq = await rq.json();
  ok(rq.status === 201, 'saque criado -> HTTP ' + rq.status);
  const reqSaque = recebido.find(x => x.url === '/api/withdrawals');
  ok(reqSaque && reqSaque.body.pixKeyType === 'cpf', 'pixKeyType normalizado para minúsculo');

  const rq2 = await fetch(`${B}/api/admin/nerva/saques?token=admin-teste`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 0.5, pixKeyType: 'cpf', pixKey: '1' })
  });
  ok(rq2.status === 400, 'saque abaixo de R$ 1,00 barrado -> HTTP ' + rq2.status);

  const rq3 = await fetch(`${B}/api/admin/nerva/saques?token=admin-teste`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount: 10, pixKeyType: 'chave_errada', pixKey: '1' })
  });
  ok(rq3.status === 400, 'pixKeyType inválido barrado -> HTTP ' + rq3.status);

  const rl = await fetch(`${B}/api/admin/nerva/saques?token=admin-teste`);
  ok(rl.status === 200, 'listar saques -> HTTP ' + rl.status);

  console.log('\n9) NADA OCULTO PELA WEB');
  for (const u of ['/.git/config', '/.git/HEAD', '/nerva/.env', '/.vercelignore', '/deploy/install-vps.sh', '/nerva/data/sales.json']) {
    const r = await fetch(B + u);
    ok(r.status === 404, u + ' -> HTTP ' + r.status);
  }
  ok((await fetch(B + '/p/snow-foam-500ml')).status === 200, '/p/snow-foam-500ml continua servindo -> 200');

  console.log('\n' + '='.repeat(52));
  console.log('falhas:', falhas.length);
  falhas.forEach(f => console.log('  -', f));
  process.exit(falhas.length ? 1 : 0);
});
