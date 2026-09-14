/* Sobe o servidor com vendas simuladas e captura o painel real. */
'use strict';
const fs = require('fs');
const path = require('path');

const DATA = '/tmp/painel-preview';
fs.rmSync(DATA, { recursive: true, force: true });
fs.mkdirSync(DATA, { recursive: true });

const PRODUTO = 'Bicicleta Elétrica V9 Max 60km Autonomia Urbana 32km/h';
const BUMPS = ['Aplicador Snow Foam 500 ml', 'Kit Lavagem Vonixx', 'Mangueira Tramontina 30 m'];
const NOMES = ['Carlos Eduardo Silva', 'Mariana Alves', 'Rafael Souza', 'Juliana Costa',
  'Paulo Henrique Lima', 'Fernanda Rocha', 'Bruno Cardoso', 'Patrícia Nunes',
  'Diego Martins', 'Camila Ferreira', 'Anderson Ribeiro', 'Larissa Gomes',
  'Thiago Barbosa', 'Vanessa Pinto', 'Marcelo Dias', 'Aline Moreira',
  'Gustavo Teixeira', 'Renata Carvalho', 'Felipe Azevedo', 'Bianca Ramos'];
const CAMPANHAS = ['lavadora-frio-01', 'lavadora-retarget', 'lavadora-lookalike', 'lavadora-abo-teste'];
const CRIATIVOS = ['video-demo-quintal', 'antes-depois-carro', 'unboxing-15s', 'depoimento-cliente'];
const DEVICES = ['mobile', 'mobile', 'mobile', 'mobile', 'desktop'];

const taxa = v => +(v * 0.0699 + 1.99).toFixed(2);
const rnd = a => a[Math.floor(Math.random() * a.length)];
const agora = Date.now();

const sales = {};
let n = 0;
// 30 dias de vendas, com mais volume nos últimos dias
for (let d = 29; d >= 0; d--) {
  const qtd = d < 3 ? 6 + Math.floor(Math.random() * 5)
            : d < 10 ? 3 + Math.floor(Math.random() * 4)
            : 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < qtd; i++) {
    n++;
    const criado = agora - d * 86400e3 - Math.floor(Math.random() * 86400e3);
    // ticket: produto + eventuais order bumps
    let valor = 76.91;
    const extras = [];
    if (Math.random() < 0.42) { valor += 19.90; extras.push(BUMPS[0]); }
    if (Math.random() < 0.24) { valor += 27.90; extras.push(BUMPS[1]); }
    if (Math.random() < 0.11) { valor += 29.90; extras.push(BUMPS[2]); }
    valor = +valor.toFixed(2);

    // ~38% pagam, o resto expira ou fica pendente
    const r = Math.random();
    const status = r < 0.38 ? 'paid' : r < 0.86 ? 'expired' : 'pending';
    const id = 'venda-' + String(n).padStart(4, '0');
    sales[id] = {
      id, status, amount: valor,
      fee: taxa(valor), netAmount: +(valor - taxa(valor)).toFixed(2),
      description: PRODUTO + (extras.length ? ' + ' + extras.join(' + ') : ''),
      payerName: rnd(NOMES),
      externalId: 'lav1300-' + id.slice(-4),
      transactionId: 'gw_tx_' + Math.random().toString(36).slice(2, 10),
      utmSource: 'tiktok', utmMedium: 'cpc',
      utmCampaign: rnd(CAMPANHAS), utmContent: rnd(CRIATIVOS), utmTerm: '',
      ttclid: 'ttclid_' + Math.random().toString(36).slice(2, 12),
      device: rnd(DEVICES),
      eventId: 'ev-' + Math.random().toString(36).slice(2, 10),
      orderFp: Math.random().toString(36).slice(2, 14),
      sid: 's-' + Math.random().toString(36).slice(2, 10),
      createdAt: new Date(criado).toISOString(),
      paidAt: status === 'paid' ? new Date(criado + 60e3 + Math.random() * 900e3).toISOString() : undefined,
      updatedAt: new Date(criado + 120e3).toISOString()
    };
  }
}
fs.writeFileSync(path.join(DATA, 'sales.json'), JSON.stringify(sales));

const pagas = Object.values(sales).filter(s => s.status === 'paid');
console.log('vendas simuladas:', Object.keys(sales).length,
            '| pagas:', pagas.length,
            '| faturamento: R$', pagas.reduce((s, x) => s + x.amount, 0).toFixed(2));

process.env.DATA_DIR = DATA;
process.env.ADMIN_TOKEN = 'preview';
process.env.NERVA_API_KEY = 'sk_live_preview';
process.env.NERVA_WEBHOOK_SECRET = 'whsec_preview';
process.env.PORT = '9600';
process.env.NERVA_BASE_URL = 'http://127.0.0.1:9601/api';
process.chdir(__dirname);
require('./server.js');
console.log('servidor no ar em http://127.0.0.1:9600/admin?token=preview');
