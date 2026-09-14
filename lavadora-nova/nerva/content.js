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
    titulo: 'Lavadora De Alta Pressão Lav1300 Libras Vonder 1.300lbf',
    nomeCurto: 'Lavadora de Alta Pressão Vonder LAV 1300',
    marca: 'Vonder',
    modelo: 'LAV 1300',
    sku: 'VONDER-LAV1300',
    vendedor: 'Domus',
    vendedorVendas: '+250 mil vendas',
    condicao: 'Novo',
    vendidos: '+5 mil vendidos',
    badge: 'Mais vendido',
    badgeLink: '2º em Lavadoras de Alta Pressão',
    nota: '4.7',
    avaliacoes: '1.312',
    categoria: ['Ferramentas', 'Ferramentas Elétricas', 'Lavadoras e Acessórios', 'Lavadoras de Alta Pressão']
  },
  preco: {
    de: 416.3,
    por: 67.88,
    off: '84% OFF',
    parcelas: 12,
    parcelaValor: 7.49,
    cupom: 'Desconto de R$ 20 no cupom',
    freteGratis: true
  },
  fotos: [
    'img/produto/D_Q_NP_651172-MLB98386075371_112025-F-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.webp',
    'img/produto/D_NQ_NP_887392-MLB79705952686_102024-OO-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.jpg',
    'img/produto/D_NQ_NP_837659-MLB79706242112_102024-OO-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.jpg',
    'img/produto/D_NQ_NP_797192-MLB79706242102_102024-OO-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.jpg',
    'img/produto/D_NQ_NP_774877-MLB79705912884_102024-OO-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.jpg'
  ],
  variante: {
    rotulo: 'Voltagem',
    opcoes: [
      { label: '127V', img: 'img/produto/D_Q_NP_651172-MLB98386075371_112025-F-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.webp' },
      { label: '220V', img: 'img/produto/D_Q_NP_651172-MLB98386075371_112025-F-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.webp' }
    ]
  },
  bullets: [
    'Pressão máxima de 1.300 lbf/pol².',
    'Potência de 1.200 W.',
    'Mangueira de alta pressão de 3 metros.',
    'Alça e rodas para transporte.'
  ],
  descricao: `LAVADORA DE ALTA PRESSÃO VONDER LAV 1300 — 1.300 LIBRAS

Indicada para limpezas domésticas em geral: automóveis, motos, calçadas, muros, fachadas e áreas externas. O sistema gera mais pressão liberando menos água, o que remove a sujeira pesada com economia.

Uma torneira aberta consome cerca de 1.800 litros por hora. Com a lavadora, esse consumo cai para perto de 390 litros por hora.

O bico da lança é ajustável — jato leque para superfícies amplas, concentrado para sujeira encrustada. O sistema stop total desliga a bomba quando o gatilho é solto.

CONTEÚDO DA EMBALAGEM
1 lavadora, 1 pistola com gatilho, 1 lança com bico ajustável, 1 mangueira de 3 m, 1 cordão elétrico de 5 m, 1 conector de 1/2" e 1 acessório para detergente.`,
  specs: [
    { k: 'Marca', v: 'Vonder' },
    { k: 'Linha', v: 'Leve' },
    { k: 'Modelo', v: 'LAV 1300' },
    { k: 'Referência', v: '6864130001' },
    { k: 'Potência', v: '1.200 W (1,3 cv)' },
    { k: 'Pressão máxima', v: '1.300 lbf/pol² — 90 bar — 9 MPa' },
    { k: 'Pressão mínima', v: '870 lbf/pol² — 60 bar — 6 MPa' },
    { k: 'Vazão máxima', v: '6,5 litros/min — 390 litros/hora' },
    { k: 'Vazão mínima', v: '5 litros/min — 300 litros/hora' },
    { k: 'Voltagens disponíveis', v: '127V e 220V' },
    { k: 'Frequência', v: '60 Hz' },
    { k: 'Tipo de motor', v: 'Universal' },
    { k: 'Material dos pistões da bomba', v: 'Aço inox' },
    { k: 'Comprimento da mangueira', v: '3 m' },
    { k: 'Comprimento do cordão elétrico', v: '5 m' },
    { k: 'Bico da lança', v: 'Ajustável (leque ou concentrado)' },
    { k: 'Dispositivo para detergente', v: 'Reservatório externo' },
    { k: 'Sistema stop total', v: 'Sim' },
    { k: 'Alça e rodas para transporte', v: 'Sim' },
    { k: 'Uso indicado', v: 'Doméstico' },
    { k: 'Segue norma', v: 'ABNT NBR NM 60335-1 e IEC 60335-2-79' },
    { k: 'Peso com embalagem', v: '4,68 kg' },
    { k: 'Dimensões da embalagem (A x L x C)', v: '38 x 23 x 27 cm' },
    { k: 'Garantia', v: '6 meses de garantia de fábrica' }
  ],
  avaliacoes: {
    resumoIA: 'A lavadora é elogiada pela boa pressão para o tamanho e pelo custo-benefício. Os compradores destacam a facilidade de montar e usar, e mencionam que ela dá conta de carro, calçada e quintal sem dificuldade.',
    comentarios: '598 comentários',
    lista: [
      { nota: 5, pais: 'Brasil', quando: 'Há 6 meses', likes: 318, texto: 'Surpreendeu pela pressão, ainda mais sendo 127V. Lavo o carro e a calçada sem esforço nenhum.', fotos: ['img/opinioes/D_NQ_NP_2X_826608-MLA101471921203_122025-O.webp','img/opinioes/D_NQ_NP_2X_998405-MLA114390388927_072026-O.webp'] },
      { nota: 5, pais: 'Brasil', quando: 'Há 1 ano', likes: 204, texto: 'Ótimo custo-benefício. Montei em cinco minutos e já saí usando. Para uso doméstico dá e sobra.', fotos: ['img/opinioes/D_NQ_NP_2X_848230-MLA114390505383_072026-O.webp'] },
      { nota: 5, pais: 'Brasil', quando: 'Há mais de 1 ano', likes: 152, texto: 'Uso toda semana no quintal e no muro. É leve, as rodinhas ajudam bastante e a mangueira alcança bem.', fotos: ['img/opinioes/D_NQ_NP_2X_660745-MLA114390388931_072026-O.webp','img/opinioes/D_NQ_NP_2X_654954-MLA81919444052_012025-O.webp','img/opinioes/D_NQ_NP_2X_747755-MLA82557185260_032025-O.webp'] },
      { nota: 4, pais: 'Brasil', quando: 'Há 3 meses', likes: 76, texto: 'Cumpre o que promete pelo preço. Só recomendo comprar um kit de bico turbo à parte para sujeira mais pesada.', fotos: ['img/opinioes/D_NQ_NP_2X_997508-MLA111303638808_052026-O.webp'] },
      { nota: 5, pais: 'Brasil', quando: 'Há 8 meses', likes: 54, texto: 'Lavadora básica que funciona direitinho. O sistema stop total dá tranquilidade na hora de usar.', fotos: ['img/opinioes/D_NQ_NP_2X_888663-MLA112337971879_052026-O.webp'] }
    ]
  },
  relacionados: [
    { t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', p: 19.9, old: 59.9, off: '67% OFF', sold: '+1000 vendidos', img: 'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp', ship: true, full: true, pix: false },
    { t: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus', p: 27.9, old: 129.9, off: '79% OFF', sold: '+5000 vendidos', img: 'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp', ship: true, full: false, pix: false },
    { t: 'Kit Lavadora 1600 e Aspirador de Pó e Líquido APV1010 Vonder', p: 127, old: 1099, off: '88% OFF', sold: '+500 vendidos', img: 'img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp', ship: true, full: true, pix: false },
    { t: 'Mangueira Trama de Aço 10 m WAP Combate Turbo 2600', p: 32.9, old: 279, off: '88% OFF', sold: '+500 vendidos', img: 'img/relacionados/D_Q_NP_930716-MLB103748074706_012026-F-mangueira-trama-de-aco-10-mts-wap-combate-turbo-2600.webp', ship: true, full: false, pix: false },
    { t: 'Mangueira Jardim Flexível Reforçada 30 m Tramontina Verde', p: 29.9, old: 249.9, off: '88% OFF', sold: '+10mil vendidos', img: 'img/relacionados/D_Q_NP_932088-MLA99464283910_112025-F.webp', ship: true, full: true, pix: false },
    { t: 'Extensão Elétrica 10 m Reforçada 3 Tomadas 10A/20A Bivolt', p: 79.9, old: 119.9, off: '33% OFF', sold: '+10mil vendidos', img: 'img/relacionados/D_Q_NP_643511-MLA111285869538_052026-F.webp', ship: true, full: false, pix: false },
    { t: 'Kit Multi Ferramentas 4 em 1 48V Sem Fio com 2 Baterias e Maleta', p: 59, old: 799, off: '93% OFF', sold: '+1000 vendidos', img: 'img/relacionados/D_Q_NP_941321-MLA111648675325_052026-F.webp', ship: true, full: true, pix: false },
    { t: 'Kit Ferramentas 46 Peças com Soquetes e Chaves — VLX Vermelho', p: 39.9, old: 149.9, off: '73% OFF', sold: '+5000 vendidos', img: 'img/relacionados/D_Q_NP_722524-MLA115953917796_092026-F.webp', ship: true, full: false, pix: false },
    { t: 'Serra Mármore 4-3/8" 4100NH3Z 1300W Makita', p: 23.1, old: 749, off: '97% OFF', sold: '+500 vendidos', img: 'img/relacionados/D_Q_NP_605349-MLA100018712599_122025-F.webp', ship: true, full: true, pix: false },
    { t: 'Máquina Inversora de Solda MIG sem Gás 130A 3 em 1 TIG Lift', p: 97.76, old: 899, off: '89% OFF', sold: '+1000 vendidos', img: 'img/relacionados/D_Q_NP_757497-MLA102161920445_122025-F.webp', ship: true, full: false, pix: false },
    { t: 'Capacete Moto Norisk Razor Preto Brilho — Monocolor', p: 59.3, old: 349, off: '83% OFF', sold: '+5000 vendidos', tag: 'Tam. 56', img: 'img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp', ship: true, full: true, pix: false },
    { t: 'Capacete Norisk FF302 Soul 2 Grand Prix Países', p: 69.7, old: 649, off: '89% OFF', sold: '+1000 vendidos', tag: 'Tam. 56 ao 62 · 4 estampas', img: 'img/relacionados/D_Q_NP_839485-MLB116554778715_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp', ship: true, full: false, pix: false },
    { t: 'Fone de Ouvido Bluetooth para Capacete de Moto — Headset RGB Kateluo', p: 12.9, old: 199.9, off: '94% OFF', sold: '+5000 vendidos', img: 'img/relacionados/D_Q_NP_705128-MLA116671814177_082026-F.webp', ship: true, full: false, pix: false }
  ],
  orderBump: {
    titulo: 'Oferta especial antes de finalizar!',
    sub: 'Adicione ao seu pedido com frete grátis incluso',
    itens: [
      { t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', p: 19.9, old: 59.9, img: 'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp' },
      { t: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus', p: 27.9, old: 129.9, img: 'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp' },
      { t: 'Mangueira de Jardim Flexível Reforçada 30 Metros — Tramontina', p: 29.9, old: 249.9, img: 'img/relacionados/D_Q_NP_932088-MLA99464283910_112025-F.webp' }
    ]
  },
  ofertaSaida: {
    titulo: 'ESPERA! Não vá embora…',
    sub: 'Liberamos uma condição exclusiva só pra você agora',
    chamada: 'Leve a Lavadora Vonder LAV 1300 + Aplicador Snow Foam + Kit Vonder 1600 com Aspirador + Kit Vonixx de brinde',
    preco: 99.7,
    brindeTitulo: 'GRÁTIS: Snow Foam + Kit Vonder 1600 com Aspirador + Kit Vonixx',
    brindeTexto: 'Os 3 brindes já entram separados no seu pedido — sem custo nenhum.',
    imgProduto: ['img/produto/D_Q_NP_651172-MLB98386075371_112025-F-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf.webp'],
    imgBrindes: ['img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp','img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp','img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp'],
    brindes: [
      { t: 'Aplicador Snow Foam 500 ml (Brinde)', img: 'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp' },
      { t: 'Kit Vonder — Lavadora 1600 + Aspirador APV1010 (Brinde)', img: 'img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp' },
      { t: 'Kit Lavagem Automotiva Vonixx (Brinde)', img: 'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp' }
    ]
  },
  seo: {
    title: 'Lavadora De Alta Pressão Lav1300 Libras Vonder 1.300lbf | Domus',
    description: 'Lavadora de Alta Pressão Vonder LAV 1300: 1.300 lbf/pol², 1.200 W, mangueira de 3 m e bico ajustável. 22% OFF, frete grátis.',
    buscas: ['lavadora de alta pressao','lavadora vonder lav 1300','lava jato 1300 libras','lavadora vonder','lava jato portatil','lavadora alta pressao 127v']
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
