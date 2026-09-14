#!/usr/bin/env node
/* ============================================================
   Diagnóstico da integração com a Nerva.

     cd nerva
     node configurar.js

   Cria o .env se não existir, confere cada variável e testa a
   conexão real com a API. Não altera nada além do .env.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DIR = __dirname;
const ENV = path.join(DIR, '.env');
const EXEMPLO = path.join(DIR, '.env.example');

const v = s => '\x1b[32m' + s + '\x1b[0m';   // verde
const a = s => '\x1b[33m' + s + '\x1b[0m';   // amarelo
const r = s => '\x1b[31m' + s + '\x1b[0m';   // vermelho
const c = s => '\x1b[36m' + s + '\x1b[0m';   // ciano
const ok = m => console.log('  ' + v('ok') + '    ' + m);
const av = m => console.log('  ' + a('aviso') + ' ' + m);
const er = m => console.log('  ' + r('ERRO') + '  ' + m);

const problemas = [];
const avisos = [];

function lerEnv() {
  if (!fs.existsSync(ENV)) return null;
  const out = {};
  fs.readFileSync(ENV, 'utf8').split('\n').forEach(l => {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  });
  return out;
}

async function main() {
  console.log('\n' + c('Diagnóstico da integração Nerva') + '\n' + '─'.repeat(46) + '\n');

  // ---------- 1. arquivo .env ----------
  console.log(c('1. Arquivo .env'));
  if (!fs.existsSync(ENV)) {
    if (!fs.existsSync(EXEMPLO)) {
      er('.env.example não encontrado — você está na pasta nerva/?');
      return encerrar();
    }
    fs.copyFileSync(EXEMPLO, ENV);
    ok('.env criado a partir do .env.example');
    console.log('\n' + '─'.repeat(46));
    console.log(a('Agora preencha o arquivo ') + c('nerva/.env') + a(' com:'));
    console.log('  NERVA_API_KEY         painel → Integrações → API Keys');
    console.log('  NERVA_WEBHOOK_SECRET  painel → Webhooks');
    console.log('  PUBLIC_URL            a URL https do seu servidor');
    console.log('  ADMIN_TOKEN           uma senha forte que você inventa');
    console.log('\nDepois rode de novo: ' + c('node configurar.js') + '\n');
    process.exit(1);
  }
  ok('.env encontrado');

  const env = lerEnv();

  // ---------- 2. variáveis ----------
  console.log('\n' + c('2. Variáveis obrigatórias'));

  const chave = env.NERVA_API_KEY || '';
  if (!chave || chave.includes('sua_chave')) {
    er('NERVA_API_KEY não preenchida (painel → Integrações → API Keys)');
    problemas.push('NERVA_API_KEY');
  } else if (!chave.startsWith('sk_live_') && !chave.startsWith('sk_test_')) {
    er('NERVA_API_KEY não parece uma chave da Nerva (deve começar com sk_live_)');
    problemas.push('NERVA_API_KEY');
  } else {
    ok('NERVA_API_KEY: ' + chave.slice(0, 12) + '…' + chave.slice(-4));
  }

  const segredo = env.NERVA_WEBHOOK_SECRET || '';
  if (!segredo || segredo.includes('seu_secret')) {
    er('NERVA_WEBHOOK_SECRET não preenchido (painel → Webhooks)');
    problemas.push('NERVA_WEBHOOK_SECRET');
  } else {
    ok('NERVA_WEBHOOK_SECRET: ' + segredo.slice(0, 8) + '…');
  }

  const pub = env.PUBLIC_URL || '';
  if (!pub) {
    av('PUBLIC_URL vazia — o webhook não será registrado por cobrança.');
    av('  A confirmação de pagamento vai depender só do polling (uns segundos a mais).');
    av('  Para testar local, use um túnel: ' + c('ngrok http ' + (env.PORT || 3000)));
    avisos.push('PUBLIC_URL');
  } else if (!pub.startsWith('https://')) {
    er('PUBLIC_URL precisa ser https — a Nerva bloqueia http, IP privado e localhost');
    problemas.push('PUBLIC_URL');
  } else if (/localhost|127\.0\.0\.1|192\.168\.|10\.\d+\./.test(pub)) {
    er('PUBLIC_URL aponta para endereço local — a Nerva não consegue alcançar');
    problemas.push('PUBLIC_URL');
  } else {
    ok('PUBLIC_URL: ' + pub);
    ok('  webhook a cadastrar no painel: ' + c(pub.replace(/\/$/, '') + '/webhooks/nerva'));
  }

  const admin = env.ADMIN_TOKEN || '';
  if (!admin || admin.includes('troque_por')) {
    er('ADMIN_TOKEN não definido — o painel e as rotas de saque ficam inacessíveis');
    problemas.push('ADMIN_TOKEN');
  } else if (admin.length < 16) {
    av('ADMIN_TOKEN curto (' + admin.length + ' caracteres). Gere um forte: ' + c('openssl rand -hex 32'));
    avisos.push('ADMIN_TOKEN');
  } else {
    ok('ADMIN_TOKEN definido (' + admin.length + ' caracteres)');
  }

  const origem = env.ALLOWED_ORIGIN || '';
  if (!origem || origem.includes('suaoferta')) {
    av('ALLOWED_ORIGIN ainda é o valor de exemplo — ponha o domínio da sua loja');
    avisos.push('ALLOWED_ORIGIN');
  } else ok('ALLOWED_ORIGIN: ' + origem);

  if (env.NERVA_SEND_TRACKING === '1') {
    av('NERVA_SEND_TRACKING=1 — a Nerva também vai disparar CompletePayment.');
    av('  Como este projeto tem rastreamento próprio, a compra contaria 2x. Deixe vazio.');
    avisos.push('NERVA_SEND_TRACKING');
  }

  // ---------- 3. .env fora do Git ----------
  console.log('\n' + c('3. Segurança'));
  const gi = path.join(DIR, '..', '.gitignore');
  const ignorado = fs.existsSync(gi) && /(^|\n)\s*nerva\/\.env\s*(\n|$)/.test(fs.readFileSync(gi, 'utf8'));
  if (ignorado) ok('.env está no .gitignore — não vai para o repositório');
  else { er('.env NÃO está no .gitignore — sua chave pode ir para o GitHub'); problemas.push('gitignore'); }

  // ---------- 4. conexão ----------
  console.log('\n' + c('4. Conexão com a API'));
  if (problemas.includes('NERVA_API_KEY')) {
    av('pulado: preencha a NERVA_API_KEY primeiro');
    return encerrar();
  }
  const base = (env.NERVA_BASE_URL || 'https://pixnerva.com.br/api').replace(/\/$/, '');
  try {
    const resp = await fetch(base + '/withdrawals/balance', { headers: { 'x-api-key': chave } });
    if (resp.status === 401) {
      er('chave recusada (401) — revogada, expirada ou copiada pela metade');
      problemas.push('chave inválida');
    } else if (resp.status === 403) {
      er('sem permissão (403) — a empresa pode estar inativa no painel');
      problemas.push('sem permissão');
    } else if (!resp.ok) {
      er('a API respondeu ' + resp.status + ' — tente de novo ou fale com o suporte');
      problemas.push('http ' + resp.status);
    } else {
      const d = (await resp.json()).data || {};
      const reais = n => 'R$ ' + (Number(n || 0) / 100).toFixed(2).replace('.', ',');
      ok('chave aceita — conectado à Nerva');
      ok('  saldo disponível: ' + reais(d.available));
      ok('  retido (30 dias):  ' + reais(d.withheld));
    }
  } catch (e) {
    er('não consegui alcançar ' + base + ' — ' + e.message);
    av('  sem internet, atrás de proxy, ou a URL da API está errada');
    problemas.push('rede');
  }

  encerrar();
}

function encerrar() {
  console.log('\n' + '─'.repeat(46));
  if (problemas.length) {
    console.log(r('Faltam ' + problemas.length + ' item(ns): ') + problemas.join(', '));
    console.log('Corrija no ' + c('nerva/.env') + ' e rode de novo.\n');
    process.exit(1);
  }
  if (avisos.length) console.log(a('Tudo funcionando, com ' + avisos.length + ' aviso(s) acima.'));
  else console.log(v('Tudo certo.'));
  console.log('\nPróximo passo:  ' + c('npm install && node server.js') + '\n');
  process.exit(0);
}

main().catch(e => { er(e.message); process.exit(1); });
