/* =========================================================
   Editor da oferta — conteúdo da loja em um único JSON.
   A loja lê /api/offer.json; o editor grava por /api/admin/offer.
   ========================================================= */
'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UP_DIR   = path.join(DATA_DIR, 'uploads');
const OFFER_DB = path.join(DATA_DIR, 'offer.json');

for (const d of [DATA_DIR, UP_DIR]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

/* ---------- conteúdo padrão (o que está na loja hoje) ---------- */
const DEFAULT = {
  produto: {
    titulo: 'Bicicleta Elétrica V9 Max 60km Autonomia Urbana 32km/h',
    nomeCurto: 'Bicicleta Elétrica V9 Max',
    marca: 'Inow',
    modelo: 'V9 Max',
    sku: 'V9MAX-1000W',
    vendedor: 'Domus',
    vendedorVendas: '+250 mil vendas',
    condicao: 'Novo',
    vendidos: '+5 mil vendidos',
    badge: 'Mais vendido',
    badgeLink: "1º em Bicicletas Elétricas",
    nota: "5.0",
    avaliacoes: "18",
    categoria: ["Esportes e Fitness", "Ciclismo", "Bicicletas", "Bicicletas Elétricas"]
  },
  preco: {
    de: 1189.9,
    por: 189.75,
    off: '84% OFF',
    parcelas: 12,
    parcelaValor: 20.83,
    cupom: 'Desconto de R$ 20 no cupom',
    freteGratis: true
  },
  fotos: [
    'img/produto/bicicleta-eletrica-v9-max-1.webp',
    'img/produto/bicicleta-eletrica-v9-max-2.webp',
    'img/produto/bicicleta-eletrica-v9-max-3.webp',
    'img/produto/bicicleta-eletrica-v9-max-4.webp',
    'img/produto/bicicleta-eletrica-v9-max-5.webp'
  ],
  variante: {
    rotulo: 'Cor',
    opcoes: [
      { label: 'Preto', img: 'img/produto/bicicleta-eletrica-v9-max-1.webp' }
    ]
  },
  bullets: [
    "Motor de 1.000 W limitado a 32 km/h: não exige CNH nem emplacamento.",
    "Bateria de lítio 48V 15.6Ah com até 60 km de autonomia por carga.",
    "Freios hidráulicos a disco e suspensão dupla.",
    "Alarme com controle remoto, cartão NFC e trava da roda dianteira."
  ],
  descricao: `BICICLETA ELÉTRICA V9 MAX — ATÉ 60 KM DE AUTONOMIA, 32 KM/H, SEM CNH E SEM PLACA

A V9 Max é uma bicicleta elétrica feita para o deslocamento urbano: ir ao trabalho, à faculdade, fazer entregas ou resolver o dia a dia sem gastar com combustível, estacionamento ou transporte por aplicativo. O motor de 1.000 W responde com força nas subidas e mantém velocidade constante mesmo com carga. A velocidade é limitada eletronicamente a 32 km/h, o que enquadra o modelo como veículo autopropelido: não exige CNH, emplacamento nem IPVA (Resolução CONTRAN 996/2023).

A bateria de lítio 48V 15.6Ah entrega até 60 km por carga no modo elétrico. Pedalando com assistência, a autonomia aumenta. A recarga é feita em qualquer tomada comum, bivolt, e leva de 6 a 8 horas: carregue durante a noite e saia com carga cheia. A autonomia real varia com o peso do condutor, o relevo, a calibragem dos pneus e o modo de condução.

O conforto vem da suspensão dupla, com garfo amortecido na frente e amortecedores duplos na traseira, e dos pneus largos de 20 x 4 polegadas, que absorvem buracos, guias e piso irregular. O banco alongado com pedaleiras leva garupa, e o conjunto suporta até 150 kg.

Segurança em cada trajeto: freios hidráulicos a disco nas duas rodas, farol de LED de alta intensidade, alarme integrado com controle remoto, desbloqueio por cartão NFC e trava da roda dianteira contra furto. O câmbio Shimano de 7 marchas ajuda a pedalar quando quiser economizar bateria.

CONTEÚDO DA EMBALAGEM
1 bicicleta elétrica V9 Max, 1 carregador bivolt, 1 kit de ferramentas para montagem, 1 manual de instruções, 1 controle do alarme, 1 retrovisor (lado esquerdo), 1 cartão NFC e 1 bolsa porta-celular para o guidão. A bicicleta chega parcialmente montada: guidão, pedais e retrovisor são fixados com o kit incluso.

ESPECIFICAÇÕES TÉCNICAS
• Motor: 1.000 W
• Bateria: Lítio 48V 15.6Ah, com chave
• Autonomia: Até 60 km por carga
• Velocidade máxima: 32 km/h (limitada eletronicamente)
• Tempo de recarga: 6 a 8 horas
• Carregador: Bivolt 110/220V
• Aro: 20"
• Pneus: 20 x 4 polegadas (fat)
• Marchas: 7 velocidades Shimano
• Freios: Hidráulicos a disco, dianteiro e traseiro
• Suspensão: Dupla: garfo dianteiro e amortecedores traseiros
• Carga máxima: 150 kg
• Peso: aprox. 42 kg
• Farol: LED
• Segurança: alarme com controle, cartão NFC e trava da roda dianteira
• Garantia: 6 meses

Veículo autopropelido conforme Resolução CONTRAN 996/2023. Desbloquear a velocidade tira o modelo dessa categoria e passa a exigir CNH e emplacamento.`,
  specs: [
    { k: 'Marca', v: 'Inow' },
    { k: 'Modelo', v: 'V9 Max' },
    { k: 'Edição', v: '2026' },
    { k: 'Tipo', v: 'Bicicleta elétrica urbana (autopropelida)' },
    { k: 'Cor', v: 'Preto' },
    { k: 'Motor', v: '1.000 W' },
    { k: 'Bateria', v: 'Lítio 48V 15.6Ah, com chave' },
    { k: 'Autonomia', v: 'Até 60 km por carga' },
    { k: 'Velocidade máxima', v: '32 km/h (limitada eletronicamente)' },
    { k: 'Tempo de recarga', v: '6 a 8 horas' },
    { k: 'Carregador', v: 'Bivolt 110/220V' },
    { k: 'Aro', v: "20\"" },
    { k: 'Pneus', v: '20 x 4 polegadas (fat)' },
    { k: 'Marchas', v: '7 velocidades Shimano' },
    { k: 'Freios', v: 'Hidráulicos a disco, dianteiro e traseiro' },
    { k: 'Suspensão', v: 'Dupla: garfo dianteiro e amortecedores traseiros' },
    { k: 'Farol', v: 'LED de alta intensidade' },
    { k: 'Painel', v: 'Display digital no guidão' },
    { k: 'Alarme', v: 'Integrado, com controle remoto' },
    { k: 'Desbloqueio', v: 'Cartão NFC' },
    { k: 'Trava antifurto', v: 'Trava da roda dianteira' },
    { k: 'Retrovisor', v: 'Lado esquerdo' },
    { k: 'Banco', v: 'Alongado, com pedaleiras para garupa' },
    { k: 'Capacidade de carga', v: 'Até 150 kg' },
    { k: 'Peso da bicicleta', v: 'Aprox. 42 kg' },
    { k: 'Quadro', v: 'Aço reforçado, não dobrável' },
    { k: 'Exige CNH ou placa', v: 'Não (Resolução CONTRAN 996/2023)' },
    { k: 'Itens inclusos', v: 'Carregador, kit de ferramentas, manual, controle do alarme, retrovisor esquerdo, cartão NFC e bolsa porta-celular' },
    { k: 'Garantia', v: '6 meses de garantia de fábrica' }
  ],
  avaliacoes: {
    resumoIA: 'Os compradores elogiam a qualidade da bicicleta e dizem que ela atendeu às expectativas. Destacam a entrega antes do prazo, o vendedor atencioso para tirar dúvidas e a facilidade de encontrar peças para manutenção e upgrade.',
    comentarios: '13 comentários',
    lista: [
      { nota: 5, pais: 'Brasil', quando: 'Há 3 semanas', likes: 19, texto: '', fotos: ["img/opinioes/v9max-op-1-detalhe.webp"] },
      { nota: 5, pais: 'Brasil', quando: 'Há 1 semana', likes: 13, texto: 'Umas das melhores compras que já fiz! Excelente qualidade. Fácil achar peças para manutenção e upgrade.', fotos: ["img/opinioes/v9max-op-2-traseira.webp", "img/opinioes/v9max-op-2-frente.webp"] },
      { nota: 5, pais: 'Brasil', quando: 'Há 1 semana', likes: 7, texto: 'Nesse primeiro momento eu vou dar 5 estrelas, pois a bicicleta chegou um dia antes do prazo. O vendedor foi solícito em tirar minhas dúvidas.', fotos: ["img/opinioes/v9max-op-3-caixa.webp", "img/opinioes/v9max-op-3-embalada.webp"] },
      { nota: 5, pais: 'Brasil', quando: 'Há 2 semanas', likes: 6, texto: 'Gostei d+.', fotos: ["img/opinioes/v9max-op-4-quintal.webp"] },
      { nota: 5, pais: 'Brasil', quando: 'Há 2 semanas', likes: 6, texto: 'Produto muito bom, foi exatamente o que eu precisava, atendeu minhas expectativas.', fotos: [] }
    ]
  },
  relacionados: [
    { t: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica MBE4015', p: 14.9, old: 149.9, off: '90% OFF', sold: '+1000 vendidos', img: 'img/relacionados/carregador-48v-2ah.webp', ship: true, full: true, pix: false },
    { t: 'Patinete Elétrico GM5 P1 Preto Dobrável com Bluetooth 25 km/h e 22 km de Autonomia', p: 87.67, old: 1260, off: '93% OFF', sold: '+500 vendidos', img: 'img/relacionados/patinete-eletrico-gm5-p1.webp', ship: true, full: true, pix: false },
    { t: 'Bicicleta Elétrica Cavalletta C2 750W Bateria Removível 48V 20Ah 65 km', p: 127.65, old: 6097, off: '98% OFF', sold: '+100 vendidos', img: 'img/relacionados/bicicleta-eletrica-cavalletta-c2.webp', ship: true, full: true, pix: false },
    { t: 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB', p: 19.9, old: 139.99, off: '86% OFF', sold: '+5000 vendidos', tag: 'Tam. M e G', img: 'img/relacionados/capacete-gta-start-led.webp', ship: true, full: false, pix: false },
    { t: 'Mini Compressor Digital Rezzet Portátil com Calibrador para Carro, Bicicleta e Moto', p: 22.6, old: 119.9, off: '81% OFF', sold: '+5000 vendidos', img: 'img/relacionados/mini-compressor-rezzet.webp', ship: true, full: true, pix: false },
    { t: 'Caixa de Som JBL Boombox 4 Bluetooth 210W IP68 até 34h de Bateria Preta', p: 99.9, old: 2469, off: '96% OFF', sold: '+500 vendidos', img: 'img/relacionados/caixa-de-som-jbl-boombox-4.webp', ship: true, full: true, pix: false }
  ],
  orderBump: {
    titulo: 'Oferta especial antes de finalizar!',
    sub: 'Adicione ao seu pedido com frete grátis incluso',
    itens: [
      { t: 'Carregador 48V 54,6V 2Ah para Bicicleta e Scooter Elétrica MBE4015', p: 14.9, old: 149.9, img: 'img/relacionados/carregador-48v-2ah.webp' },
      { t: 'Capacete GTA Start com Pisca LED Sinalizador para Ciclismo e MTB', p: 19.9, old: 139.99, img: 'img/relacionados/capacete-gta-start-led.webp' },
      { t: 'Mini Compressor Digital Rezzet Portátil com Calibrador para Carro, Bicicleta e Moto', p: 22.6, old: 119.9, img: 'img/relacionados/mini-compressor-rezzet.webp' }
    ]
  },
  ofertaSaida: {
    titulo: 'ESPERA! Não vá embora…',
    sub: 'Liberamos uma condição exclusiva só pra você agora',
    chamada: 'Leve a Bicicleta Elétrica V9 Max + Carregador 48V 2Ah + Capacete GTA Start LED, tudo por R$ 99,90',
    preco: 99.9,
    brindeTitulo: 'GRÁTIS: Carregador 48V 2Ah + Capacete GTA Start LED',
    brindeTexto: 'Os 2 brindes já entram separados no seu pedido — sem custo nenhum.',
    imgProduto: ['img/produto/bicicleta-eletrica-v9-max-1.webp'],
    imgBrindes: ['img/relacionados/carregador-48v-2ah.webp', 'img/relacionados/capacete-gta-start-led.webp'],
    brindes: [
      { t: 'Carregador 48V 2Ah MBE4015 (Brinde)', img: 'img/relacionados/carregador-48v-2ah.webp' },
      { t: 'Capacete GTA Start LED (Brinde)', img: 'img/relacionados/capacete-gta-start-led.webp' }
    ]
  },
  seo: {
    title: 'Bicicleta Elétrica V9 Max 60km Autonomia Urbana 32km/h | Domus',
    description: 'Bicicleta Elétrica V9 Max: motor 1.000 W, bateria 48V 15.6Ah, até 60 km de autonomia, 32 km/h sem CNH, freios hidráulicos, alarme e cartão NFC. Frete grátis.',
    buscas: ["bicicleta eletrica", "bike eletrica v9 max", "bicicleta eletrica 1000w", "bicicleta eletrica 60km", "bike eletrica sem cnh", "v9 max"]
  }
};

function load() {
  try { return Object.assign({}, DEFAULT, JSON.parse(fs.readFileSync(OFFER_DB, 'utf8'))); }
  catch (_) { return JSON.parse(JSON.stringify(DEFAULT)); }
}
function save(obj) {
  fs.writeFileSync(OFFER_DB, JSON.stringify(obj, null, 2));
  return obj;
}

let offer = load();

/* uma revisão muda a cada save: a loja usa para furar cache */
let rev = Date.now().toString(36);

const MIME = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif', 'image/svg+xml':'svg' };

function mount(app, auth) {
  /* ---- público: a loja lê daqui ---- */
  app.get('/api/offer.json', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(Object.assign({ _rev: rev }, offer));
  });

  /* ---- imagens enviadas pelo editor ---- */
  app.get('/uploads/:file', (req, res) => {
    const f = path.basename(req.params.file);
    const p = path.join(UP_DIR, f);
    if (!fs.existsSync(p)) return res.sendStatus(404);
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(p);
  });

  /* ---- editor: ler ---- */
  app.get('/api/admin/offer', auth, (_req, res) => res.json(offer));

  /* ---- editor: gravar ---- */
  app.put('/api/admin/offer', auth, (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Conteúdo inválido' });
    try {
      // backup da versão anterior antes de sobrescrever
      if (fs.existsSync(OFFER_DB)) {
        fs.copyFileSync(OFFER_DB, path.join(DATA_DIR, 'offer.backup.json'));
      }
      offer = save(body);
      rev = Date.now().toString(36);
      res.json({ ok: true, rev });
    } catch (e) {
      res.status(500).json({ error: 'Não foi possível gravar: ' + e.message });
    }
  });

  /* ---- editor: desfazer último save ---- */
  app.post('/api/admin/offer/undo', auth, (_req, res) => {
    const bak = path.join(DATA_DIR, 'offer.backup.json');
    if (!fs.existsSync(bak)) return res.status(404).json({ error: 'Nenhuma versão anterior guardada' });
    fs.copyFileSync(bak, OFFER_DB);
    offer = load(); rev = Date.now().toString(36);
    res.json({ ok: true, rev });
  });

  /* ---- editor: voltar ao conteúdo original ---- */
  app.post('/api/admin/offer/reset', auth, (_req, res) => {
    offer = save(JSON.parse(JSON.stringify(DEFAULT)));
    rev = Date.now().toString(36);
    res.json({ ok: true, rev });
  });

  /* ---- upload de imagem (base64 vindo do navegador) ---- */
  app.post('/api/admin/upload', auth, (req, res) => {
    const { dataUrl } = req.body || {};
    const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
    if (!m) return res.status(400).json({ error: 'Envie uma imagem válida.' });
    const ext = MIME[m[1]];
    if (!ext) return res.status(400).json({ error: 'Formato não aceito. Use PNG, JPG, WEBP, GIF ou SVG.' });
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) return res.status(413).json({ error: 'Imagem acima de 8 MB.' });
    const name = crypto.randomBytes(8).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UP_DIR, name), buf);
    res.json({ ok: true, url: '/uploads/' + name });
  });

  /* ---- lista o que já foi enviado ---- */
  app.get('/api/admin/uploads', auth, (_req, res) => {
    const files = fs.readdirSync(UP_DIR)
      .map(f => ({ url: '/uploads/' + f, t: fs.statSync(path.join(UP_DIR, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t).slice(0, 200);
    res.json(files);
  });

  app.get('/admin/editor', (_req, res) => { res.set('Cache-Control', 'no-store'); res.sendFile(path.join(__dirname, 'editor.html')); });
}

module.exports = { mount, DEFAULT, get: () => offer, rev: () => rev };
