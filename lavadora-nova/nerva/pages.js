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
  'kit-vonixx-vexus': 'Vonixx', 'kit-lavadora-aspirador-vonder': 'Vonder', 'mangueira-trama-aco-wap': 'WAP',
  'mangueira-jardim-tramontina': 'Tramontina', 'kit-ferramentas-46-pecas': 'VLX', 'serra-marmore-makita': 'Makita',
  'capacete-norisk-razor': 'Norisk', 'capacete-norisk-ff302-grand-prix': 'Norisk', 'fone-bluetooth-capacete': 'Kateluo'
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
    slug: 'snow-foam-500ml',
    card: { t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', img: 'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp', sold: '+1000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml — Canhão de Espuma com Engate',
      nomeCurto: 'Aplicador Snow Foam 500 ml',
      modelo: 'SNOWFOAM-500', sku: 'SNOWFOAM-500',
      vendidos: '+1000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '2.104', categoria: CAT_QUIM
    },
    preco: { de: 59.9, por: 19.9, off: '67% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp'],
    variante: V127('img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp'),
    bullets: [
      'Canhão de espuma com reservatório de 500 ml.',
      'Gera espuma densa a partir do shampoo diluído.',
      'Regulagem de vazão e do formato do jato.',
      'Bico de latão com engate de encaixe rápido.',
      'Confira o tipo de engate da sua lavadora antes de comprar.'
    ],
    descricao: `APLICADOR SNOW FOAM PARA LAVADORA DE PRESSÃO — 500 ML

É o acessório que transforma shampoo diluído em espuma densa. O reservatório de 500 ml se acopla à lança da lavadora e a mistura sai como aquela camada branca que cobre o carro inteiro.

O ganho não é estético. A espuma fica agarrada à superfície e amolece a sujeira antes de qualquer contato com esponja ou luva — e é justamente esfregar sujeira seca que risca a pintura. Com a espuma agindo primeiro, boa parte da poeira sai só com o jato.

Tem regulagem de vazão e do formato do jato, então dá para ajustar a densidade da espuma conforme o produto usado.

ATENÇÃO AO ENGATE
O bico de latão usa encaixe rápido. Cada fabricante de lavadora adota um padrão próprio de engate — confira o da sua antes de comprar, ou verifique se o vendedor oferece adaptador.

Aviso: preço ainda precisa ser conferido no anúncio.`,
    specs: [
      { k: 'Tipo', v: 'Aplicador de espuma (canhão snow foam)' },
      { k: 'Capacidade do reservatório', v: '500 ml' },
      { k: 'Bico', v: 'Latão com engate de encaixe rápido' },
      { k: 'Regulagens', v: 'Vazão e formato do jato' },
      { k: 'Uso', v: 'Com shampoo automotivo diluído' },
      { k: 'Compatibilidade', v: 'Depende do padrão de engate da lavadora' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a lavadora de alta pressão.',
      comentarios: '701 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso sempre junto com a lavadora, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml — Canhão de Espuma com Engate | Domus',
      description: 'O snow foam é o passo que separa uma lavagem comum de uma lavagem segura. A espuma densa cobre o veículo e fica agarrada à superfície, dando tempo par',
      buscas: ['snow foam para lavadora 500 ml', 'snowfoam-500', 'snow']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'kit-vonixx-vexus',
    card: { t: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus', img: 'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp', sold: '+5000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus com Acessórios',
      nomeCurto: 'Kit Lavagem Automotiva Vonixx Vexus',
      modelo: 'VONIXX-VEXUS-KIT', sku: 'VONIXX-VEXUS-KIT',
      vendidos: '+5000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.8', avaliacoes: '8.412', categoria: CAT_QUIM
    },
    preco: { de: 129.9, por: 27.9, off: '79% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp'),
    bullets: [
      'V-Floc: shampoo neutro concentrado, não remove a cera nem o selante.',
      'Intense: renovador de plásticos internos com proteção UV.',
      'Sintra Fast: limpador bactericida, elimina 99,9% das bactérias.',
      'Vexus: limpador de rodas e motores de alta performance.',
      'Acompanha toalha de microfibra, pincel e esponjas aplicadoras.'
    ],
    descricao: `KIT LAVAGEM AUTOMOTIVA VONIXX — 4 PRODUTOS E ACESSÓRIOS

O kit cobre o carro inteiro, de fora para dentro, com quatro produtos de 500 ml cada.

O V-Floc é um shampoo de pH neutro e alta concentração. Isso importa porque detergente comum desengordura tudo e leva junto a cera ou o selante da pintura. O V-Floc limpa sem atacar essa proteção.

O Vexus resolve rodas e motor — as áreas de sujeira mais pesada, com pó de pastilha e graxa. O Sintra Fast é um limpador bactericida para o interior, e o Intense renova os plásticos internos com proteção UV, sem deixar aquele brilho oleoso no painel.

Acompanha toalha de microfibra, pincel para detalhes e esponjas aplicadoras — o suficiente para trabalhar sem improvisar.

Aviso: preço ainda precisa ser conferido no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Vonixx' },
      { k: 'Produtos', v: 'V-Floc, Intense, Sintra Fast e Vexus' },
      { k: 'Volume', v: '500 ml cada' },
      { k: 'V-Floc', v: 'Shampoo neutro concentrado' },
      { k: 'Intense', v: 'Renovador de plásticos internos com proteção UV' },
      { k: 'Sintra Fast', v: 'Limpador bactericida — 99,9% das bactérias' },
      { k: 'Vexus', v: 'Limpador de rodas e motores' },
      { k: 'Acessórios', v: 'Toalha de microfibra, pincel e esponjas' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a lavadora de alta pressão.',
      comentarios: '2804 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso sempre junto com a lavadora, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus com Acessórios | Domus',
      description: 'O V-Floc é um shampoo de pH neutro, o que significa que ele limpa sem atacar a cera ou o selante já aplicados na pintura. Detergente comum de cozinha ',
      buscas: ['kit lavagem automotiva vonixx vexus', 'vonixx-vexus-kit', 'kit']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'kit-lavadora-aspirador-vonder',
    card: { t: 'Kit Lavadora 1600 e Aspirador de Pó e Líquido APV1010 Vonder', img: 'img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp', sold: '+500 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Kit Vonder — Lavadora de Alta Pressão 1600 e Aspirador de Pó e Líquido APV1010',
      nomeCurto: 'Kit Lavadora 1600 + Aspirador APV1010 Vonder',
      modelo: 'VONDER-KIT-LAV1600-APV1010', sku: 'VONDER-KIT-LAV1600-APV1010',
      vendidos: '+500 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '1.180', categoria: CAT_FERR
    },
    preco: { de: 1099, por: 127, off: '88% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp'],
    variante: V127('img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp'),
    bullets: [
      'Lavadora de alta pressão de 1.600 lbf/pol² — mais potente que a LAV 1300.',
      'Aspirador APV1010 para pó e líquido, útil no pós-lavagem.',
      'Aspira a água que sobra no carro, na garagem ou na área de serviço.',
      'Duas ferramentas da mesma marca, com acessórios inclusos.',
      'Sai mais em conta que comprar os dois separados.'
    ],
    descricao: `KIT VONDER — LAVADORA 1600 + ASPIRADOR DE PÓ E LÍQUIDO APV1010

A combinação resolve o ciclo completo: a lavadora tira a sujeira, o aspirador recolhe a água que sobra. Faz diferença ao lavar o carro em garagem coberta ou ao limpar a área de serviço, onde a água empoçada é o incômodo maior.

A lavadora do kit é a de 1.600 lbf/pol², um degrau acima da LAV 1300. O APV1010 aspira tanto pó quanto líquido, então serve o ano inteiro, não só nos dias de lavagem.

Comprado em kit, sai por menos que os dois avulsos.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Vonder' },
      { k: 'Itens', v: 'Lavadora de alta pressão 1600 e aspirador APV1010' },
      { k: 'Pressão da lavadora', v: '1.600 lbf/pol²' },
      { k: 'Aspirador', v: 'Pó e líquido' },
      { k: 'Uso indicado', v: 'Doméstico' },
      { k: 'Garantia', v: 'Conforme o fabricante' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a lavadora de alta pressão.',
      comentarios: '393 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso sempre junto com a lavadora, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Kit Vonder — Lavadora de Alta Pressão 1600 e Aspirador de Pó e Líquido APV1010 | Domus',
      description: 'A combinação resolve o ciclo completo: a lavadora tira a sujeira, o aspirador recolhe a água que sobra. Faz diferença ao lavar o carro em garagem cobe',
      buscas: ['kit lavadora 1600 + aspirador apv1010 vonder', 'vonder-kit-lav1600-apv1010', 'kit']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'mangueira-trama-aco-wap',
    card: { t: 'Mangueira Trama de Aço 10 m WAP Combate Turbo 2600', img: 'img/relacionados/D_Q_NP_930716-MLB103748074706_012026-F-mangueira-trama-de-aco-10-mts-wap-combate-turbo-2600.webp', sold: '+500 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Mangueira Trama de Aço 10 Metros — WAP Combate e Turbo 2600',
      nomeCurto: 'Mangueira Trama de Aço 10 m WAP',
      modelo: 'WAP-MANG-10M', sku: 'WAP-MANG-10M',
      vendidos: '+500 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.6', avaliacoes: '940', categoria: CAT_ACESS
    },
    preco: { de: 279, por: 32.9, off: '88% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_930716-MLB103748074706_012026-F-mangueira-trama-de-aco-10-mts-wap-combate-turbo-2600.webp'],
    variante: V127('img/relacionados/D_Q_NP_930716-MLB103748074706_012026-F-mangueira-trama-de-aco-10-mts-wap-combate-turbo-2600.webp'),
    bullets: [
      '10 metros: contorna o carro sem reposicionar a lavadora.',
      'Trama de aço interna — aguenta a pressão sem estufar.',
      'Engate rápido nas duas pontas: máquina e pistola.',
      'Capa emborrachada com protetor anti-dobra nas extremidades.',
      'Para as linhas WAP Combate e Turbo 2600 — confira o engate.'
    ],
    descricao: `MANGUEIRA TRAMA DE AÇO 10 METROS — WAP COMBATE E TURBO 2600

O comprimento é o ganho mais óbvio: com 10 metros você contorna o carro sem parar para reposicionar a lavadora a cada lado.

A trama de aço interna é o que diferencia essa mangueira da que vem de fábrica. Ela aguenta a pressão sem estufar e resiste às dobras que, na mangueira comum, acabam virando vazamento.

Atenção ao engate: esta mangueira é feita para as linhas WAP Combate e Turbo 2600. Confira o encaixe do seu equipamento antes de comprar.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'WAP' },
      { k: 'Comprimento', v: '10 metros' },
      { k: 'Reforço', v: 'Trama de aço interna' },
      { k: 'Conexões', v: 'Engate rápido nas duas pontas' },
      { k: 'Proteção', v: 'Capa emborrachada com anti-dobra nas extremidades' },
      { k: 'Compatibilidade', v: 'WAP Combate e Turbo 2600' },
      { k: 'Observação', v: 'Verifique o padrão de engate do seu equipamento' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a lavadora de alta pressão.',
      comentarios: '313 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso sempre junto com a lavadora, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Mangueira Trama de Aço 10 Metros — WAP Combate e Turbo 2600 | Domus',
      description: 'O comprimento é o ganho mais óbvio: com 10 metros você contorna o carro sem parar para reposicionar a lavadora a cada lado.',
      buscas: ['mangueira trama de aço 10 m wap', 'wap-mang-10m', 'mangueira']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'mangueira-jardim-tramontina',
    card: { t: 'Mangueira Jardim Flexível Reforçada 30 m Tramontina Verde', img: 'img/relacionados/D_Q_NP_932088-MLA99464283910_112025-F.webp', sold: '+10mil vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Mangueira de Jardim Flexível Reforçada 30 Metros — Tramontina, Verde',
      nomeCurto: 'Mangueira Jardim Tramontina 30 m',
      modelo: 'TRAMONTINA-MANG-30M', sku: 'TRAMONTINA-MANG-30M',
      vendidos: '+10mil vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '6.520', categoria: CAT_ACESS
    },
    preco: { de: 249.9, por: 29.9, off: '88% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_932088-MLA99464283910_112025-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_932088-MLA99464283910_112025-F.webp'),
    bullets: [
      '30 metros de alcance a partir da torneira.',
      'Construção em 4 camadas, resistente a dobras.',
      'Flexível — enrola e guarda com facilidade.',
      'Alimenta a lavadora de alta pressão ou rega direto.',
      'Suporta até 10 bar (145 psi) e 50 °C.'
    ],
    descricao: `MANGUEIRA DE JARDIM FLEXÍVEL REFORÇADA 30 METROS — TRAMONTINA

A lavadora precisa de água chegando na entrada, e é aí que a mangueira de jardim entra. Com 30 metros, você posiciona o equipamento onde for preciso sem depender da distância até a torneira.

A construção reforçada resiste às dobras que estrangulam o fluxo — problema comum em mangueira fina, que faz a bomba trabalhar em falta d'água e reduz a vida útil do aparelho.

Fora da lavagem, serve para regar o jardim e limpar a área externa.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Tramontina' },
      { k: 'Linha', v: 'Flex' },
      { k: 'Comprimento', v: '30 metros' },
      { k: 'Cor', v: 'Verde' },
      { k: 'Construção', v: '4 camadas' },
      { k: 'Pressão suportada', v: 'Até 10 bar — 145 psi' },
      { k: 'Temperatura máxima', v: '50 °C' },
      { k: 'Uso', v: 'Alimentação de lavadora, rega e limpeza em geral' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a lavadora de alta pressão.',
      comentarios: '2173 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso sempre junto com a lavadora, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Mangueira de Jardim Flexível Reforçada 30 Metros — Tramontina, Verde | Domus',
      description: 'A lavadora precisa de água chegando na entrada, e é aí que a mangueira de jardim entra. Com 30 metros, você posiciona o equipamento onde for preciso s',
      buscas: ['mangueira jardim tramontina 30 m', 'tramontina-mang-30m', 'mangueira']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'extensao-eletrica-10m',
    card: { t: 'Extensão Elétrica 10 m Reforçada 3 Tomadas 10A/20A Bivolt', img: 'img/relacionados/D_Q_NP_643511-MLA111285869538_052026-F.webp', sold: '+10mil vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Extensão Elétrica 10 Metros Reforçada — 3 Tomadas, 10A/20A, Bivolt',
      nomeCurto: 'Extensão Elétrica 10 m Reforçada',
      modelo: 'EXT-10M-3T', sku: 'EXT-10M-3T',
      vendidos: '+10mil vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.6', avaliacoes: '4.870', categoria: CAT_ACESS
    },
    preco: { de: 119.9, por: 79.9, off: '33% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_643511-MLA111285869538_052026-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_643511-MLA111285869538_052026-F.webp'),
    bullets: [
      '10 metros — alcança a área externa sem puxar o aparelho.',
      '3 tomadas, todas em uso simultâneo.',
      'Suporta 10A e 20A, bivolt.',
      'Cabo reforçado, para uso profissional ou em obra.',
      'O cordão da lavadora tem 5 m; a extensão completa o alcance.'
    ],
    descricao: `EXTENSÃO ELÉTRICA 10 METROS REFORÇADA — 3 TOMADAS, BIVOLT

O cordão elétrico da lavadora tem 5 metros. Somando a mangueira, quase sempre falta um pouco para chegar onde você quer trabalhar. A extensão de 10 metros resolve isso.

O cabo reforçado e a capacidade de 20A são o que importa aqui: extensão fina esquenta e cai em queda de tensão, o que faz o motor da lavadora perder força e sofrer.

São 3 tomadas, úteis quando você usa lavadora e aspirador ao mesmo tempo. Confira sempre a corrente indicada na etiqueta dos aparelhos.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Comprimento', v: '10 metros' },
      { k: 'Tomadas', v: '3' },
      { k: 'Corrente', v: '10A e 20A' },
      { k: 'Tensão', v: 'Bivolt' },
      { k: 'Cabo', v: 'Reforçado' },
      { k: 'Uso', v: 'Profissional, residencial e obra' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a qualidade e o custo-benefício, e mencionam bastante o uso junto com a lavadora de alta pressão.',
      comentarios: '1623 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 142, texto: 'Chegou rápido e é exatamente o que eu esperava. Recomendo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 96, texto: 'Boa qualidade pelo preço. Já é a segunda vez que compro.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 71, texto: 'Uso sempre junto com a lavadora, faz bastante diferença.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 38, texto: 'Cumpre o que promete. Só achei a entrega um pouco demorada.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 5 meses', likes: 24, texto: 'Atendeu certinho o que eu precisava.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Extensão Elétrica 10 Metros Reforçada — 3 Tomadas, 10A/20A, Bivolt | Domus',
      description: 'O cordão elétrico da lavadora tem 5 metros. Somando a mangueira, quase sempre falta um pouco para chegar onde você quer trabalhar. A extensão de 10 me',
      buscas: ['extensão elétrica 10 m reforçada', 'ext-10m-3t', 'extensão']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'kit-multi-ferramentas-48v',
    card: { t: 'Kit Multi Ferramentas 4 em 1 48V Sem Fio com 2 Baterias e Maleta', img: 'img/relacionados/D_Q_NP_941321-MLA111648675325_052026-F.webp', sold: '+1000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Kit Multi Ferramentas 4 em 1 48V Sem Fio — Furadeira, Martelete, Esmerilhadeira e Chave de Impacto',
      nomeCurto: 'Kit Multi Ferramentas 4 em 1 48V',
      modelo: 'SIMAKE-4EM1-48V', sku: 'SIMAKE-4EM1-48V',
      vendidos: '+1000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.6', avaliacoes: '1.840', categoria: CAT_FERR
    },
    preco: { de: 799, por: 59, off: '93% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_941321-MLA111648675325_052026-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_941321-MLA111648675325_052026-F.webp'),
    bullets: [
      'Quatro ferramentas num só kit, com cabeças intercambiáveis.',
      'Furadeira, parafusadeira, martelete, esmerilhadeira e chave de impacto.',
      'Sem fio, com 2 baterias — uma trabalha enquanto a outra carrega.',
      'Maleta de transporte com espaço para os acessórios.',
      'Para uso doméstico e profissional leve.'
    ],
    descricao: `KIT MULTI FERRAMENTAS 4 EM 1 — 48V SEM FIO

O conceito é simples: um corpo motorizado e cabeças que se trocam. Em vez de comprar cinco ferramentas separadas, você tem furadeira, parafusadeira, martelete, esmerilhadeira e chave de impacto num único kit.

As duas baterias resolvem o problema clássico do sem fio: quando uma acaba, você troca e continua o trabalho enquanto a outra carrega. Não há pausa no meio do serviço.

A maleta mantém tudo junto, com espaço para as cabeças e os acessórios. Boa escolha para quem faz manutenção em casa e não quer uma bancada cheia de ferramentas soltas.

Para uso doméstico e profissional leve. Serviços pesados e contínuos pedem ferramentas dedicadas.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Simake' },
      { k: 'Tipo', v: 'Kit multi ferramentas 4 em 1' },
      { k: 'Tensão da bateria', v: '48V' },
      { k: 'Baterias inclusas', v: '2' },
      { k: 'Alimentação', v: 'Sem fio, a bateria' },
      { k: 'Funções', v: 'Furadeira, parafusadeira, martelete, esmerilhadeira e chave de impacto' },
      { k: 'Acompanha', v: 'Maleta de transporte e acessórios' },
      { k: 'Uso indicado', v: 'Doméstico e profissional leve' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a robustez e o custo-benefício, e mencionam bastante o uso em manutenção doméstica e pequenos serviços.',
      comentarios: '613 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 128, texto: 'Chegou rápido e veio bem embalado. Cumpre o que promete.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 8 meses', likes: 94, texto: 'Boa ferramenta pelo preço. Uso direto e não deu problema.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 67, texto: 'Já uso há um bom tempo, continua funcionando como no primeiro dia.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 41, texto: 'Atende bem para o meu uso. Só senti falta de um manual melhor.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 6 meses', likes: 29, texto: 'Recomendo. Custo-benefício muito bom.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Kit Multi Ferramentas 4 em 1 48V Sem Fio — Furadeira, Martelete, Esmerilhadeira e Chave de Impacto | Domus',
      description: 'O conceito é simples: um corpo motorizado e cabeças que se trocam. Em vez de comprar cinco ferramentas separadas, você tem furadeira, parafusadeira, m',
      buscas: ['kit multi ferramentas 4 em 1 48v', 'simake-4em1-48v', 'kit']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'kit-ferramentas-46-pecas',
    card: { t: 'Kit Ferramentas 46 Peças com Soquetes e Chaves — VLX Vermelho', img: 'img/relacionados/D_Q_NP_722524-MLA115953917796_092026-F.webp', sold: '+5000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Kit de Ferramentas 46 Peças com Soquetes e Chaves — Para Carro e Casa, VLX',
      nomeCurto: 'Kit Ferramentas 46 Peças VLX',
      modelo: 'VLX-KIT46', sku: 'VLX-KIT46',
      vendidos: '+5000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.6', avaliacoes: '5.210', categoria: CAT_FERR
    },
    preco: { de: 149.9, por: 39.9, off: '73% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_722524-MLA115953917796_092026-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_722524-MLA115953917796_092026-F.webp'),
    bullets: [
      '46 peças: soquetes, catraca, extensões, bits e chave Allen.',
      'Aço cromo vanádio (CRV) — resistente e durável.',
      'Serve para o carro e para a manutenção da casa.',
      'Maleta organizada — cada peça no seu lugar.',
      'Compacto: cabe no porta-malas sem ocupar espaço.',
      'Cobre a maioria das medidas do dia a dia.'
    ],
    descricao: `KIT DE FERRAMENTAS 46 PEÇAS COM SOQUETES E CHAVES — VLX

É o kit que resolve o imprevisto. As 46 peças cobrem as medidas mais comuns — soquetes, chaves, catraca e pontas — o suficiente para apertar, soltar e ajustar tanto no carro quanto em casa.

O ponto forte é a organização. Cada peça tem seu encaixe na maleta, então você vê na hora se está faltando alguma, e não perde tempo procurando.

Pelo tamanho, cabe no porta-malas e fica ali para quando precisar. Também serve bem como kit de primeira necessidade em casa, para quem não quer montar uma bancada.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'VLX' },
      { k: 'Material', v: 'Aço cromo vanádio (CRV)' },
      { k: 'Peças', v: '46' },
      { k: 'Cor', v: 'Vermelho' },
      { k: 'Conteúdo', v: 'Soquetes, catraca, extensões, barra T, bits e chave Allen' },
      { k: 'Acompanha', v: 'Maleta organizadora' },
      { k: 'Uso indicado', v: 'Carro, moto, casa e oficina' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a robustez e o custo-benefício, e mencionam bastante o uso em manutenção doméstica e pequenos serviços.',
      comentarios: '1736 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 128, texto: 'Chegou rápido e veio bem embalado. Cumpre o que promete.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 8 meses', likes: 94, texto: 'Boa ferramenta pelo preço. Uso direto e não deu problema.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 67, texto: 'Já uso há um bom tempo, continua funcionando como no primeiro dia.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 41, texto: 'Atende bem para o meu uso. Só senti falta de um manual melhor.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 6 meses', likes: 29, texto: 'Recomendo. Custo-benefício muito bom.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Kit de Ferramentas 46 Peças com Soquetes e Chaves — Para Carro e Casa, VLX | Domus',
      description: 'É o kit que resolve o imprevisto. As 46 peças cobrem as medidas mais comuns — soquetes, chaves, catraca e pontas — o suficiente para apertar, soltar e',
      buscas: ['kit ferramentas 46 peças vlx', 'vlx-kit46', 'kit']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'serra-marmore-makita',
    card: { t: 'Serra Mármore 4-3/8" 4100NH3Z 1300W Makita', img: 'img/relacionados/D_Q_NP_605349-MLA100018712599_122025-F.webp', sold: '+500 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Serra Mármore Makita 4100NH3Z — 4-3/8 Polegadas, 1.300 W',
      nomeCurto: 'Serra Mármore Makita 4100NH3Z',
      modelo: 'MAKITA-4100NH3Z', sku: 'MAKITA-4100NH3Z',
      vendidos: '+500 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.8', avaliacoes: '2.360', categoria: CAT_FERR
    },
    preco: { de: 749, por: 23.1, off: '97% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_605349-MLA100018712599_122025-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_605349-MLA100018712599_122025-F.webp'),
    bullets: [
      'Motor de 1.300 W para corte contínuo em material duro.',
      'Disco de 4-3/8 polegadas (110 mm).',
      'Corta mármore, granito, porcelanato e cerâmica.',
      'Makita — referência em ferramenta elétrica profissional.',
      'Uso profissional, aguenta jornada de obra.'
    ],
    descricao: `SERRA MÁRMORE MAKITA 4100NH3Z — 1.300 W

Ferramenta de obra, não de fim de semana. Os 1.300 W entregam torque para cortar mármore, granito, porcelanato e cerâmica sem o motor perder rotação no meio do corte — que é onde a ferramenta barata trava e lasca a peça.

O disco de 4-3/8 polegadas é o padrão para rodapé, soleira e recorte de piso, o serviço mais comum de acabamento.

A Makita é referência no segmento profissional justamente pela durabilidade do motor sob uso contínuo. Se você corta pedra com frequência, é o tipo de compra que se paga.

Use sempre proteção ocular e respiratória: o corte a seco gera muito pó.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Makita' },
      { k: 'Modelo', v: '4100NH3Z' },
      { k: 'Potência', v: '1.300 W' },
      { k: 'Disco', v: '4-3/8 polegadas — 110 mm' },
      { k: 'Materiais', v: 'Mármore, granito, porcelanato e cerâmica' },
      { k: 'Uso indicado', v: 'Profissional' },
      { k: 'Segurança', v: 'Exige proteção ocular e respiratória' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a robustez e o custo-benefício, e mencionam bastante o uso em manutenção doméstica e pequenos serviços.',
      comentarios: '786 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 128, texto: 'Chegou rápido e veio bem embalado. Cumpre o que promete.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 8 meses', likes: 94, texto: 'Boa ferramenta pelo preço. Uso direto e não deu problema.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 67, texto: 'Já uso há um bom tempo, continua funcionando como no primeiro dia.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 41, texto: 'Atende bem para o meu uso. Só senti falta de um manual melhor.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 6 meses', likes: 29, texto: 'Recomendo. Custo-benefício muito bom.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Serra Mármore Makita 4100NH3Z — 4-3/8 Polegadas, 1.300 W | Domus',
      description: 'Ferramenta de obra, não de fim de semana. Os 1.300 W entregam torque para cortar mármore, granito, porcelanato e cerâmica sem o motor perder rotação n',
      buscas: ['serra mármore makita 4100nh3z', 'makita-4100nh3z', 'serra']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'inversora-solda-mig-130a',
    card: { t: 'Máquina Inversora de Solda MIG sem Gás 130A 3 em 1 TIG Lift', img: 'img/relacionados/D_Q_NP_757497-MLA102161920445_122025-F.webp', sold: '+1000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Máquina Inversora de Solda MIG sem Gás 130A — 3 em 1 com TIG Lift e Acessórios',
      nomeCurto: 'Inversora de Solda MIG 130A 3 em 1',
      modelo: 'TBT-MIG130-3EM1', sku: 'TBT-MIG130-3EM1',
      vendidos: '+1000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.6', avaliacoes: '1.470', categoria: CAT_FERR
    },
    preco: { de: 899, por: 97.76, off: '89% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_757497-MLA102161920445_122025-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_757497-MLA102161920445_122025-F.webp'),
    bullets: [
      'Três processos numa máquina: MIG, eletrodo e TIG Lift.',
      'MIG sem gás — usa arame tubular, dispensa cilindro.',
      '130 A de corrente, suficiente para chapa fina e média.',
      'Tecnologia inversora: leve e de baixo consumo.',
      'Acompanha máscara, luvas, arame tubular e os dois cabos.'
    ],
    descricao: `MÁQUINA INVERSORA DE SOLDA MIG SEM GÁS 130A — 3 EM 1

Três processos no mesmo equipamento: MIG, eletrodo revestido e TIG Lift. Na prática, você atende do portão de casa ao reparo em chapa fina sem trocar de máquina.

O detalhe que mais pesa é o MIG sem gás. Usando arame tubular, você dispensa o cilindro de gás — sem aluguel, sem recarga, sem transporte de cilindro. Para quem solda esporadicamente, muda toda a conta.

Os 130 A dão conta de chapa fina e média, faixa da maioria dos serviços domésticos e de pequena oficina. A tecnologia inversora deixa o equipamento leve e reduz o consumo em relação às máquinas de transformador.

Acompanha máscara de solda, luvas, um rolo de arame tubular, cabo de garra e cabo porta-eletrodo — dá para começar sem comprar mais nada. Ainda assim, solda exige EPI adequado: máscara de escurecimento automático, luvas e avental.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'The Black Tools' },
      { k: 'Modelo', v: 'ILM130' },
      { k: 'Processos', v: 'MIG, eletrodo e TIG Lift' },
      { k: 'Corrente máxima', v: '130 A' },
      { k: 'MIG', v: 'Sem gás, com arame tubular' },
      { k: 'Tecnologia', v: 'Inversora' },
      { k: 'Cor', v: 'Amarelo' },
      { k: 'Acompanha', v: 'Máscara de solda, luvas, arame tubular, cabo de garra e cabo porta-eletrodo' },
      { k: 'Segurança', v: 'Exige máscara, luvas e avental' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores destacam a robustez e o custo-benefício, e mencionam bastante o uso em manutenção doméstica e pequenos serviços.',
      comentarios: '490 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 3 meses', likes: 128, texto: 'Chegou rápido e veio bem embalado. Cumpre o que promete.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 8 meses', likes: 94, texto: 'Boa ferramenta pelo preço. Uso direto e não deu problema.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 67, texto: 'Já uso há um bom tempo, continua funcionando como no primeiro dia.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 41, texto: 'Atende bem para o meu uso. Só senti falta de um manual melhor.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 6 meses', likes: 29, texto: 'Recomendo. Custo-benefício muito bom.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Máquina Inversora de Solda MIG sem Gás 130A — 3 em 1 com TIG Lift e Acessórios | Domus',
      description: 'Três processos no mesmo equipamento: MIG, eletrodo revestido e TIG Lift. Na prática, você atende do portão de casa ao reparo em chapa fina sem trocar ',
      buscas: ['inversora de solda mig 130a 3 em 1', 'tbt-mig130-3em1', 'máquina']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'capacete-norisk-razor',
    card: { t: 'Capacete Moto Norisk Razor Preto Brilho — Monocolor', img: 'img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp', sold: '+5000 vendidos', tag: 'Tam. 56', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Capacete Moto Norisk Razor Preto Brilho — Fechado, Monocolor',
      nomeCurto: 'Capacete Norisk Razor Preto',
      modelo: 'NORISK-RAZOR-56', sku: 'NORISK-RAZOR-56',
      vendidos: '+5000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.7', avaliacoes: '6.180', categoria: CAT_MOTO
    },
    preco: { de: 349, por: 59.3, off: '83% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp'],
    variante: { rotulo: 'Tamanho', opcoes: [{ label: '56', img: 'img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp' }, { label: '58', img: 'img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp' }, { label: '60', img: 'img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp' }, { label: '62', img: 'img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp' }] },
    bullets: [
      'Capacete fechado, viseira fumê e certificação Inmetro.',
      'Acabamento preto brilho, sem grafismo.',
      'Forro interno removível e lavável.',
      'Fivela de engate rápido.',
      'Disponível do 56 ao 62 — meça a cabeça antes de escolher.'
    ],
    descricao: `CAPACETE MOTO NORISK RAZOR — PRETO BRILHO

Capacete fechado de linha básica, para quem quer proteção com certificação Inmetro sem pagar por grafismo. O acabamento preto brilho é monocolor, então combina com qualquer moto e não desvaloriza com o tempo.

O forro interno sai para lavar — detalhe que faz diferença em quem usa a moto todo dia, porque suor acumulado é o que mais deteriora o interior do capacete.

A fivela é de engate rápido, mais prática no dia a dia que o sistema de argolas.

COMO ESCOLHER O TAMANHO
Meça a circunferência da cabeça com uma fita métrica, na altura da testa, logo acima das sobrancelhas. O número em centímetros é o tamanho do capacete. Na dúvida entre dois, prefira o menor: o forro cede um pouco com o uso.

Capacete é item de segurança. Se sofrer impacto, deve ser substituído mesmo sem dano aparente.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Norisk' },
      { k: 'Modelo', v: 'Razor' },
      { k: 'Tipo', v: 'Fechado (full face)' },
      { k: 'Cor', v: 'Preto brilho' },
      { k: 'Desenho', v: 'Monocolor' },
      { k: 'Tamanhos', v: '56, 58, 60 e 62' },
      { k: 'Forro', v: 'Removível e lavável' },
      { k: 'Viseira', v: 'Fumê' },
      { k: 'Fivela', v: 'Engate rápido' },
      { k: 'Certificação', v: 'Inmetro' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores elogiam o conforto e o acabamento, e recomendam medir a cabeça antes de escolher a numeração.',
      comentarios: '2060 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 4 meses', likes: 156, texto: 'Chegou certinho no tamanho e é confortável de usar o dia todo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 9 meses', likes: 103, texto: 'Ótimo pelo preço. Acabamento bem melhor do que eu esperava.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 78, texto: 'Uso todo dia no trabalho e continua como novo.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 44, texto: 'Bom produto. Só demorei a acertar o tamanho, vale medir antes.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 31, texto: 'Recomendo, entrega rápida e produto original.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Capacete Moto Norisk Razor Preto Brilho — Fechado, Monocolor | Domus',
      description: 'Capacete fechado de linha básica, para quem quer proteção com certificação Inmetro sem pagar por grafismo. O acabamento preto brilho é monocolor, entã',
      buscas: ['capacete norisk razor preto', 'norisk-razor-56', 'capacete moto']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'capacete-norisk-ff302-grand-prix',
    card: { t: 'Capacete Norisk FF302 Soul 2 Grand Prix Países', img: 'img/relacionados/D_Q_NP_839485-MLB116554778715_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp', sold: '+1000 vendidos', tag: 'Tam. 56 ao 62 · 4 estampas', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Capacete Norisk FF302 Soul 2 — Grand Prix Países, Fechado com Viseira Solar',
      nomeCurto: 'Capacete Norisk FF302 Grand Prix',
      modelo: 'NORISK-FF302-GP', sku: 'NORISK-FF302-GP',
      vendidos: '+1000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.8', avaliacoes: '3.420', categoria: CAT_MOTO
    },
    preco: { de: 649, por: 69.7, off: '89% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_839485-MLB116554778715_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp', 'img/relacionados/D_Q_NP_809215-MLB116554625473_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp', 'img/relacionados/D_Q_NP_608969-MLB116554624717_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp', 'img/relacionados/D_Q_NP_986768-MLB116876275387_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp'],
    variante: { rotulo: 'Estampa', opcoes: [
      { label: 'Brasil', img: 'img/relacionados/D_Q_NP_839485-MLB116554778715_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp' },
      { label: 'Reino Unido', img: 'img/relacionados/D_Q_NP_809215-MLB116554625473_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp' },
      { label: 'França', img: 'img/relacionados/D_Q_NP_608969-MLB116554624717_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp' },
      { label: 'Itália', img: 'img/relacionados/D_Q_NP_986768-MLB116876275387_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp' }
    ] },
    bullets: [
      'Quatro estampas: Brasil, Reino Unido, França e Itália.',
      'Viseira solar interna retrátil, acionada por alavanca.',
      'Casco em termoplástico de alta resistência.',
      'Forro removível e lavável, com canais de ventilação.',
      'Certificação Inmetro. Do 56 ao 62.'
    ],
    descricao: `CAPACETE NORISK FF302 SOUL 2 — GRAND PRIX PAÍSES

A linha Grand Prix Países traz grafismo inspirado em bandeiras, e é a versão mais procurada do FF302 justamente pelo visual.

O diferencial funcional é a viseira solar interna. Em vez de trocar de viseira ou usar óculos escuros por baixo, você aciona uma alavanca e a viseira fumê desce. Ao entrar num túnel ou anoitecer, recolhe. Quem pilota de dia sente a diferença logo na primeira semana.

O casco é em termoplástico de alta resistência, com canais de ventilação que ajudam no calor. O forro sai para lavar.

AS QUATRO ESTAMPAS
A linha Grand Prix Países sai em Brasil, Reino Unido, França e Itália. O casco e a estrutura são os mesmos — muda só o grafismo, que segue as cores da bandeira.

COMO ESCOLHER O TAMANHO
Meça a circunferência da cabeça na altura da testa. O número em centímetros é o tamanho. Na dúvida entre dois, prefira o menor.

Capacete é item de segurança. Após qualquer impacto, substitua.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Norisk' },
      { k: 'Modelo', v: 'FF302 Soul 2' },
      { k: 'Linha', v: 'Grand Prix Países' },
      { k: 'Estampas', v: 'Brasil, Reino Unido, França e Itália' },
      { k: 'Tipo', v: 'Fechado (full face)' },
      { k: 'Viseira solar interna', v: 'Sim, retrátil' },
      { k: 'Casco', v: 'Termoplástico de alta resistência' },
      { k: 'Tamanhos', v: '56, 58, 60 e 62' },
      { k: 'Forro', v: 'Removível e lavável' },
      { k: 'Ventilação', v: 'Canais de entrada e saída de ar' },
      { k: 'Certificação', v: 'Inmetro' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores elogiam o conforto e o acabamento, e recomendam medir a cabeça antes de escolher a numeração.',
      comentarios: '1140 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 4 meses', likes: 156, texto: 'Chegou certinho no tamanho e é confortável de usar o dia todo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 9 meses', likes: 103, texto: 'Ótimo pelo preço. Acabamento bem melhor do que eu esperava.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 78, texto: 'Uso todo dia no trabalho e continua como novo.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 44, texto: 'Bom produto. Só demorei a acertar o tamanho, vale medir antes.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 31, texto: 'Recomendo, entrega rápida e produto original.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Capacete Norisk FF302 Soul 2 — Grand Prix Países, Fechado com Viseira Solar | Domus',
      description: 'A linha Grand Prix Países traz grafismo inspirado em bandeiras, e é a versão mais procurada do FF302 justamente pelo visual.',
      buscas: ['capacete norisk ff302 grand prix', 'norisk-ff302-gp', 'capacete moto']
    }
  },
  /* ---------------------------------------------------------------- */
  {
    slug: 'fone-bluetooth-capacete',
    card: { t: 'Fone de Ouvido Bluetooth para Capacete de Moto — Headset RGB Kateluo', img: 'img/relacionados/D_Q_NP_705128-MLA116671814177_082026-F.webp', sold: '+5000 vendidos', ship: true, full: true, pix: false },
    produto: {
      titulo: 'Fone de Ouvido Bluetooth para Capacete de Moto — Headset Sem Fio com RGB, Kateluo',
      nomeCurto: 'Fone Bluetooth para Capacete Kateluo',
      modelo: 'KATELUO-HEADSET-BT', sku: 'KATELUO-HEADSET-BT',
      vendidos: '+5000 vendidos', badge: 'Mais vendido', badgeLink: 'Escolha popular',
      nota: '4.6', avaliacoes: '4.930', categoria: CAT_MOTO
    },
    preco: { de: 199.9, por: 12.9, off: '94% OFF', parcelas: 12, cupom: 'Frete grátis acima de R$ 79', freteGratis: true },
    fotos: ['img/relacionados/D_Q_NP_705128-MLA116671814177_082026-F.webp'],
    variante: V127('img/relacionados/D_Q_NP_705128-MLA116671814177_082026-F.webp'),
    bullets: [
      'Bluetooth sem fio — atende chamadas sem tirar as mãos do guidão.',
      'Alto-falantes finos, feitos para caber na concha do capacete.',
      'Iluminação RGB, que aumenta a visibilidade à noite.',
      'Botões de volume e microfone, com indicador de bateria.',
      'Instala em capacete fechado ou escamoteável.'
    ],
    descricao: `FONE DE OUVIDO BLUETOOTH PARA CAPACETE DE MOTO — HEADSET RGB

Resolve o problema de quem trabalha na moto: atender o aplicativo, ouvir a navegação e receber chamada sem parar e sem tirar a mão do guidão.

Os alto-falantes são finos de propósito, para encaixar na concha do capacete sem pressionar a orelha em viagem longa. O microfone vem em haste, o que melhora a captação de voz contra o vento em relação aos modelos embutidos.

A iluminação RGB é o extra: além do visual, aumenta a visibilidade lateral à noite, quando o motociclista é menos percebido no trânsito.

Instala em capacete fechado ou escamoteável, com fixação adesiva ou por encaixe.

Atenção: em alguns estados o uso de fone na condução é regulamentado. Confira a legislação local antes de usar.

Aviso: preço e imagem ainda precisam ser conferidos no anúncio.`,
    specs: [
      { k: 'Marca', v: 'Kateluo' },
      { k: 'Modelo', v: 'V10' },
      { k: 'Tipo', v: 'Headset Bluetooth para capacete' },
      { k: 'Conexão', v: 'Bluetooth sem fio' },
      { k: 'Microfone', v: 'Com haste' },
      { k: 'Iluminação', v: 'RGB no painel lateral' },
      { k: 'Controles', v: 'Volume, microfone e indicador de bateria' },
      { k: 'Instalação', v: 'Capacete fechado ou escamoteável' },
      { k: 'Uso', v: 'Chamadas, navegação e áudio' }
    ],
    avaliacoes: {
      resumoIA: 'Os compradores elogiam o conforto e o acabamento, e recomendam medir a cabeça antes de escolher a numeração.',
      comentarios: '1643 comentários',
      lista: [
        { nota: 5, pais: 'Brasil', quando: 'Há 4 meses', likes: 156, texto: 'Chegou certinho no tamanho e é confortável de usar o dia todo.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 9 meses', likes: 103, texto: 'Ótimo pelo preço. Acabamento bem melhor do que eu esperava.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 78, texto: 'Uso todo dia no trabalho e continua como novo.', fotos: [] },
        { nota: 4, pais: 'Brasil', quando: 'Há 2 meses', likes: 44, texto: 'Bom produto. Só demorei a acertar o tamanho, vale medir antes.', fotos: [] },
        { nota: 5, pais: 'Brasil', quando: 'Há 7 meses', likes: 31, texto: 'Recomendo, entrega rápida e produto original.', fotos: [] }
      ]
    },
    bump: 'portatil',
    seo: {
      title: 'Fone de Ouvido Bluetooth para Capacete de Moto — Headset Sem Fio com RGB, Kateluo | Domus',
      description: 'Resolve o problema de quem trabalha na moto: atender o aplicativo, ouvir a navegação e receber chamada sem parar e sem tirar a mão do guidão.',
      buscas: ['fone bluetooth para capacete kateluo', 'kateluo-headset-bt', 'capacete moto']
    }
  }
];

/* ---------------- order bumps por família de produto ---------------- */
const BUMPS = {
  ar: [
    { t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', p: 19.9, old: 59.9, img: 'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp' },
    { t: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus', p: 27.9, old: 129.9, img: 'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp' }
  ],
  portatil: [
    { t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', p: 19.9, old: 59.9, img: 'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp' },
    { t: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus', p: 27.9, old: 129.9, img: 'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp' }
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
    t: p.nomeCurto || p.titulo || 'Lavadora de Alta Pressão Vonder LAV 1300',
    p: Number(pr.por) || 0, old: Number(pr.de) || 0, off: pr.off || '',
    sold: p.vendidos || '', img: (main && main.fotos && main.fotos[0]) || 'img/produto/D_Q_NP_651172-MLB98386075371_112025-F-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.webp',
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
      itens: BUMPS[pg.bump] || BUMPS.tool
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
  return fotosDoFeed(fotos, base)[0] || absoluta('img/produto/D_Q_NP_651172-MLB98386075371_112025-F-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.webp', base);
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
