#!/usr/bin/env node
/* ============================================================
   Testa o webhook de pagamento COM O SEU SECRET REAL.

     cd nerva
     node testar-webhook.js

   Simula o que a Nerva envia: monta o payload, assina com
   HMAC-SHA256 usando o seu NERVA_WEBHOOK_SECRET e dispara
   contra o seu servidor. Depois tenta forjar, para confirmar
   que a fraude é barrada.

   O secret sai do .env e nunca aparece na tela.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const v = s => '\x1b[32m' + s + '\x1b[0m';
const r = s => '\x1b[31m' + s + '\x1b[0m';
const a = s => '\x1b[33m' + s + '\x1b[0m';
const c = s => '\x1b[36m' + s + '\x1b[0m';

const falhas = [];
const ok = (cond, m) => { console.log('  ' + (cond ? v('ok') : r('FALHA')) + '    ' + m); if (!cond) falhas.push(m); };

// ---------- lê o .env ----------
const ENV = path.join(__dirname, '.env');
if (!fs.existsSync(ENV)) {
  console.log(r('\n.env não encontrado. Rode antes: ') + c('node configurar.js') + '\n');
  process.exit(1);
}
const env = {};
fs.readFileSync(ENV, 'utf8').split('\n').forEach(l => {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
});

const SECRET = env.NERVA_WEBHOOK_SECRET;
const PORT = env.PORT || 3000;
const ALVO = process.argv[2] || `http://127.0.0.1:${PORT}/webhooks/nerva`;

if (!SECRET || SECRET.includes('seu_secret')) {
  console.log(r('\nNERVA_WEBHOOK_SECRET não preenchido no .env.'));
  console.log('Pegue no painel da Nerva, aba Webhooks.\n');
  process.exit(1);
}

const assinar = (ts, corpo) =>
  crypto.createHmac('sha256', SECRET).update(ts + '.' + corpo).digest('hex');

async function enviar(corpo, ts, assinatura) {
  try {
    const resp = await fetch(ALVO, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-pixnerva-timestamp': String(ts),
        'x-pixnerva-signature': assinatura
      },
      body: corpo
    });
    let txt = '';
    try { txt = await resp.text(); } catch (_) {}
    return { status: resp.status, corpo: txt.slice(0, 90) };
  } catch (e) {
    return { erro: e.message };
  }
}

function venda(evento, extra = {}) {
  return JSON.stringify({
    event: evento,
    data: Object.assign({
      id: 'teste-' + Date.now().toString(36),
      status: evento.split('.')[1],
      amount: 67.88,
      fee: 6.73,
      netAmount: 61.15,
      payerName: 'Teste do Webhook',
      payerEmail: 'teste@exemplo.com',
      payerDocument: '12345678909',
      paymentMethod: 'PIX',
      transactionId: 'gw_tx_teste',
      externalId: 'lav1300-teste',
      endToEndId: 'E00000000202603231000teste',
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString()
    }, extra)
  });
}

(async () => {
  console.log('\n' + c('Teste do webhook de pagamento'));
  console.log('─'.repeat(52));
  console.log('  alvo   : ' + ALVO);
  console.log('  secret : ' + SECRET.slice(0, 9) + '…' + SECRET.slice(-4) + '  (do .env)');

  // ---------- 0. o servidor está no ar? ----------
  console.log('\n' + c('0. Servidor'));
  const ping = await enviar('{}', Math.floor(Date.now() / 1000), 'x');
  if (ping.erro) {
    console.log('  ' + r('FALHA') + '    não consegui alcançar ' + ALVO);
    console.log('           ' + ping.erro);
    console.log(a('\n  O servidor está rodando? Noutro terminal: ') + c('node server.js') + '\n');
    process.exit(1);
  }
  ok(true, 'servidor respondeu (HTTP ' + ping.status + ')');

  // ---------- 1. pagamento confirmado ----------
  console.log('\n' + c('1. Pagamento confirmado (sale.paid)'));
  const corpo = venda('sale.paid');
  const ts = Math.floor(Date.now() / 1000);
  const res1 = await enviar(corpo, ts, assinar(ts, corpo));
  ok(res1.status === 200, 'assinatura válida aceita -> HTTP ' + res1.status);
  if (res1.status === 401) {
    console.log(a('           O secret do .env não bate com o que o servidor carregou.'));
    console.log(a('           Reinicie o servidor depois de editar o .env.'));
  }

  // ---------- 2. tentativas de fraude ----------
  console.log('\n' + c('2. Tentativas de fraude — todas devem ser barradas'));
  const res2 = await enviar(corpo, ts, 'f'.repeat(64));
  ok(res2.status === 401, 'assinatura inventada -> HTTP ' + res2.status);

  const adulterado = corpo.replace('"amount":67.88', '"amount":9999');
  const res3 = await enviar(adulterado, ts, assinar(ts, corpo));
  ok(res3.status === 401, 'valor adulterado depois de assinar -> HTTP ' + res3.status);

  const velho = ts - 600;
  const res4 = await enviar(corpo, velho, assinar(velho, corpo));
  ok(res4.status === 401, 'webhook de 10 min atrás (replay) -> HTTP ' + res4.status);

  const res5 = await enviar(corpo, ts, '');
  ok(res5.status === 401, 'sem assinatura -> HTTP ' + res5.status);

  // ---------- 3. outros eventos ----------
  console.log('\n' + c('3. Outros eventos'));
  for (const ev of ['sale.expired', 'sale.refunded', 'sale.med_created', 'withdrawal.completed']) {
    const b = venda(ev);
    const t = Math.floor(Date.now() / 1000);
    const rr = await enviar(b, t, assinar(t, b));
    ok(rr.status === 200, ev + ' -> HTTP ' + rr.status);
  }

  console.log('\n' + '─'.repeat(52));
  if (falhas.length) {
    console.log(r('falhas: ' + falhas.length));
    falhas.forEach(f => console.log('  - ' + f));
    console.log('');
    process.exit(1);
  }
  console.log(v('Webhook funcionando.') + ' O servidor aceita a Nerva e recusa fraude.');
  console.log('\nFalta só cadastrar a URL no painel da Nerva, aba Webhooks:');
  console.log('  ' + c((env.PUBLIC_URL || 'https://SEU-DOMINIO') + '/webhooks/nerva') + '\n');
})();
