/* =========================================================
   Páginas de produto — /p/<slug>

   Cada produto do carrossel "Produtos relacionados" ganha uma página
   própria com o MESMO layout da oferta principal: a loja (index.html +
   app.js) já monta tudo a partir de um único JSON, então aqui só
   entregamos outro JSON no mesmo formato.

     GET /p/<slug>            -> serve o index.html da loja
     GET /api/offer.json?p=X  -> conteúdo daquele produto
     GET /api/offer.json      -> a oferta principal, intacta, só com o
                                 link (url) de cada card relacionado

   A oferta principal (portátil) NÃO é alterada em lugar nenhum: ela
   continua vindo do content.js/offer.json editado pelo painel.

   Para trocar textos/preços destas páginas sem mexer no código, crie
   nerva/data/pages.json assim:  { "ar-janela": { "preco": { "por": 1699 } } }
   ========================================================= */
'use strict';

const fs      = require('fs');
const path    = require('path');
const express = require('express');
const content  = require('./content');
const settings = require('./settings');

const ROOT     = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const PAGES_DB = path.join(DATA_DIR, 'pages.json');

/* o que pode ser servido por baixo de /p/ (assets pedidos em caminho
   relativo pelo index.html: styles.css, app.js, img/...). Nada de .json
   nem nada de /nerva/ — os dados de cliente continuam fora do alcance. */
const ASSET = /\.(css|js|mjs|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|map)$/i;

const VENDEDOR = { vendedor: 'Domus', vendedorVendas: '+250 mil vendas', condicao: 'Novo' };
/* marca REAL de cada relacionado. Antes todos herdavam "Vonder" do VENDEDOR, e
   isso ia como brand nos contents do pixel — capacete Norisk como Vonder. Sem
   marca conhecida, o campo simplesmente nao vai. */
const MARCAS = {
  "patinete-eletrico-gm5-p1": "GM5", "bicicleta-eletrica-cavalletta-c2": "Cavalletta", "capacete-gta-start-led": "GTA", "mini-compressor-rezzet": "Rezzet", "caixa-de-som-jbl-boombox-4": "JBL"
};
const CAT_SMART  = ['Eletrônicos', 'Casa Inteligente', 'Assistentes e Automação'];
const CAT_QUIM   = ['Acessórios para Veículos', 'Cuidado com o Veículo', 'Produtos de Limpeza'];
const CAT_MOTO   = ['Acessórios para Veículos', 'Acessórios de Motos', 'Capacetes e Acessórios'];
const CAT_FERR   = ['Ferramentas', 'Ferramentas Elétricas', 'Kits de Ferramentas'];
const CAT_ACESS  = ['Ferramentas', 'Ferramentas Elétricas', 'Lavadoras e Acessórios'];

const V127 = img => ({ rotulo: 'Voltagem', opcoes: [{ label: '127V', img }] });

/* ============================ CATÁLOGO ============================ */
const CATALOGO = [
  /* ---------------------------------------------------------------- */
  {
    slug: 'carregador-48v-2ah',
    card: { t: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica MBE4015', img: 'img/relacionados/carregador-48v-2ah.webp', sold: '+1000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica — MBE4015, Bivolt',
      nomeCurto: 'Carregador 48V 2Ah MBE4015',
      modelo: 'CARREGADOR-48V-2A', sku: 'CARREGADOR-48V-2A',
      vendidos: "+1000 vendidos", badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '1.204', categoria: ["Esportes e Fitness", "Ciclismo", "Peças para Bicicletas", "Baterias e Carregadores"]
    },
    preco: { de: 149.9, por: 14.9, off: '90% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/carregador-48v-2ah.webp', 'img/relacionados/carregador-48v-2ah-2.webp', 'img/relacionados/carregador-48v-2ah-3.webp', 'img/relacionados/carregador-48v-2ah-4.webp', 'img/relacionados/carregador-48v-2ah-5.webp'],
    variante: { rotulo: 'Cor', opcoes: [{ label: 'Preto', img: 'img/relacionados/carregador-48v-2ah.webp' }] },
    bullets: ["Carregador para baterias de lítio 48V: saída de 54,6V e 2A.", "Serve para bicicletas e scooters elétricas 48V, como a V9 Max.", "Entrada bivolt automática, de 100V a 240V.", "LED indica carregando (vermelho) e carga completa (verde).", "Proteção contra sobrecarga, curto-circuito e superaquecimento.", "Confira o conector da sua bateria antes de comprar."],
    descricao: `CARREGADOR 48V 54,6V 2AH — MBE4015

Carregador de reposição para baterias de lítio 48V de bicicletas e scooters elétricas. A saída de 54,6V é a tensão de carga completa de um pack de lítio 48V (13 células em série), e a corrente de 2A completa a carga de uma bateria de 15 a 20Ah em cerca de 8 a 10 horas.

Ter um segundo carregador resolve o problema de quem carrega em dois lugares, em casa e no trabalho, sem precisar levar o carregador na mochila todo dia.

A entrada é bivolt automática, então funciona em qualquer tomada de 100V a 240V. O LED muda de vermelho para verde quando a carga termina, e o circuito desliga a corrente sozinho para não sobrecarregar a bateria.

ATENÇÃO AO CONECTOR
Cada fabricante usa um plugue diferente na bateria. Confira o formato do conector da sua bateria antes de comprar.

CONTEÚDO DA EMBALAGEM
1 carregador MBE4015 e 1 cabo de força.

Aviso: preço, foto e ficha ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Modelo', v: 'MBE4015' },
      { k: 'Tensão de entrada', v: '100V a 240V AC, bivolt automático' },
      { k: 'Tensão de saída', v: '54,6V DC' },
      { k: 'Corrente de saída', v: '2A' },
      { k: 'Bateria compatível', v: 'Lítio 48V (13S)' },
      { k: 'Indicador', v: 'LED vermelho carregando, verde carga completa' },
      { k: 'Proteções', v: 'Sobrecarga, curto-circuito e superaquecimento' },
      { k: 'Uso', v: 'Bicicletas e scooters elétricas 48V' },
      { k: 'Cor', v: 'Preto' },
      { k: 'Garantia', v: '90 dias' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a bicicleta elétrica.',
      comentarios: '412 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso junto com a bike elétrica, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: "sem-carregador",
    seo: {
      title: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica — MBE4015, Bivolt | Domus',
      description: 'Carregador de reposição para baterias de lítio 48V de bicicletas e scooters elétricas. A saída de 54,6V é a tensão de carga completa de um pack de lít',
      buscas: ["carregador bicicleta eletrica 48v", "carregador 54.6v 2a", "carregador scooter eletrica"]
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'patinete-eletrico-gm5-p1',
    card: { t: 'Patinete Elétrico GM5 P1 Preto Dobrável com Bluetooth 25 km/h e 22 km de Autonomia', img: 'img/relacionados/patinete-eletrico-gm5-p1.webp', sold: '+500 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Patinete Elétrico GM5 P1 Preto Dobrável com Bluetooth — 25 km/h e Autonomia de 22 km',
      nomeCurto: 'Patinete Elétrico GM5 P1',
      modelo: 'GM5-P1-PRETO', sku: 'GM5-P1-PRETO',
      vendidos: "+500 vendidos", badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '1.204', categoria: ["Esportes e Fitness", "Mobilidade Elétrica", "Patinetes Elétricos"]
    },
    preco: { de: 1260, por: 87.67, off: '93% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/patinete-eletrico-gm5-p1.webp', 'img/relacionados/patinete-eletrico-gm5-p1-2.webp', 'img/relacionados/patinete-eletrico-gm5-p1-3.webp', 'img/relacionados/patinete-eletrico-gm5-p1-4.webp', 'img/relacionados/patinete-eletrico-gm5-p1-5.webp'],
    variante: { rotulo: 'Cor', opcoes: [{ label: 'Preto', img: 'img/relacionados/patinete-eletrico-gm5-p1.webp' }] },
    bullets: [
      'Motor de 400 W, velocidade máxima de 25 km/h e subidas de até 15°.',
      'Bateria de lítio 36V 6Ah com até 22 km de autonomia; recarga em 4 a 5 horas.',
      'Pneus alveolares de 8,5 polegadas: sem câmara, sem furo e sem calibrar.',
      'Dobrável e leve, 11,6 kg: cabe no porta-malas e no elevador.',
      'Tela LCD, 3 marchas, setas, luz traseira e aplicativo por Bluetooth.',
      'Frenagem dupla e resistência IPX4 a respingos.'
    ],
    descricao: `PATINETE ELÉTRICO GM5 P1 — PRETO, DOBRÁVEL, COM APP E TELA LCD

O GM5 P1 é um patinete elétrico para o trajeto curto do dia a dia: até o metrô, até o trabalho, até a padaria. O motor de 400 W leva a 25 km/h e sobe rampas de até 15°. A bateria de lítio 36V 6Ah rende até 22 km por carga, o suficiente para ir e voltar sem recarregar, e a recarga completa leva de 4 a 5 horas.

Os pneus alveolares de 8,5 polegadas não têm câmara de ar: não furam e não precisam de calibragem. O chassi é de liga de alumínio e dobra com um toque. Dobrado, o patinete pesa 11,6 kg e cabe no porta-malas, embaixo da mesa ou no canto do elevador.

A tela LCD no guidão mostra velocidade, nível de bateria, marcha selecionada (3 marchas), iluminação e avisos de avaria. Pelo aplicativo, conectado por Bluetooth, dá para travar o patinete, acompanhar velocidade e bateria e ajustar o modo de condução.

Segurança: frenagem dupla, setas de direção no guidão, luz traseira e resistência IPX4 a respingos.

A autonomia real varia com o peso do condutor, o relevo e o modo de uso.

CONTEÚDO DA EMBALAGEM
1 patinete GM5 P1, 1 carregador e 1 manual.

Aviso: preço ainda precisa ser conferido no anúncio.`,
    specs: [
      { k: 'Marca', v: 'GM5' },
      { k: 'Modelo', v: 'P1' },
      { k: 'Cor', v: 'Preto' },
      { k: 'Motor', v: '400 W' },
      { k: 'Velocidade máxima', v: '25 km/h' },
      { k: 'Autonomia', v: 'Até 22 km' },
      { k: 'Bateria', v: 'Lítio 36V 6Ah' },
      { k: 'Tempo de recarga', v: '4 a 5 horas' },
      { k: 'Ângulo de subida', v: 'Até 15°' },
      { k: 'Pneus', v: '8,5 polegadas, alveolares (sem câmara)' },
      { k: 'Marchas', v: '3' },
      { k: 'Freios', v: 'Frenagem dupla' },
      { k: 'Painel', v: 'Tela LCD com velocidade, bateria e marcha' },
      { k: 'Conectividade', v: 'Bluetooth com aplicativo' },
      { k: 'Iluminação', v: 'Farol, setas de direção e luz traseira' },
      { k: 'Resistência à água', v: 'IPX4' },
      { k: 'Chassi', v: 'Liga de alumínio, dobrável' },
      { k: 'Peso', v: '11,6 kg' },
      { k: 'Carga máxima', v: '120 kg' },
      { k: 'Garantia', v: '6 meses' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a bicicleta elétrica.',
      comentarios: '412 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso junto com a bike elétrica, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: "acess",
    seo: {
      title: 'Patinete Elétrico GM5 P1 Preto Dobrável com Bluetooth — 25 km/h e Autonomia de 22 km | Domus',
      description: 'O GM5 P1 é um patinete elétrico para o trajeto curto do dia a dia: até o metrô, até o trabalho, até a padaria. O motor de 400 W leva a 25 km/h e sobe ',
      buscas: ["patinete eletrico gm5 p1", "patinete eletrico dobravel", "patinete eletrico adulto 400w"]
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'bicicleta-eletrica-cavalletta-c2',
    card: { t: 'Bicicleta Elétrica Cavalletta C2 750W Bateria Removível 48V 20Ah 65 km', img: 'img/relacionados/bicicleta-eletrica-cavalletta-c2.webp', sold: '+100 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Bicicleta Elétrica Cavalletta C2 750W — Bateria de Lítio Removível 48V 20Ah, até 65 km',
      nomeCurto: 'Bicicleta Elétrica Cavalletta C2',
      modelo: 'CAVALLETTA-C2-750W', sku: 'CAVALLETTA-C2-750W',
      vendidos: "+100 vendidos", badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '1.204', categoria: ["Esportes e Fitness", "Ciclismo", "Bicicletas", "Bicicletas Elétricas"]
    },
    preco: { de: 6097, por: 127.65, off: '98% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/bicicleta-eletrica-cavalletta-c2.webp', 'img/relacionados/bicicleta-eletrica-cavalletta-c2-2.webp', 'img/relacionados/bicicleta-eletrica-cavalletta-c2-3.webp', 'img/relacionados/bicicleta-eletrica-cavalletta-c2-4.webp', 'img/relacionados/bicicleta-eletrica-cavalletta-c2-5.webp'],
    variante: { rotulo: 'Cor', opcoes: [{ label: 'Vermelho', img: 'img/relacionados/bicicleta-eletrica-cavalletta-c2.webp' }] },
    bullets: [
      'Motor de 750 W e velocidade limitada a 32 km/h: sem CNH e sem placa.',
      'Bateria de lítio 48V 20Ah removível, com até 65 km de autonomia; recarga em 7 horas.',
      'Tela inteligente com velocidade, carga restante e distância em tempo real.',
      'Faróis de LED, retrovisores e cesto dianteiro.',
      'Banco traseiro com encosto, altura do banco de 73 cm e amortecedor traseiro com mola.',
      'Pneus 14 x 2,50 antifuro, para asfalto, paralelepípedo e terra.'
    ],
    descricao: `BICICLETA ELÉTRICA CAVALLETTA C2 — 750W, BATERIA REMOVÍVEL 48V 20AH, ATÉ 65 KM

A Cavalletta C2 é uma bicicleta elétrica urbana no estilo scooter, com motor de 750 W e bateria de lítio 48V 20Ah que rende até 65 km por carga. A velocidade é limitada a 32 km/h, o que enquadra o modelo como veículo autopropelido: não exige CNH nem emplacamento (Resolução CONTRAN 996/2023).

A bateria é removível: sai da bike para carregar em qualquer tomada, em casa ou no trabalho, em cerca de 7 horas. A tela inteligente no guidão mostra velocidade, carga restante, distância percorrida e marcha em tempo real.

O conforto vem do banco a 73 cm do chão, do banco traseiro com encosto para o garupa e do amortecedor traseiro com mola. Os pneus 14 x 2,50 são antifuro e aguentam asfalto, paralelepípedo, terra e cascalho, com pressão de 280 a 360 kPa.

Segurança e praticidade: faróis de LED para andar à noite, retrovisores nos dois lados, freio a tambor e cesto dianteiro para compras e mochila.

A autonomia real varia com o peso do condutor, o relevo, a calibragem dos pneus e o modo de condução.

CONTEÚDO DA EMBALAGEM
1 bicicleta elétrica Cavalletta C2, 1 bateria 48V 20Ah, 1 carregador, chaves e manual.

Aviso: preço ainda precisa ser conferido no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Cavalletta' },
      { k: 'Modelo', v: 'C2' },
      { k: 'Cor', v: 'Vermelho' },
      { k: 'Motor', v: '750 W' },
      { k: 'Bateria', v: 'Lítio 48V 20Ah, removível' },
      { k: 'Autonomia', v: 'Até 65 km por carga' },
      { k: 'Velocidade máxima', v: '32 km/h (limitada)' },
      { k: 'Tempo de recarga', v: 'Aprox. 7 horas' },
      { k: 'Painel', v: 'Tela inteligente com velocidade, carga e distância' },
      { k: 'Iluminação', v: 'Faróis de LED' },
      { k: 'Freios', v: 'A tambor' },
      { k: 'Suspensão', v: 'Amortecedor traseiro com mola' },
      { k: 'Pneus', v: '14 x 2,50, antifuro' },
      { k: 'Pressão dos pneus', v: '280 a 360 kPa' },
      { k: 'Altura do banco', v: '73 cm' },
      { k: 'Banco traseiro', v: 'Com encosto' },
      { k: 'Acessórios', v: 'Cesto dianteiro e retrovisores' },
      { k: 'Exige CNH ou placa', v: 'Não (Resolução CONTRAN 996/2023)' },
      { k: 'Uso', v: 'Urbano, curta e média distância' },
      { k: 'Garantia', v: '6 meses' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a bicicleta elétrica.',
      comentarios: '412 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso junto com a bike elétrica, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: "acess",
    seo: {
      title: 'Bicicleta Elétrica Cavalletta C2 750W — Bateria de Lítio Removível 48V 20Ah, até 65 km | Domus',
      description: 'A Cavalletta C2 é uma bicicleta elétrica urbana no estilo scooter, com motor de 750 W e bateria de lítio 48V 20Ah que rende até 65 km por carga. A vel',
      buscas: ["bicicleta eletrica cavalletta c2", "bicicleta eletrica 750w", "bike eletrica bateria removivel"]
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'capacete-gta-start-led',
    card: { t: 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB', img: 'img/relacionados/capacete-gta-start-led.webp', sold: '+5000 vendidos', tag: 'Tam. M e G', ship: true, full: false, pix: false },
    produto: {
      titulo: 'Capacete GTA Start com Sinalizador de LED — Ciclismo, MTB e Bike Elétrica',
      nomeCurto: 'Capacete GTA Start LED',
      modelo: 'GTA-START-LED', sku: 'GTA-START-LED',
      vendidos: "+5000 vendidos", badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '1.204', categoria: ["Esportes e Fitness", "Ciclismo", "Vestuário e Proteção", "Capacetes"]
    },
    preco: { de: 139.99, por: 19.9, off: '86% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/capacete-gta-start-led.webp', 'img/relacionados/capacete-gta-start-led-2.webp', 'img/relacionados/capacete-gta-start-led-3.webp', 'img/relacionados/capacete-gta-start-led-4.webp', 'img/relacionados/capacete-gta-start-led-5.webp'],
    variante: { rotulo: 'Tamanho', opcoes: [{ label: 'M (54-58 cm)', img: 'img/relacionados/capacete-gta-start-led.webp' }, { label: 'G (58-62 cm)', img: 'img/relacionados/capacete-gta-start-led.webp' }] },
    bullets: ["Sinalizador traseiro com 6 LEDs vermelhos: contínuo, pisca e strobo.", "Construção In Mold, leve: cerca de 237 g.", "18 entradas de ar para ventilação.", "Viseira e almofadas internas removíveis para lavar.", "Tamanhos M (54 a 58 cm) e G (58 a 62 cm)."],
    descricao: `CAPACETE GTA START COM SINALIZADOR DE LED

Capacete de ciclismo com sinalizador traseiro integrado: 6 LEDs vermelhos com três funções, contínuo, pisca e strobo, para você ser visto de longe à noite e em dias de chuva. Na bike elétrica, que anda mais rápido no trânsito, essa visibilidade extra faz diferença.

A construção In Mold funde a casca externa ao EPS, o que deixa o capacete leve, cerca de 237 g, e resistente. As 18 entradas de ar mantêm a cabeça ventilada. A viseira e as almofadas internas saem para lavar.

COMO ESCOLHER O TAMANHO
Meça a circunferência da cabeça com uma fita métrica, logo acima das sobrancelhas. De 54 a 58 cm, tamanho M. De 58 a 62 cm, tamanho G.

Capacete é item de segurança. Se sofrer impacto, deve ser substituído mesmo sem dano aparente.

CONTEÚDO DA EMBALAGEM
1 capacete GTA Start com viseira e sinalizador de LED.

Aviso: preço, foto e ficha ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'GTA' },
      { k: 'Modelo', v: 'Start' },
      { k: 'Construção', v: 'In Mold' },
      { k: 'Material', v: 'EPS, poliéster e PVC' },
      { k: 'Entradas de ar', v: '18' },
      { k: 'Sinalizador', v: '6 LEDs vermelhos, 3 funções' },
      { k: 'Viseira', v: 'Removível' },
      { k: 'Almofadas internas', v: 'Removíveis e laváveis' },
      { k: 'Peso', v: 'Aprox. 237 g' },
      { k: 'Tamanhos', v: 'M (54-58 cm) e G (58-62 cm)' },
      { k: 'Uso', v: 'Ciclismo, MTB e bicicleta elétrica' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a bicicleta elétrica.',
      comentarios: '412 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso junto com a bike elétrica, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: "sem-capacete",
    seo: {
      title: 'Capacete GTA Start com Sinalizador de LED — Ciclismo, MTB e Bike Elétrica | Domus',
      description: 'Capacete de ciclismo com sinalizador traseiro integrado: 6 LEDs vermelhos com três funções, contínuo, pisca e strobo, para você ser visto de longe à n',
      buscas: ["capacete gta start led", "capacete ciclismo com led", "capacete bike sinalizador"]
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'mini-compressor-rezzet',
    card: { t: 'Mini Compressor Digital Rezzet Portátil com Calibrador para Carro, Bicicleta e Moto', img: 'img/relacionados/mini-compressor-rezzet.webp', sold: '+5000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Mini Compressor Digital Rezzet — Bomba de Encher Pneus Portátil com Calibrador para Carro, Bicicleta e Moto',
      nomeCurto: 'Mini Compressor Rezzet',
      modelo: 'REZZET-COMPRESSOR', sku: 'REZZET-COMPRESSOR',
      vendidos: "+5000 vendidos", badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '1.204', categoria: ["Acessórios para Veículos", "Ferramentas para Veículos", "Compressores de Ar"]
    },
    preco: { de: 119.9, por: 22.6, off: '81% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ["img/relacionados/mini-compressor-rezzet.webp"],
    variante: { rotulo: 'Cor', opcoes: [{ label: 'Preto', img: 'img/relacionados/mini-compressor-rezzet.webp' }] },
    bullets: [
      'Enche e calibra pneus de carro, moto, bicicleta, scooter e bolas.',
      'Display digital em PSI ou BAR: escolha a pressão e ele desliga sozinho ao chegar nela.',
      'Bateria interna de 2.000 mAh com recarga por USB-C, ou ligado na tomada 12V do carro.',
      '6 modos: livre, bike, moto, carro, scooter e bola.',
      'Inclui adaptadores para válvulas diferentes, agulha para bolas e bico para boias.',
      'Cabe na mochila ou no porta-luvas: 15 x 9,5 x 7,2 cm, com lanterna LED.'
    ],
    descricao: `MINI COMPRESSOR DIGITAL REZZET — PORTÁTIL, COM CALIBRADOR DE PRECISÃO

Compressor de ar portátil com bateria interna, para encher e calibrar pneus sem depender de posto. Escolha a pressão no display digital, em PSI ou BAR, encaixe o bico e ele para sozinho quando chega no valor: sem risco de encher demais e superaquecer o pneu.

Tem 6 modos pré-configurados, livre, bike, moto, carro, scooter e bola, e a vazão de 25 litros por minuto enche o pneu de uma bike em poucos segundos. A bateria de 2.000 mAh recarrega por USB-C, no mesmo cabo do celular, e o aparelho também pode ser ligado na tomada 12V do carro, o acendedor de cigarro, para não depender da carga.

Com 15 x 9,5 x 7,2 cm, cabe na mochila ou no porta-luvas. A lanterna LED integrada ajuda a trocar ou encher um pneu no escuro.

CONTEÚDO DA EMBALAGEM
1 mini compressor Rezzet, 1 mangueira de 0,5 m, 1 cabo USB-C de 0,8 m, adaptadores para válvulas de carro e bike, agulha para bolas e bico para boias e infláveis.

Aviso: preço ainda precisa ser conferido no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Rezzet' },
      { k: 'Potência', v: '120 W' },
      { k: 'Corrente', v: '10A' },
      { k: 'Vazão de ar', v: '25 L/min' },
      { k: 'Unidades de pressão', v: 'PSI e BAR' },
      { k: 'Modos', v: 'Livre, bike, moto, carro, scooter e bola' },
      { k: 'Desligamento automático', v: 'Sim, ao atingir a pressão escolhida' },
      { k: 'Bateria', v: '2.000 mAh' },
      { k: 'Alimentação', v: 'USB-C 5V ou tomada 12V do veículo' },
      { k: 'Display', v: 'Digital com calibrador' },
      { k: 'Lanterna', v: 'LED integrada' },
      { k: 'Adaptadores', v: 'Válvulas de carro e bike, agulha para bolas e bico para infláveis' },
      { k: 'Mangueira', v: '0,5 m' },
      { k: 'Cabo', v: '0,8 m' },
      { k: 'Dimensões', v: '15 x 9,5 x 7,2 cm' },
      { k: 'Material', v: 'ABS' },
      { k: 'Cor', v: 'Preto' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a bicicleta elétrica.',
      comentarios: '412 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso junto com a bike elétrica, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: "sem-compressor",
    seo: {
      title: 'Mini Compressor Digital Rezzet — Bomba de Encher Pneus Portátil com Calibrador para Carro, Bicicleta e Moto | Domus',
      description: 'Compressor de ar portátil com bateria interna, para encher e calibrar pneus sem depender de posto. Escolha a pressão no display digital, em PSI ou BAR',
      buscas: ["mini compressor portatil", "compressor de ar rezzet", "bomba de encher pneu digital"]
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'caixa-de-som-jbl-boombox-4',
    card: { t: 'Caixa de Som JBL Boombox 4 Bluetooth 210W IP68 até 34h de Bateria Preta', img: 'img/relacionados/caixa-de-som-jbl-boombox-4.webp', sold: '+500 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Caixa de Som JBL Boombox 4 Bluetooth 210W — AI Sound Boost, IP68, Bateria de até 34h, Áudio Lossless, Preta',
      nomeCurto: 'JBL Boombox 4 Preta',
      modelo: 'JBL-BOOMBOX-4-PRETA', sku: 'JBL-BOOMBOX-4-PRETA',
      vendidos: "+500 vendidos", badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '1.204', categoria: ["Eletrônicos, Áudio e Vídeo", "Áudio Portátil", "Caixas de Som"]
    },
    preco: { de: 2469, por: 99.9, off: '96% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/caixa-de-som-jbl-boombox-4.webp', 'img/relacionados/caixa-de-som-jbl-boombox-4-2.webp', 'img/relacionados/caixa-de-som-jbl-boombox-4-3.webp', 'img/relacionados/caixa-de-som-jbl-boombox-4-4.webp', 'img/relacionados/caixa-de-som-jbl-boombox-4-5.webp'],
    variante: { rotulo: 'Cor', opcoes: [{ label: 'Preto', img: 'img/relacionados/caixa-de-som-jbl-boombox-4.webp' }] },
    bullets: ["210 W de potência com som JBL Pro e graves profundos.", "AI Sound Boost ajusta o som em tempo real, com menos distorção.", "Bateria de até 34 horas, recarga completa em 3 horas.", "IP68: à prova d’água e poeira.", "Bluetooth 5.4, áudio lossless por USB-C e função power bank."],
    descricao: `CAIXA DE SOM JBL BOOMBOX 4 — 210W, IP68, ATÉ 34H DE BATERIA

A Boombox 4 é a maior caixa portátil da JBL: 210 W de potência, dois woofers de 5 polegadas, dois tweeters de 0,75 polegada e três radiadores passivos. O AI Sound Boost analisa a música em tempo real e ajusta o som para manter o grave forte sem distorcer, mesmo no volume máximo.

A bateria rende até 34 horas de música e recarrega em cerca de 3 horas. A saída USB-C também carrega o celular e recebe áudio lossless por cabo, para quem quer ouvir sem compressão.

Com certificação IP68, aguenta chuva, areia e até mergulho rápido. Serve para piscina, praia, churrasco e para levar no bagageiro da bike. O Bluetooth 5.4 mantém a conexão estável, e dá para parear várias caixas JBL compatíveis para tocar juntas.

CONTEÚDO DA EMBALAGEM
1 JBL Boombox 4, 1 cabo de energia e guia rápido.

Aviso: preço, foto e ficha ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'JBL' },
      { k: 'Modelo', v: 'Boombox 4' },
      { k: 'Cor', v: 'Preta' },
      { k: 'Potência', v: '210 W RMS' },
      { k: 'Alto-falantes', v: "2 woofers de 5\", 2 tweeters de 0,75\" e 3 radiadores passivos" },
      { k: 'Bateria', v: 'Até 34 horas' },
      { k: 'Tempo de recarga', v: 'Aprox. 3 horas' },
      { k: 'Resistência', v: 'IP68, à prova d’água e poeira' },
      { k: 'Bluetooth', v: '5.4' },
      { k: 'Entradas', v: 'USB-C com áudio lossless e power bank' },
      { k: 'Recursos', v: 'AI Sound Boost, graves personalizáveis' },
      { k: 'Garantia', v: '12 meses' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a bicicleta elétrica.',
      comentarios: '412 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso junto com a bike elétrica, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: "acess",
    seo: {
      title: 'Caixa de Som JBL Boombox 4 Bluetooth 210W — AI Sound Boost, IP68, Bateria de até 34h, Áudio Lossless, Preta | Domus',
      description: 'A Boombox 4 é a maior caixa portátil da JBL: 210 W de potência, dois woofers de 5 polegadas, dois tweeters de 0,75 polegada e três radiadores passivos',
      buscas: ["jbl boombox 4", "caixa de som jbl 210w", "caixa de som bluetooth a prova d agua"]
    }
  }
];

/* ---------------- order bumps por família de produto ---------------- */
const BUMPS = {
  "acess": [
    { t: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica MBE4015', p: 14.9, old: 149.9, img: 'img/relacionados/carregador-48v-2ah.webp' },
    { t: 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB', p: 19.9, old: 139.99, img: 'img/relacionados/capacete-gta-start-led.webp' },
    { t: 'Mini Compressor Digital Rezzet Portátil com Calibrador para Carro, Bicicleta e Moto', p: 22.6, old: 119.9, img: 'img/relacionados/mini-compressor-rezzet.webp' }
  ],
  "sem-carregador": [
    { t: 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB', p: 19.9, old: 139.99, img: 'img/relacionados/capacete-gta-start-led.webp' },
    { t: 'Mini Compressor Digital Rezzet Portátil com Calibrador para Carro, Bicicleta e Moto', p: 22.6, old: 119.9, img: 'img/relacionados/mini-compressor-rezzet.webp' }
  ],
  "sem-capacete": [
    { t: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica MBE4015', p: 14.9, old: 149.9, img: 'img/relacionados/carregador-48v-2ah.webp' },
    { t: 'Mini Compressor Digital Rezzet Portátil com Calibrador para Carro, Bicicleta e Moto', p: 22.6, old: 119.9, img: 'img/relacionados/mini-compressor-rezzet.webp' }
  ],
  "sem-compressor": [
    { t: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica MBE4015', p: 14.9, old: 149.9, img: 'img/relacionados/carregador-48v-2ah.webp' },
    { t: 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB', p: 19.9, old: 139.99, img: 'img/relacionados/capacete-gta-start-led.webp' }
  ]
};

/* ======================= MONTAGEM DAS PÁGINAS ======================= */

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/* ajustes feitos no painel, gravados em nerva/data/pages.json */
let OV = null;
function overrides() {
  if (OV) return OV;
  try { OV = JSON.parse(fs.readFileSync(PAGES_DB, 'utf8')) || {}; }
  catch (_) { OV = {}; }
  return OV;
}
function gravarOverrides(obj) {
  OV = obj;
  fs.writeFileSync(PAGES_DB, JSON.stringify(obj, null, 2));
  rev = Date.now().toString(36);
}
let rev = Date.now().toString(36);

/* mistura rasa por seção: { "ar-janela": { "preco": { "por": 1699 } } } */
function comAjustes(slug, pg) {
  const ov = overrides()[slug];
  if (!ov || typeof ov !== 'object') return pg;
  const out = Object.assign({}, pg);
  Object.keys(ov).forEach(k => {
    const a = out[k], b = ov[k];
    out[k] = (a && b && !Array.isArray(b) && typeof a === 'object' && typeof b === 'object')
      ? Object.assign({}, a, b) : b;
  });
  return out;
}

const bySlug = slug => CATALOGO.find(p => p.slug === slug);

/* card do produto no carrossel de outra página */
function cardDaPagina(pg) {
  return {
    t: pg.card.t, p: pg.preco.por, old: pg.preco.de, off: pg.preco.off,
    sold: pg.card.sold, img: pg.card.img, tag: pg.card.tag || '',
    ship: !!pg.card.ship, full: !!pg.card.full, pix: !!pg.card.pix,
    url: '/p/' + pg.slug, sku: pg.produto.sku || ''
  };
}

/* a oferta principal também aparece no carrossel das páginas */
function cardDaOferta(main) {
  const p = (main && main.produto) || {}, pr = (main && main.preco) || {};
  return {
    t: p.nomeCurto || p.titulo || 'Bicicleta Elétrica V9 Max',
    p: Number(pr.por) || 0, old: Number(pr.de) || 0, off: pr.off || '',
    sold: p.vendidos || '', img: (main && main.fotos && main.fotos[0]) || 'img/produto/bicicleta-eletrica-v9-max-1.webp',
    ship: pr.freteGratis !== false, full: false, pix: true,
    url: '/', sku: p.sku || ''
  };
}

function build(slug) {
  const base = bySlug(slug);
  if (!base) return null;
  const pg   = comAjustes(slug, base);
  const main = content.get() || {};

  return {
    produto: Object.assign({}, VENDEDOR, MARCAS[slug] ? { marca: MARCAS[slug] } : {}, pg.produto),
    preco: pg.preco,
    fotos: pg.fotos,
    variante: pg.variante,
    bullets: pg.bullets,
    descricao: pg.descricao,
    specs: pg.specs,
    avaliacoes: pg.avaliacoes,
    relacionados: [cardDaOferta(main)].concat(
      CATALOGO.filter(x => x.slug !== slug).map(x => cardDaPagina(comAjustes(x.slug, x)))
    ),
    orderBump: {
      titulo: 'Oferta especial antes de finalizar!',
      sub: 'Adicione ao seu pedido com frete grátis incluso',
      itens: BUMPS[pg.bump] || BUMPS.acess
    },
    /* oferta de saída: a MESMA em todas as páginas — é a que o usuário
       edita no painel para a oferta principal. O combo montado pelo app.js
       ao aceitar é fixo, então variar o texto por produto só faria a tela
       prometer uma coisa e o checkout cobrar outra. */
    ofertaSaida: main.ofertaSaida,
    seo: pg.seo
  };
}

/* a oferta principal continua igual — só ganha o link de cada card */
function comLinks(main) {
  const rel = (main && Array.isArray(main.relacionados)) ? main.relacionados : null;
  if (!rel || !rel.length) return main;
  const porImg = new Map(), porTitulo = new Map();
  CATALOGO.forEach(pg => {
    porImg.set(pg.card.img, pg.slug);
    porTitulo.set(norm(pg.card.t), pg.slug);
  });
  const links = rel.map(r => {
    const slug = porImg.get(r.img) || porTitulo.get(norm(r.t));
    if (!slug) return r;
    const pg = comAjustes(slug, bySlug(slug));
    return Object.assign({}, r, { url: '/p/' + slug, sku: pg.produto.sku || '' });
  });
  return Object.assign({}, main, { relacionados: links });
}


/* ==================== FEED DO CATÁLOGO (TikTok) ====================
   /catalog.csv — os 9 produtos do site no formato que o Catalog Manager lê.
   O sku_id é o MESMO content_id que o pixel manda, então o match é 100% por
   construção. Preço e fotos saem do conteúdo ao vivo: mexeu no painel, o
   catálogo acompanha na próxima leitura do TikTok.
   Campos obrigatórios: sku_id, title, description, availability, condition,
   price, link, image_link, brand.
   =================================================================== */

const COLUNAS = ['sku_id','title','description','availability','condition','price',
                 'link','image_link','additional_image_link','brand','product_type','sale_price'];

const csvCampo = v => '"' + String(v == null ? '' : v).replace(/"/g, '""').replace(/[\r\n]+/g, ' ').trim() + '"';
const dinheiro = n => Number(n || 0).toFixed(2) + ' BRL';

/* O TikTok exige JPG/PNG no image_link. O CDN do Mercado Livre entrega a
   MESMA imagem em .jpg só trocando a extensão, então .webp de lá vira .jpg. */
const paraJpg = u => String(u || '').replace(/^(https?:\/\/[^/]*mlstatic\.com\/.+)\.webp(\?.*)?$/i, '$1.jpg');
const ehJpgPng = u => /\.(jpe?g|png)(\?|$)/i.test(String(u || ''));

/* fotos boas para o feed: normalizadas e só nos formatos aceitos */
function fotosDoFeed(fotos, base) {
  return (fotos || []).filter(Boolean).map(paraJpg).filter(ehJpgPng).map(u => absoluta(u, base));
}
function imagemBoa(fotos, base) {
  return fotosDoFeed(fotos, base)[0] || absoluta('img/produto/bicicleta-eletrica-v9-max-1.webp', base);
}
function absoluta(u, base) {
  u = String(u || '');
  if (/^https?:\/\//i.test(u)) return u;
  return base + '/' + u.replace(/^\//, '');
}
/* descrição curta: primeiro parágrafo com conteúdo */
function resumo(txt, alt) {
  const p = String(txt || '').split(/\n\s*\n/).map(x => x.trim()).filter(x => x.length > 40);
  return (p[0] || p[1] || alt || '').slice(0, 500);
}

function linhaCsv(o, link, base) {
  const pr = o.preco || {}, pd = o.produto || {};
  const fotos = fotosDoFeed(o.fotos, base);
  const de = Number(pr.de) || Number(pr.por) || 0;
  const por = Number(pr.por) || 0;
  return [
    pd.sku || '',
    pd.nomeCurto || pd.titulo || '',
    resumo(o.descricao, pd.titulo),
    'in stock',
    'new',
    dinheiro(de > por ? de : por),
    link,
    imagemBoa(o.fotos, base),
    fotos.slice(1, 4).join(','),
    pd.marca || 'Vonder',
    (pd.categoria || []).join(' > '),
    de > por ? dinheiro(por) : ''
  ].map(csvCampo).join(',');
}

function feedCsv(base) {
  const main = content.get() || {};
  const linhas = [COLUNAS.join(',')];
  if (main.produto && main.produto.sku) linhas.push(linhaCsv(main, base + '/', base));
  CATALOGO.forEach(pg => {
    const o = build(pg.slug);
    if (o && o.produto.sku) linhas.push(linhaCsv(o, base + '/p/' + pg.slug, base));
  });
  return linhas.join('\n') + '\n';
}

/* ===================== EDIÇÃO PELO PAINEL ===================== */

const txt  = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').slice(0, max || 240);
const nm   = (v, def) => { const n = Number(v); return isFinite(n) ? n : (def || 0); };
const arr  = (v, max) => Array.isArray(v) ? v.slice(0, max) : [];

/* aceita SÓ o que o painel edita — nada de campo solto vindo do navegador */
function limpar(body) {
  const b = body || {}, out = {};
  if (b.card) out.card = {
    t: txt(b.card.t, 160), sold: txt(b.card.sold, 40),
    ship: !!b.card.ship, full: !!b.card.full, pix: !!b.card.pix
  };
  if (b.produto) out.produto = {
    titulo: txt(b.produto.titulo, 220), nomeCurto: txt(b.produto.nomeCurto, 120),
    vendidos: txt(b.produto.vendidos, 40), nota: txt(b.produto.nota, 8),
    avaliacoes: txt(b.produto.avaliacoes, 20), badge: txt(b.produto.badge, 40),
    badgeLink: txt(b.produto.badgeLink, 80),
    /* content_id do pixel do TikTok — tem que ser igual ao sku_id do catálogo */
    sku: txt(b.produto.sku, 80),
    marca: txt(b.produto.marca, 60), modelo: txt(b.produto.modelo, 60),
    vendedor: txt(b.produto.vendedor, 60), vendedorVendas: txt(b.produto.vendedorVendas, 40),
    condicao: txt(b.produto.condicao, 30),
    categoria: arr(b.produto.categoria, 8).map(x => txt(x, 60)).filter(Boolean)
  };
  if (b.preco) out.preco = {
    de: nm(b.preco.de), por: nm(b.preco.por), off: txt(b.preco.off, 20),
    parcelas: Math.max(1, Math.min(12, Math.round(nm(b.preco.parcelas, 4)))),
    cupom: txt(b.preco.cupom, 80), freteGratis: true
  };
  if (b.fotos)   out.fotos   = arr(b.fotos, 8).map(u => txt(u, 400)).filter(Boolean);
  if (b.bullets) out.bullets = arr(b.bullets, 12).map(x => txt(x, 200)).filter(Boolean);
  if (typeof b.descricao === 'string') out.descricao = txt(b.descricao, 8000);
  if (b.specs) out.specs = arr(b.specs, 30)
    .map(x => ({ k: txt(x && x.k, 60), v: txt(x && x.v, 160) }))
    .filter(x => x.k || x.v);
  if (b.variante) out.variante = {
    rotulo: txt(b.variante.rotulo, 40),
    opcoes: arr(b.variante.opcoes, 8)
      .map(o => ({ label: txt(o && o.label, 40), img: txt(o && o.img, 400) }))
      .filter(o => o.label)
  };
  if (b.orderBump) out.orderBump = {
    titulo: txt(b.orderBump.titulo, 120), sub: txt(b.orderBump.sub, 160),
    itens: arr(b.orderBump.itens, 6).map(i => ({
      t: txt(i && i.t, 160), p: nm(i && i.p), old: nm(i && i.old), img: txt(i && i.img, 400)
    })).filter(i => i.t)
  };
  if (b.ofertaSaida) out.ofertaSaida = {
    titulo: txt(b.ofertaSaida.titulo, 120), sub: txt(b.ofertaSaida.sub, 200),
    chamada: txt(b.ofertaSaida.chamada, 400), preco: nm(b.ofertaSaida.preco),
    brindeTitulo: txt(b.ofertaSaida.brindeTitulo, 160),
    brindeTexto: txt(b.ofertaSaida.brindeTexto, 300),
    imgProduto: arr(b.ofertaSaida.imgProduto, 4).map(u => txt(u, 400)).filter(Boolean),
    imgBrindes: arr(b.ofertaSaida.imgBrindes, 4).map(u => txt(u, 400)).filter(Boolean)
  };
  if (b.seo) out.seo = {
    title: txt(b.seo.title, 200), description: txt(b.seo.description, 400),
    buscas: arr(b.seo.buscas, 12).map(x => txt(x, 80)).filter(Boolean)
  };
  if (b.avaliacoes) out.avaliacoes = {
    resumoIA: txt(b.avaliacoes.resumoIA, 800),
    comentarios: txt(b.avaliacoes.comentarios, 40),
    lista: arr(b.avaliacoes.lista, 30).map(r => ({
      nota: Math.max(1, Math.min(5, Math.round(nm(r && r.nota, 5)))),
      pais: txt((r && r.pais) || 'Brasil', 40),
      quando: txt(r && r.quando, 40),
      likes: Math.max(0, Math.round(nm(r && r.likes, 0))),
      texto: txt(r && r.texto, 1500),
      fotos: arr(r && r.fotos, 6).map(u => txt(u, 400)).filter(Boolean)
    })).filter(r => r.texto)
  };
  return out;
}

/* o que o formulário do painel recebe: catálogo + ajustes já aplicados */
function editavel(slug) {
  const base = bySlug(slug);
  if (!base) return null;
  const pg = comAjustes(slug, base);
  return {
    slug: slug, url: '/p/' + slug, editado: !!overrides()[slug],
    card: pg.card, produto: pg.produto, preco: pg.preco, fotos: pg.fotos,
    variante: pg.variante, bullets: pg.bullets, descricao: pg.descricao,
    specs: pg.specs, avaliacoes: pg.avaliacoes,
    orderBump: (build(slug) || {}).orderBump,
    ofertaSaida: (build(slug) || {}).ofertaSaida,
    seo: pg.seo
  };
}

/* ============================== ROTAS ============================== */
function mount(app, auth) {
  /* Registrado ANTES do content.js: com ?p= devolve a página do produto,
     sem ?p= cai no next() do próprio content.js depois de acrescentar os
     links (a oferta principal segue vindo de lá, sem alteração). */
  app.get('/api/offer.json', (req, res, next) => {
    const slug = String(req.query.p || '').trim().toLowerCase();
    res.set('Cache-Control', 'no-store');
    if (slug) {
      const pg = build(slug);
      if (!pg) return next();
      return res.json(Object.assign({ _rev: rev }, pg));
    }
    const main = content.get();
    if (!main) return next();
    return res.json(Object.assign({ _rev: content.rev ? content.rev() : '' }, comLinks(main)));
  });

  /* feed do catálogo — o TikTok busca esta URL periodicamente */
  app.get('/catalog.csv', (req, res) => {
    const base = (process.env.PUBLIC_URL || ('https://' + req.headers.host)).replace(/\/+$/, '');
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=600');
    res.send(feedCsv(base));
  });

  /* a página em si: se existir página estática específica daquele produto, entrega ela com os Pixels injetados; senão usa o template dinâmico */
  app.get('/p/:slug', (req, res, next) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (ASSET.test(slug)) return next();               // /p/app.js, /p/styles.css…
    if (!bySlug(slug)) return res.redirect(302, '/');  // produto que não existe

    /* produto desta página para o pixel (SKU/nome/preço, já com os ajustes do
       painel): o rastreamento no <head> dispara o ViewContent certo na hora */
    const produto = settings.produtoPixel(build(slug));

    const staticFile = path.join(ROOT, 'p', slug, 'index.html');
    if (fs.existsSync(staticFile)) {
      try {
        let pHtml = fs.readFileSync(staticFile, 'utf8');
        pHtml = pHtml.replace(/<head(\s[^>]*)?>/i, m => m + '\n' + settings.pixelTag(produto));
        return res.set('Cache-Control', 'no-store').type('html').send(pHtml);
      } catch (_) {
        return res.set('Cache-Control', 'no-store').sendFile(staticFile);
      }
    }

    // mesmo HTML da home, COM os Pixel IDs do painel e o produto injetados
    const html = settings.renderIndex(produto);
    res.set('Cache-Control', 'no-store');
    if (!html) return res.sendFile(path.join(ROOT, 'index.html'));
    res.type('html').send(html);
  });

  /* assets pedidos em caminho relativo por baixo de /p/ — mesma trava de
     segurança do express.static principal: nada de /nerva/ pela web. */
  app.use('/p', (req, res, next) => {
    const rp = req.path || '';
    if (!ASSET.test(rp) || rp.indexOf('/nerva/') === 0) return res.status(404).end();
    next();
  });
  app.use('/p', express.static(ROOT, { index: false }));

  /* -------------------- painel: aba "Produtos" -------------------- */
  if (!auth) return;

  app.get('/api/admin/pages', auth, (_req, res) => {
    res.json(CATALOGO.map(pg => {
      const e = editavel(pg.slug);
      return {
        slug: e.slug, url: e.url, editado: e.editado, nome: e.card.t,
        foto: e.fotos[0] || e.card.img, por: e.preco.por, de: e.preco.de,
        off: e.preco.off, coments: (e.avaliacoes.lista || []).length
      };
    }));
  });

  app.get('/api/admin/pages/:slug', auth, (req, res) => {
    const e = editavel(String(req.params.slug || '').toLowerCase());
    if (!e) return res.status(404).json({ error: 'Produto não encontrado' });
    res.json(e);
  });

  app.put('/api/admin/pages/:slug', auth, (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!bySlug(slug)) return res.status(404).json({ error: 'Produto não encontrado' });
    const dados = limpar(req.body);
    if (!Object.keys(dados).length) return res.status(400).json({ error: 'Nada para salvar' });
    // a foto do card acompanha a 1a foto da galeria
    if (dados.fotos && dados.fotos.length) {
      dados.card = Object.assign({}, dados.card || {}, { img: dados.fotos[0] });
    }
    try {
      const todos = Object.assign({}, overrides());
      todos[slug] = dados;
      gravarOverrides(todos);
      res.json({ ok: true, rev: rev });
    } catch (e) {
      res.status(500).json({ error: 'Não foi possível gravar: ' + e.message });
    }
  });

  app.post('/api/admin/pages/:slug/reset', auth, (req, res) => {
    const slug = String(req.params.slug || '').toLowerCase();
    if (!bySlug(slug)) return res.status(404).json({ error: 'Produto não encontrado' });
    try {
      const todos = Object.assign({}, overrides());
      delete todos[slug];
      gravarOverrides(todos);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Não foi possível gravar: ' + e.message });
    }
  });
}

module.exports = { mount, CATALOGO, build, slugs: () => CATALOGO.map(p => p.slug) };
