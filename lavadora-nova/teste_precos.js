#!/usr/bin/env node
/* Testa a tabela oficial de preços e a cotação do pedido, sem subir servidor.
   Rodar na raiz:  node teste_precos.js                                        */
'use strict';
const Module = require('module');
const _load = Module._load;
Module._load = function (req, ...rest) {           // pages.js pede express só para as rotas
  if (req === 'express') {
    const f = function () {}; f.static = () => {}; f.json = () => {};
    f.Router = () => ({ get() {}, post() {}, use() {} });
    return f;
  }
  return _load.call(this, req, ...rest);
};
process.env.DATA_DIR = require('os').tmpdir() + '/lavadora-teste-precos-' + process.pid;

const precos = require('./nerva/precos');
let falhas = 0;
const ok = (cond, msg) => { console.log((cond ? '  ok  ' : '  FALHOU  ') + msg); if (!cond) falhas++; };

const tab = precos.tabela();
console.log('\nTabela');
ok(tab.ok && tab.principal.por === 189.75, 'principal a R$ 189,75 (' + tab.principal.por + ')');
ok(Object.keys(tab.produtos).length === 6, '6 relacionados no catálogo');
ok(tab.produtos['carregador-48v-2ah'].por === 14.9, 'carregador a R$ 14,90');
ok(tab.orderBump.length === 3, '3 itens no order bump');
ok(tab.ofertaSaida.preco === 99.9 && tab.ofertaSaida.brindes.length === 2, 'oferta de saída R$ 99,90 com 2 brindes');
ok(precos.precoDe(tab, 'Bicicleta Elétrica V9 Max', '').tipo === 'principal', 'acha o principal pelo nome curto');
ok(precos.precoDe(tab, '', 'v9max-1000w').por === 189.75, 'acha o principal pelo SKU (sem diferenciar maiúsculas)');
ok(precos.precoDe(tab, 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB').por === 19.9, 'acha o capacete pelo título do card');
ok(precos.precoDe(tab, 'Capacete GTA Start LED (Brinde)').por === 0, 'brinde vale R$ 0');
ok(precos.precoDe(tab, 'Produto que não existe') === null, 'título desconhecido não tem preço');

console.log('\nCotação');
const c1 = precos.cotar({
  itens: [{ titulo: 'Bicicleta Elétrica V9 Max 60km Autonomia Urbana 32km/h', sku: 'V9MAX-1000W', qty: 1 }],
  extras: [{ titulo: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica MBE4015', qty: 1 },
           { titulo: 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB', qty: 2 }],
  frete: 0
}, tab);
ok(c1.ok && c1.total === 189.75 + 14.9 + 19.9 * 2, 'bike + carregador + 2 capacetes = R$ ' + c1.total);

const c2 = precos.cotar({ itens: [{ titulo: 'Bicicleta Elétrica V9 Max', qty: 1 }], backOffer: true }, tab);
ok(c2.ok && c2.total === 99.9, 'oferta de saída: bike sai a R$ 99,90 (' + c2.total + ')');

const c3 = precos.cotar({ itens: [{ titulo: 'Patinete Elétrico GM5 P1', qty: 3 }] }, tab);
ok(c3.ok && c3.total === 263.01, '3 patinetes pelo nome curto = R$ 263,01 (' + c3.total + ')');

const c4 = precos.cotar({ itens: [{ titulo: 'Bicicleta Elétrica V9 Max' }, { titulo: 'Drone que não vendemos' }] }, tab);
ok(!c4.ok && c4.naoEncontrados[0] === 'Drone que não vendemos', 'item fora do catálogo é recusado');

const c5 = precos.cotar({ itens: [{ titulo: 'Bicicleta Elétrica V9 Max', qty: 1 }], frete: -50 }, tab);
ok(c5.total === 189.75, 'frete negativo é ignorado');

const c6 = precos.cotar({ itens: [{ sku: 'JBL-BOOMBOX-4-PRETA', qty: 1 }], frete: 12.5 }, tab);
ok(c6.ok && c6.total === 99.9 + 12.5, 'Boombox pelo SKU + frete = R$ ' + c6.total);

console.log(falhas ? '\n' + falhas + ' falha(s)\n' : '\nTudo certo.\n');
process.exit(falhas ? 1 : 0);
