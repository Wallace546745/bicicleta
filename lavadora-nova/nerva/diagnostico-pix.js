#!/usr/bin/env node
/* ============================================================
   Descobre por que o PIX não está sendo gerado.

     cd nerva
     node diagnostico-pix.js

   Testa a cadeia inteira e para no primeiro elo quebrado,
   mostrando a resposta CRUA da Nerva quando for o caso.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const v = s => '\x1b[32m' + s + '\x1b[0m';
const r = s => '\x1b[31m' + s + '\x1b[0m';
const a = s => '\x1b[33m' + s + '\x1b[0m';
const c = s => '\x1b[36m' + s + '\x1b[0m';
const linha = () => console.log('─'.repeat(56));

function parar(titulo, causa, solucao) {
  console.log('\n' + r('PAREI AQUI: ') + titulo);
  console.log('\n  causa   : ' + causa);
  console.log('  solução : ' + solucao + '\n');
  process.exit(1);
}

(async () => {
  console.log('\n' + c('Diagnóstico — geração do PIX'));
  linha();

  // ---------- 1. .env ----------
  const ENV = path.join(__dirname, '.env');
  if (!fs.existsSync(ENV)) {
    parar('não achei o nerva/.env',
      'o arquivo não existe nesta pasta',
      'renomeie o env-domusferramentas.txt para .env e ponha em nerva/');
  }
  console.log(v('ok') + '   .env encontrado');

  require('./env').carregar();
  const KEY = process.env.NERVA_API_KEY || '';
  const BASE = (process.env.NERVA_BASE_URL || 'https://pixnerva.com.br/api').replace(/\/$/, '');
  const PORT = process.env.PORT || 3000;
  const PUB = process.env.PUBLIC_URL || '';

  if (!KEY || KEY.startsWith('COLE_AQUI') || KEY.includes('sua_chave')) {
    parar('NERVA_API_KEY não preenchida',
      'a linha ainda está com o texto de exemplo',
      'painel da Nerva > Integrações > API Keys > gere e cole no .env');
  }
  if (!/^sk_(live|test)_/.test(KEY)) {
    parar('NERVA_API_KEY com formato estranho',
      'a chave começa com "' + KEY.slice(0, 12) + '" e deveria começar com sk_live_',
      'copie a chave inteira, sem espaços nem aspas');
  }
  console.log(v('ok') + '   NERVA_API_KEY: ' + KEY.slice(0, 12) + '…' + KEY.slice(-4));

  // ---------- 2. a Nerva aceita a chave? ----------
  console.log('\n' + c('Falando com a Nerva'));
  let resp;
  try {
    resp = await fetch(BASE + '/withdrawals/balance', { headers: { 'x-api-key': KEY } });
  } catch (e) {
    parar('não alcancei ' + BASE,
      e.message,
      'o servidor tem internet? Está atrás de proxy ou firewall?');
  }
  if (resp.status === 401) {
    parar('a Nerva recusou a chave (401)',
      'chave revogada, expirada ou copiada pela metade',
      'gere uma nova no painel e cole inteira no .env');
  }
  if (resp.status === 403) {
    parar('sem permissão (403)',
      'a conta pode estar inativa ou pendente de aprovação',
      'confira o status da empresa no painel, ou fale com suporte@pixnerva.com.br');
  }
  if (!resp.ok) {
    parar('a Nerva respondeu ' + resp.status,
      (await resp.text()).slice(0, 160),
      'se persistir, contate suporte@pixnerva.com.br');
  }
  const saldo = (await resp.json()).data || {};
  console.log(v('ok') + '   chave aceita — saldo R$ ' + ((saldo.available || 0) / 100).toFixed(2));

  // ---------- 3. criar uma cobrança de verdade ----------
  console.log('\n' + c('Criando uma cobrança de teste (R$ 1,00)'));
  const corpo = {
    amount: 1.00,
    description: 'Teste de diagnóstico — pode ignorar',
    expirationInSeconds: 300,
    customer: { document: '12345678909', name: 'Teste Diagnostico' },
    externalId: 'diagnostico-' + Date.now().toString(36)
  };
  if (PUB.startsWith('https://')) corpo.postbackUrl = PUB.replace(/\/$/, '') + '/webhooks/nerva';

  let rc;
  try {
    rc = await fetch(BASE + '/sales', {
      method: 'POST',
      headers: { 'x-api-key': KEY, 'Content-Type': 'application/json',
                 'idempotency-key': corpo.externalId },
      body: JSON.stringify(corpo)
    });
  } catch (e) {
    parar('falhou ao chamar POST /sales', e.message, 'problema de rede no servidor');
  }
  const txt = await rc.text();
  let venda = {};
  try { venda = JSON.parse(txt); } catch (_) {}

  if (!rc.ok) {
    console.log(r('   a Nerva recusou a cobrança (HTTP ' + rc.status + ')'));
    console.log('\n   resposta crua da Nerva:');
    console.log('   ' + txt.slice(0, 400));
    let dica = 'confira a mensagem acima';
    const msg = (venda.message || '').toLowerCase();
    if (rc.status === 400 && msg.includes('postback')) {
      dica = 'a PUBLIC_URL precisa ser https e pública. Está: ' + (PUB || '(vazia)');
    } else if (rc.status === 400 && msg.includes('document')) {
      dica = 'a Nerva recusou o CPF de teste — normal em algumas contas; tente com um CPF real';
    } else if (rc.status === 403) {
      dica = 'conta ainda não liberada para receber. Fale com o suporte da Nerva';
    } else if (rc.status === 422 || rc.status === 400) {
      dica = 'algum campo foi recusado. A mensagem acima diz qual';
    }
    parar('a cobrança não foi criada', venda.message || ('HTTP ' + rc.status), dica);
  }

  console.log(v('ok') + '   cobrança criada na Nerva');
  console.log('     id       : ' + venda.id);
  console.log('     status   : ' + venda.status);
  console.log('     valor    : R$ ' + venda.amount + '  (taxa R$ ' + venda.fee + ')');
  console.log('     código   : ' + String(venda.pixCode || '').slice(0, 44) + '…');
  console.log(venda.pixCode ? v('     tem código Pix — a integração FUNCIONA')
                            : r('     veio SEM código Pix — avise o suporte da Nerva'));

  // ---------- 4. o servidor local está no ar? ----------
  console.log('\n' + c('Servidor local'));
  let rl;
  try {
    rl = await fetch('http://127.0.0.1:' + PORT + '/api/pix/create', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 1, payerCpf: '12345678909', payerName: 'Teste' })
    });
  } catch (e) {
    console.log(a('aviso') + ' o servidor não está rodando na porta ' + PORT);
    console.log('        Noutro terminal: ' + c('node server.js'));
    console.log('\n' + v('A Nerva está OK.') + ' O elo que falta é o servidor no ar.\n');
    process.exit(0);
  }
  const tl = await rl.text();
  if (rl.ok) {
    console.log(v('ok') + '   /api/pix/create respondeu ' + rl.status);
    console.log('\n' + v('TUDO FUNCIONANDO.'));
    console.log('\nSe mesmo assim a loja não gera o PIX, o problema é o endereço');
    console.log('que a página usa para achar o backend. A loja precisa ser servida');
    console.log('PELO PRÓPRIO servidor Node — abra ' + c('http://127.0.0.1:' + PORT));
    console.log('e não o index.html direto nem pelo Live Server.\n');
  } else {
    console.log(r('FALHA') + ' /api/pix/create respondeu ' + rl.status);
    console.log('   ' + tl.slice(0, 300));
    console.log('\nA Nerva aceita, mas o seu servidor recusou. A mensagem acima diz o motivo.\n');
  }
})().catch(e => { console.log('\n' + r('erro inesperado: ') + e.message + '\n'); process.exit(1); });
