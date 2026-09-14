/* =========================================================
   Domus — PDP (Lavadora de Alta Pressão Vonder LAV 1300)
   Página única: nenhuma interação abre outra aba.
   ========================================================= */
(function () {
  'use strict';

  /* ------------------------- utilitários ------------------------- */
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const _ID_MAP = { cpf: 'fCpf', nome: 'fNome', email: 'fEmail', tel: 'fFone' };
  const el = id => document.getElementById(_ID_MAP[id] || id);
  const S = { payMethod: 'pix', cardData: null, step: 1 };

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const money = n => BRL.format(n);

  /** "147,59" -> 'R$ 147<sup>59</sup>' (centavos sobrescritos, padrão do layout) */
  const supPrice = txt => {
    const [int, dec = '00'] = String(txt).split(',');
    return `R$ ${int}<sup>${dec}</sup>`;
  };

  /** Escapa texto vindo do usuário antes de ir para innerHTML. */
  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const plural = n => `${n} unidade${n > 1 ? 's' : ''}`;

  /* =============================== DADOS =============================== */
  let PRODUCT = "Bicicleta Elétrica V9 Max 60km Autonomia Urbana 32km/h";
  let PRODUCT_ID_OVERRIDE = '';

  /* Todas as imagens vêm do CDN do marketplace. Para servir do próprio
     domínio, baixe os arquivos para img/produto/ e troque MP por 'img/produto/'. */
  const MP  = 'https://http2.mlstatic.com/';

  const _im = (url, alt) => ({ thumb: url, full: url, zoom: url, w: 800, h: 800, zw: 1000, zh: 1000, type: 'img', alt });
  const _vid = (src, poster, alt) => ({ thumb: poster, poster: poster, src: src, w: 720, h: 1280, type: 'video', alt });

  
  /* Galeria da lavadora. Hoje só temos a foto de capa do anúncio;
     ao receber as demais, basta acrescentar novas linhas _im(...). */
  /* Galeria da lavadora — 5 fotos do anúncio, servidas localmente. */
  const GAL_127V = [
    _im('img/produto/bicicleta-eletrica-v9-max-1.webp', 'Bicicleta Elétrica V9 Max — vista lateral com bolsa porta-celular de brinde'),
    _im('img/produto/bicicleta-eletrica-v9-max-2.webp', 'Bicicleta Elétrica V9 Max — tudo o que acompanha: carregador, kit de ferramentas, manual, controle do alarme, retrovisor e cartão NFC'),
    _im('img/produto/bicicleta-eletrica-v9-max-3.webp', 'Bicicleta Elétrica V9 Max — mais segurança: cartão NFC, controle do alarme, trava da roda dianteira e freios hidráulicos'),
    _im('img/produto/bicicleta-eletrica-v9-max-4.webp', 'Bicicleta Elétrica V9 Max — ideal para deslocamentos urbanos: avenida, parque, ciclovia e condomínio'),
    _im('img/produto/bicicleta-eletrica-v9-max-5.webp', 'Bicicleta Elétrica V9 Max — até 60 km de autonomia com bateria 48V 15.6Ah')
  ];

  const GALLERY = GAL_127V;
  /* 127V e 220V são o mesmo aparelho: mesma galeria nas duas opções. */
  const COLOR_GALLERIES = {
    '127V': null,
    '220V': null
  };
  let activeGallery = GALLERY;

  const PHOTOS = GALLERY.filter(g => g.type === 'img');
  const photoIndex = (() => { let n = -1; return GALLERY.map(g => (g.type === 'img' ? ++n : -1)); })();

  /* Imagens dos cards relacionados / da loja */
  /* Cards de outros aparelhos: placeholders ate chegarem as fotos reais.
     NAO usar as fotos do produto principal aqui — sao produtos diferentes. */
  /* Cards dos relacionados. Placeholders ate chegarem as fotos reais. */
  /* Cards dos relacionados. Placeholders ate chegarem as fotos. */
  const REL_IMGS = [
    'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp',
    'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp',
    'img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp',
    'img/relacionados/D_Q_NP_930716-MLB103748074706_012026-F-mangueira-trama-de-aco-10-mts-wap-combate-turbo-2600.webp',
    'img/relacionados/D_Q_NP_932088-MLA99464283910_112025-F.webp',
    'img/relacionados/D_Q_NP_643511-MLA111285869538_052026-F.webp',
    'img/relacionados/D_Q_NP_941321-MLA111648675325_052026-F.webp',
    'img/relacionados/D_Q_NP_722524-MLA115953917796_092026-F.webp',
    'img/relacionados/D_Q_NP_605349-MLA100018712599_122025-F.webp',
    'img/relacionados/D_Q_NP_757497-MLA102161920445_122025-F.webp',
    'img/relacionados/D_Q_NP_966956-MLA99335457028_112025-F.webp',
    'img/relacionados/D_Q_NP_839485-MLB116554778715_082026-F-capacete-norisk-ff302-soul-2-grand-prix-paises.webp',
    'img/relacionados/D_Q_NP_705128-MLA116671814177_082026-F.webp'
  ];

  const RELATED = [
    { img: 1, t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', url: 'p/snow-foam-500ml/', p: '19,90', old: '59,90', off: '67% OFF', sold: '+1000 vendidos', ship: 1, full: 1 },
    { img: 2, t: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus', url: 'p/kit-vonixx-vexus/', p: '27,90', old: '129,90', off: '79% OFF', sold: '+5000 vendidos', ship: 1 },
    { img: 3, t: 'Kit Lavadora 1600 e Aspirador de Pó e Líquido APV1010 Vonder', url: 'p/kit-lavadora-aspirador-vonder/', p: '127,00', old: '1.099,00', off: '88% OFF', sold: '+500 vendidos', ship: 1, full: 1 },
    { img: 4, t: 'Mangueira Trama de Aço 10 m WAP Combate Turbo 2600', url: 'p/mangueira-trama-aco-wap/', p: '32,90', old: '279,00', off: '88% OFF', sold: '+500 vendidos', ship: 1 },
    { img: 5, t: 'Mangueira Jardim Flexível Reforçada 30 m Tramontina Verde', url: 'p/mangueira-jardim-tramontina/', p: '29,90', old: '249,90', off: '88% OFF', sold: '+10mil vendidos', ship: 1, full: 1 },
    { img: 6, t: 'Extensão Elétrica 10 m Reforçada 3 Tomadas 10A/20A Bivolt', url: 'p/extensao-eletrica-10m/', p: '79,90', old: '119,90', off: '33% OFF', sold: '+10mil vendidos', ship: 1 },
    { img: 7, t: 'Kit Multi Ferramentas 4 em 1 48V Sem Fio com 2 Baterias e Maleta', url: 'p/kit-multi-ferramentas-48v/', p: '59,00', old: '799,00', off: '93% OFF', sold: '+1000 vendidos', ship: 1, full: 1 },
    { img: 8, t: 'Kit Ferramentas 46 Peças com Soquetes e Chaves — VLX Vermelho', url: 'p/kit-ferramentas-46-pecas/', p: '39,90', old: '149,90', off: '73% OFF', sold: '+5000 vendidos', ship: 1 },
    { img: 9, t: 'Serra Mármore 4-3/8" 4100NH3Z 1300W Makita', url: 'p/serra-marmore-makita/', p: '23,10', old: '749,00', off: '97% OFF', sold: '+500 vendidos', ship: 1, full: 1 },
    { img: 10, t: 'Máquina Inversora de Solda MIG sem Gás 130A 3 em 1 TIG Lift', url: 'p/inversora-solda-mig-130a/', p: '97,76', old: '899,00', off: '89% OFF', sold: '+1000 vendidos', ship: 1 },
    { img: 11, t: 'Capacete Moto Norisk Razor Preto Brilho — Monocolor', url: 'p/capacete-norisk-razor/', tag: 'Tam. 56', p: '59,30', old: '349,00', off: '83% OFF', sold: '+5000 vendidos', ship: 1, full: 1 },
    { img: 12, t: 'Capacete Norisk FF302 Soul 2 Grand Prix Países', url: 'p/capacete-norisk-ff302-grand-prix/', tag: 'Tam. 56 ao 62 · 4 estampas', p: '69,70', old: '649,00', off: '89% OFF', sold: '+1000 vendidos', ship: 1 },
    { img: 13, t: 'Fone de Ouvido Bluetooth para Capacete de Moto — Headset RGB Kateluo', url: 'p/fone-bluetooth-capacete/', p: '12,90', old: '199,90', off: '94% OFF', sold: '+5000 vendidos', ship: 1 }
  ];
  const STORE = [
    { img: 3, t: 'Kit Lavadora 1600 e Aspirador de Pó e Líquido APV1010 Vonder', url: 'p/kit-lavadora-aspirador-vonder/', p: '127,00', old: '1.099,00', off: '88% OFF', sold: '+500 vendidos', ship: 1, pix: 1, full: 1 },
    { img: 1, t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', url: 'p/snow-foam-500ml/', p: '19,90', old: '59,90', off: '67% OFF', sold: '+1000 vendidos', ship: 1 },
    { img: 5, t: 'Mangueira Jardim Flexível Reforçada 30 m Tramontina Verde', url: 'p/mangueira-jardim-tramontina/', p: '29,90', old: '249,90', off: '88% OFF', sold: '+10mil vendidos', ship: 1, full: 1 },
    { img: 6, t: 'Extensão Elétrica 10 m Reforçada 3 Tomadas 10A/20A Bivolt', url: 'p/extensao-eletrica-10m/', p: '79,90', old: '119,90', off: '33% OFF', sold: '+10mil vendidos', ship: 1 },
    { img: 7, t: 'Kit Multi Ferramentas 4 em 1 48V Sem Fio com 2 Baterias e Maleta', url: 'p/kit-multi-ferramentas-48v/', p: '59,00', old: '799,00', off: '93% OFF', sold: '+1000 vendidos', ship: 1 },
    { img: 8, t: 'Kit Ferramentas 46 Peças com Soquetes e Chaves — VLX Vermelho', url: 'p/kit-ferramentas-46-pecas/', p: '39,90', old: '149,90', off: '73% OFF', sold: '+5000 vendidos', ship: 1 }
  ];
  const ASIDE = [
    { img: 2, t: 'Kit Lavagem Automotiva Vonixx — V-Floc, Intense, Sintra Fast e Vexus', url: 'p/kit-vonixx-vexus/', p: '27,90', old: '129,90', off: '79% OFF', sold: '+5000 vendidos', ship: 1 },
    { img: 4, t: 'Mangueira Trama de Aço 10 m WAP Combate Turbo 2600', url: 'p/mangueira-trama-aco-wap/', p: '32,90', old: '279,00', off: '88% OFF', sold: '+500 vendidos', ship: 1, full: 1 },
    { img: 6, t: 'Extensão Elétrica 10 m Reforçada 3 Tomadas 10A/20A Bivolt', url: 'p/extensao-eletrica-10m/', p: '79,90', old: '119,90', off: '33% OFF', sold: '+10mil vendidos', ship: 1 },
    { img: 1, t: 'Aplicador Snow Foam para Lavadora de Pressão 500 ml', url: 'p/snow-foam-500ml/', p: '19,90', old: '59,90', off: '67% OFF', sold: '+1000 vendidos', ship: 1, full: 1 },
    { img: 9, t: 'Serra Mármore 4-3/8" 4100NH3Z 1300W Makita', url: 'p/serra-marmore-makita/', p: '23,10', old: '749,00', off: '97% OFF', sold: '+500 vendidos', ship: 1 },
    { img: 10, t: 'Máquina Inversora de Solda MIG sem Gás 130A 3 em 1 TIG Lift', url: 'p/inversora-solda-mig-130a/', p: '97,76', old: '899,00', off: '89% OFF', sold: '+1000 vendidos', ship: 1 },
    { img: 11, t: 'Capacete Moto Norisk Razor Preto Brilho — Monocolor', url: 'p/capacete-norisk-razor/', tag: 'Tam. 56', p: '59,30', old: '349,00', off: '83% OFF', sold: '+5000 vendidos', ship: 1 }
  ];
  const REVIEWS = [
    { rate: 5, country: 'Brasil', when: "Há 3 semanas", ageDays: 21, likes: 19,
      text: "", pics: [1] },
    { rate: 5, country: 'Brasil', when: "Há 1 semana", ageDays: 7, likes: 13,
      text: "Umas das melhores compras que já fiz! Excelente qualidade. Fácil achar peças para manutenção e upgrade.", pics: [2, 3] },
    { rate: 5, country: 'Brasil', when: "Há 1 semana", ageDays: 7, likes: 7,
      text: "Nesse primeiro momento eu vou dar 5 estrelas, pois a bicicleta chegou um dia antes do prazo. O vendedor foi solícito em tirar minhas dúvidas.", pics: [4, 5] },
    { rate: 5, country: 'Brasil', when: "Há 2 semanas", ageDays: 14, likes: 6,
      text: "Gostei d+.", pics: [6] },
    { rate: 5, country: 'Brasil', when: "Há 2 semanas", ageDays: 14, likes: 6,
      text: "Produto muito bom, foi exatamente o que eu precisava, atendeu minhas expectativas.", pics: [] }
  ];
  /* Fotos enviadas por compradores nos comentários. */
  const REV_IMG = {
    1: "img/opinioes/v9max-op-1-detalhe.webp",
    2: "img/opinioes/v9max-op-2-traseira.webp",
    3: "img/opinioes/v9max-op-2-frente.webp",
    4: "img/opinioes/v9max-op-3-caixa.webp",
    5: "img/opinioes/v9max-op-3-embalada.webp",
    6: "img/opinioes/v9max-op-4-quintal.webp"
  };
  const REVIEW_PHOTOS = [1, 2, 3, 4, 5, 6];
  const revThumb = n => REV_IMG[n] || '';
  const revFull = n => REV_IMG[n] || '';

  const BARS = [
    { star: 5, pct: 100 }, { star: 4, pct: 0 }, { star: 3, pct: 0 }, { star: 2, pct: 0 }, { star: 1, pct: 0 }
  ];

  /* TikTok: Search, AddToWishlist e ClickButton. Sem eles o funil ficava
     cego entre o ViewContent e o AddToCart. */
  function ttkSearch(termo) {
    if (!termo || String(termo).trim().length < 2) return;
    ttkTrack('Search', { query: String(termo).trim().slice(0, 100) });
  }
  function ttkWishlist(val) { ttkTrack('AddToWishlist', { value: val || unitPrice(), quantity: 1 }); }
  /* ClickButton foi descontinuado pelo TikTok (some em 2027) e nao alimenta
     otimizacao nenhuma: os cliques ja viram AddToCart e InitiateCheckout. */
  function ttkBotao()       { /* sem evento */ }

  const SUGGESTIONS = [
    "bicicleta eletrica", "bike eletrica v9 max", "bicicleta eletrica 1000w", "bicicleta eletrica 60km", "bike eletrica sem cnh", "v9 max"
  ];

  /* ===== conteúdo vindo do editor (/admin/editor) =====
     Substitui os dados padrão quando o offer.json responde. Se não
     responder, a loja continua com o conteúdo embutido acima. */
  /* pt-BR com separador de milhar: 2099 -> 2.099,00 */
  const brl = n => { const p = Number(n || 0).toFixed(2).split('.');
    return p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + p[1]; };

  const O = window.OFFER;
  if (O) {
    if (O.produto && O.produto.nomeCurto) PRODUCT = O.produto.nomeCurto;
    if (O.produto && O.produto.sku) PRODUCT_ID_OVERRIDE = O.produto.sku;

    if (Array.isArray(O.fotos) && O.fotos.length) {
      const g = O.fotos.map((u, i) => _im(u, `${PRODUCT} — imagem ${i + 1}`));
      GALLERY.length = 0; GALLERY.push(...g);
      activeGallery = GALLERY;
      PHOTOS.length = 0; PHOTOS.push(...g);
    }
    if (O.variante && Array.isArray(O.variante.opcoes) && O.variante.opcoes.length) {
      Object.keys(COLOR_GALLERIES).forEach(k => delete COLOR_GALLERIES[k]);
      /* Se as opções têm imagens diferentes (estampa, cor), cada uma ganha
         a própria galeria e a troca repinta o palco. Se todas apontam para
         a mesma foto (ex.: 127V e 220V do mesmo aparelho), fica null e a
         galeria completa do produto continua valendo. */
      const imgs = O.variante.opcoes.map(v => v.img || '');
      const distintas = new Set(imgs.filter(Boolean)).size > 1;
      O.variante.opcoes.forEach(v => {
        COLOR_GALLERIES[v.label] = (distintas && v.img)
          ? [_im(v.img, (O.produto && O.produto.nomeCurto ? O.produto.nomeCurto + ' — ' : '') + v.label)]
          : null;
      });
    }
    if (Array.isArray(O.relacionados) && O.relacionados.length) {
      REL_IMGS.length = 0;
      O.relacionados.forEach(r => REL_IMGS.push(r.img || ((GALLERY[0] && GALLERY[0].full) || '')));
      RELATED.length = 0;
      O.relacionados.forEach((r, i) => RELATED.push({
        img: i + 1, t: r.t, url: r.url || '', sku: r.sku || '', tag: r.tag || '',
        p: brl(r.p),
        old: r.old ? brl(r.old) : '',
        off: r.off || '', sold: r.sold || '',
        ship: r.ship ? 1 : 0, full: r.full ? 1 : 0, pix: r.pix ? 1 : 0
      }));
      ASIDE.length = 0;
      RELATED.slice(0, 4).forEach(r => ASIDE.push(r));
      // 2º carrossel ("Produtos do Domus"): mesmo catálogo real, ordem girada
      // para não repetir a fila do primeiro (a referência também reaproveita).
      STORE.length = 0;
      RELATED.slice(4).concat(RELATED.slice(0, 4)).forEach(r => STORE.push(r));
    }
    if (O.avaliacoes && Array.isArray(O.avaliacoes.lista) && O.avaliacoes.lista.length) {
      REVIEWS.length = 0;
      Object.keys(REV_IMG).forEach(k => delete REV_IMG[k]);
      REVIEW_PHOTOS.length = 0;
      let n = 0;
      O.avaliacoes.lista.forEach(r => {
        const pics = (r.fotos || []).map(u => { n++; REV_IMG[n] = u; REVIEW_PHOTOS.push(n); return n; });
        REVIEWS.push({
          rate: Number(r.nota) || 5, country: r.pais || 'Brasil', when: r.quando || '',
          ageDays: 30, likes: Number(r.likes) || 0, text: r.texto || '', pics
        });
      });
    }
  }

  /* contagem de comentarios da pagina atual (a oferta principal continua
     mandando "4.7 mil comentarios" pelo offer.json) */
  const REV_COUNT = (O && O.avaliacoes && O.avaliacoes.comentarios) || "13 comentários";

  const icon = (id, cls) => `<svg${cls ? ` class="${cls}"` : ''} aria-hidden="true" focusable="false"><use href="#${id}"/></svg>`;
  const star = on => `<svg${on ? '' : ' class="off"'} aria-hidden="true" focusable="false"><use href="#i-star"/></svg>`;

  /* ============================ TOAST ============================ */
  const toastEl = $('#toast');
  const toastMsg = $('#toastMsg');
  let toastTimer;
  function toast(msg) {
    toastMsg.textContent = msg;
    toastEl.classList.add('is-open');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('is-open'), 3400);
  }

  /* ============================ GALERIA ============================ */
  const thumbsEl = $('#thumbs');
  const stage = $('#stage');
  let gi = 0;
  let zoomArmed = false;   // a imagem 2x só é baixada no primeiro hover

  thumbsEl.innerHTML = activeGallery.map((g, i) => `
    <button class="thumb${i === 0 ? ' is-active' : ''}" type="button" data-i="${i}"
            aria-current="${i === 0}" aria-label="Ver imagem ${i + 1} de ${GALLERY.length}">
      <img src="${g.thumb}" width="112" height="112" decoding="async" alt="">
      ${g.type === 'video' ? `<span class="thumb__play">${icon('i-play')}</span>` : ''}
    </button>`).join('');

  $$('.thumb', thumbsEl).forEach(btn => {
    const go = () => setGallery(Number(btn.dataset.i));
    btn.addEventListener('mouseenter', go);
    btn.addEventListener('click', go);
    btn.addEventListener('focus', go);
  });

  /* O <img id="stageImg"> do index.html é só um placeholder para o LCP.
     Sem pintar o palco aqui, ele ficava com a foto do produto principal
     em TODAS as páginas /p/<produto>. A pintura tem de vir da galeria
     ativa, que já reflete o produto carregado. */
  function pintarPalcoInicial() {
    if (!activeGallery.length) return;
    gi = 0;
    setGallery(0);
  }

  function setGallery(i) {
    gi = (i + activeGallery.length) % activeGallery.length;
    const g = activeGallery[gi];

    $$('.thumb', thumbsEl).forEach((t, k) => {
      t.classList.toggle('is-active', k === gi);
      t.setAttribute('aria-current', String(k === gi));
    });

    if (g.type === 'video') {
      // pôster primeiro: o vídeo só é baixado quando a pessoa aperta play
      stage.innerHTML = `
        <div class="stage__video">
          <img src="${g.poster}" width="${g.w}" height="${g.h}" decoding="async" alt="${esc(g.alt)}">
          <button type="button" aria-label="Reproduzir vídeo do produto">${icon('i-play')}</button>
        </div>`;
      stage.classList.remove('is-zoom');
      $('button', stage).addEventListener('click', e => {
        e.stopPropagation();
        playVideo(g);
      });
    } else {
      stage.innerHTML = `
        <img id="stageImg" src="${g.full}" srcset="${g.full} ${g.w}w, ${g.zoom} ${g.zw}w"
             sizes="(max-width:899px) 92vw, 358px"
             width="${g.w}" height="${g.h}" decoding="async" alt="${esc(g.alt)}">
        <span class="stage__lens" id="lens" aria-hidden="true"></span>`;
      zoomArmed = false;
      armZoom();
    }
  }

  /** Troca o pôster pelo player e começa a tocar. Usa hls.js para HLS, nativo para mp4. */
  function playVideo(g) {
    stage.innerHTML = `
      <div class="stage__video">
        <video id="stageVid" poster="${g.poster}" width="${g.w}" height="${g.h}"
               controls autoplay playsinline preload="auto"></video>
      </div>`;
    const video = $('#stageVid', stage);
    const src = g.src;
    if (src.includes('.m3u8') && typeof Hls !== 'undefined' && Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}));
      hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) toast('Não foi possível carregar o vídeo.'); });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      video.play().catch(() => {});
    } else {
      video.src = src;
    }
    video.addEventListener('click', e => e.stopPropagation());
  }

  /** Aplica a imagem 2x como background da lente (uma vez por imagem). */
  function armZoom() {
    if (zoomArmed) return;
    const lens = $('#lens');
    if (!lens) return;
    lens.style.backgroundImage = `url("${GALLERY[gi].zoom}")`;
    zoomArmed = true;
  }

  /* listeners de zoom registrados uma única vez — o palco persiste, o conteúdo troca */
  stage.addEventListener('mouseenter', () => {
    if (!$('#lens')) return;
    armZoom();
    stage.classList.add('is-zoom');
  });
  stage.addEventListener('mouseleave', () => stage.classList.remove('is-zoom'));
  stage.addEventListener('mousemove', e => {
    const lens = $('#lens');
    if (!lens) return;
    const r = stage.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    lens.style.backgroundPosition = `${x}% ${y}%`;
  });
  stage.addEventListener('click', () => {
    const activePhotos = activeGallery.filter(g => g.type === 'img');
    const idx = activePhotos.indexOf(activeGallery[gi]);
    if (idx >= 0) openLightbox(idx, activePhotos.map(p => ({ src: p.zoom, thumb: p.thumb, alt: p.alt, w: p.zw, h: p.zh })));
  });

  $('#galPrev').addEventListener('click', () => setGallery(gi - 1));
  $('#galNext').addEventListener('click', () => setGallery(gi + 1));

  /* ============================ MODAIS ============================ */
  const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
  let lastFocused = null;

  function openModal(el) {
    lastFocused = document.activeElement;
    el.hidden = false;
    document.body.style.overflow = 'hidden';
    const first = $(FOCUSABLE, el);
    if (first) first.focus();
  }
  function closeModals() {
    soloItem = null; // sair do checkout encerra a compra direta
    let changed = false;
    $$('.modal').forEach(m => {
      if (!m.hidden) { m.hidden = true; changed = true; }
    });
    if (!changed) return;
    clearInterval(pollTimer);          // sair do checkout para de consultar o status
    document.body.style.overflow = '';
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
    lastFocused = null;
  }
  function openModalEl() { return $$('.modal').find(m => !m.hidden) || null; }

  $$('.modal').forEach(m => {
    m.addEventListener('mousedown', e => { if (e.target === m) closeModals(); });
    $$('[data-close]', m).forEach(b => b.addEventListener('click', closeModals));
  });

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  const lbImg = $('#lbImg');
  const lbThumbs = $('#lbThumbs');
  let lbi = 0;
  let lbSet = [];

  function openLightbox(index, set) {
    lbSet = set;
    lbi = Math.max(0, Math.min(index, lbSet.length - 1));
    lbThumbs.innerHTML = lbSet.map((g, k) => `
      <button class="thumb" type="button" data-i="${k}" aria-current="${k === lbi}" aria-label="Imagem ${k + 1}">
        <img src="${g.thumb}" width="112" height="112" loading="lazy" decoding="async" alt="">
      </button>`).join('');
    $$('.thumb', lbThumbs).forEach(b => b.addEventListener('click', () => lbGo(Number(b.dataset.i))));
    const single = lbSet.length < 2;
    $('#lbPrev').hidden = single;
    $('#lbNext').hidden = single;
    lbThumbs.hidden = single;
    lbGo(lbi);
    openModal(lb);
  }

  function lbGo(i) {
    lbi = (i + lbSet.length) % lbSet.length;
    const item = lbSet[lbi];
    lbImg.src = item.src;
    lbImg.alt = item.alt || '';
    if (item.w) { lbImg.width = item.w; lbImg.height = item.h; }
    $$('.thumb', lbThumbs).forEach((t, k) => {
      t.classList.toggle('is-active', k === lbi);
      t.setAttribute('aria-current', String(k === lbi));
    });
  }
  $('#lbPrev').addEventListener('click', () => lbGo(lbi - 1));
  $('#lbNext').addEventListener('click', () => lbGo(lbi + 1));

  /* ---------- teclado global dos modais ---------- */
  document.addEventListener('keydown', e => {
    const modal = openModalEl();

    if (e.key === 'Escape') {
      if (modal) { closeModals(); return; }
      const openDrop = $$('.dropdown.is-open, .qty__menu.is-open, .suggest.is-open')[0];
      if (openDrop) closeAllMenus();
      return;
    }
    if (!modal) return;

    if (modal === lb) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); lbGo(lbi - 1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); lbGo(lbi + 1); return; }
    }
    if (e.key === 'Tab') {                       // trava o foco dentro do modal
      const items = $$(FOCUSABLE, modal).filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ==================== FAVORITO / SEGUIR / LISTA ==================== */
  $('#favBtn').addEventListener('click', function () {
    const on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(on));
    this.setAttribute('aria-label', on ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    toast(on ? 'Produto adicionado aos favoritos.' : 'Produto removido dos favoritos.');
    if (on) ttkWishlist();
  });

  $('#followBtn').addEventListener('click', function () {
    const on = this.getAttribute('aria-pressed') !== 'true';
    this.setAttribute('aria-pressed', String(on));
    this.textContent = on ? 'Seguindo' : 'Seguir';
    toast(on ? 'Agora você segue a loja Domus.' : 'Você deixou de seguir a loja.');
  });

  $('#listBtn').addEventListener('click', e => {
    e.preventDefault();
    toast('Produto adicionado à sua lista.');
  });

  /* ---------- Quantidade ---------- */
  const MAX_QTY = 12;
  let qty = 1;
  const qtyBtn = $('#qtyBtn');
  const qtyMenu = $('#qtyMenu');
  const qtyLabel = $('#qtyLabel');

  qtyMenu.innerHTML = Array.from({ length: MAX_QTY }, (_, k) => {
    const n = k + 1;
    return `<li role="option" tabindex="-1" data-q="${n}" aria-selected="${n === 1}">${plural(n)}</li>`;
  }).join('');

  function setQty(n) {
    qty = Math.min(Math.max(n, 1), MAX_QTY);
    qtyLabel.textContent = plural(qty);
    $$('li', qtyMenu).forEach(li => li.setAttribute('aria-selected', String(Number(li.dataset.q) === qty)));
    updateCheckout();
  }

  qtyBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !qtyMenu.classList.contains('is-open');
    closeAllMenus();
    qtyMenu.classList.toggle('is-open', open);
    qtyBtn.setAttribute('aria-expanded', String(open));
    if (open) $(`li[aria-selected="true"]`, qtyMenu)?.focus();
  });
  qtyMenu.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    setQty(Number(li.dataset.q));
    closeAllMenus();
    qtyBtn.focus();
  });
  listboxKeys(qtyMenu, qtyBtn, li => { setQty(Number(li.dataset.q)); });

  /* ---------- Carrinho Persistente (localStorage) ---------- */
  const CART_KEY = '_domus_cart';
  let extraItems = []; // itens adicionais (order bump, seguro, meli+, etc.)

  function getCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }

  function saveCart(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (_) {}
    updateCartBadges();
  }

  function updateCartBadges() {
    const items = getCart();
    const count = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
    const c1 = document.getElementById('cartCount');
    const c2 = document.getElementById('cartCountTop');
    if (c1) c1.textContent = String(count);
    if (c2) c2.textContent = String(count);
    const b1 = document.getElementById('cartBtn');
    if (b1) b1.setAttribute('aria-label', `Carrinho com ${count} produtos`);
    const b2 = document.getElementById('cartBtnTop');
    if (b2) b2.setAttribute('aria-label', `Carrinho com ${count} produtos`);
  }
  updateCartBadges();

  function getCurrentProductData() {
    const titleEl = document.querySelector('.header__title, #h-title, h1');
    const title = (window.OFFER && window.OFFER.produto && (window.OFFER.produto.titulo || window.OFFER.produto.nomeCurto)) || (titleEl ? titleEl.textContent.trim() : PRODUCT);
    const sku = (window.OFFER && window.OFFER.produto && window.OFFER.produto.sku) || PRODUCT_ID;
    const tamVal = ($('#varTamLabel') && $('#varTamLabel').textContent.trim()) || '';
    const corVal = ($('#varCorLabel') && $('#varCorLabel').textContent.trim()) || '';
    const variant = [tamVal && ('Tam. ' + tamVal), corVal].filter(Boolean).join(' · ');
    const selOpt = $('.buy-opt.is-sel');
    const price = backOffer ? backOffer.unit : (selOpt ? Number(selOpt.dataset.pix) : 0);
    const img = ($('#stageImg') && $('#stageImg').getAttribute('src')) || ((GALLERY[0] && GALLERY[0].full) || '');
    const url = location.pathname;
    return { id: sku, sku, title, price, qty, img, variant, url };
  }

  function addToCartItem(item) {
    const items = getCart();
    const key = (item.id || item.title) + '___' + (item.variant || '');
    const existing = items.find(i => ((i.id || i.title) + '___' + (i.variant || '')) === key);
    if (existing) {
      existing.qty = (Number(existing.qty) || 1) + (Number(item.qty) || 229.90);
      if (item.price) existing.price = Number(item.price);
      if (item.img && !existing.img) existing.img = item.img;
    } else {
      items.push({
        id: item.id || item.sku || ('p_' + Date.now()),
        sku: item.sku || '',
        title: item.title,
        price: Number(item.price) || 0,
        qty: Number(item.qty) || 1,
        img: item.img || '',
        variant: item.variant || '',
        url: item.url || ''
      });
    }
    saveCart(items);
  }

  function removeCartItem(index) {
    const items = getCart();
    if (index >= 0 && index < items.length) {
      items.splice(index, 1);
      saveCart(items);
    }
  }

  function clearCart() {
    try {
      localStorage.removeItem(CART_KEY);
    } catch (_) {}
    updateCartBadges();
  }

  function extraTotal() {
    if (soloItem) return 0; // compra direta: só o produto do card
    return extraItems.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function cartSubtotal() {
    if (soloItem) return (soloItem.price || 0) * (qty || 1);
    const items = getCart();
    if (items.length > 0) {
      return items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    }
    return unitPrice() * qty;
  }

  function renderCartItems() {
    const el = $('#cartItemsList');
    if (!el) return;
    const items = soloItem ? [] : getCart();
    const lines = [];

    // Mostra cada item do carrinho quando há múltiplos ou quando há variantes
    if (items.length > 1) {
      items.forEach(i => {
        const label = i.title.length > 30 ? i.title.slice(0, 30) + '…' : i.title;
        const vTxt = i.variant ? ` (${i.variant})` : '';
        const qTxt = i.qty > 1 ? ` (${i.qty}x)` : '';
        const priceTxt = money(i.price * i.qty);
        const imgTag = i.img
          ? `<img src="${esc(i.img)}" alt="" style="width:24px;height:24px;object-fit:cover;border-radius:4px;margin-right:6px;vertical-align:middle;display:inline-block">`
          : '';
        lines.push(`<p class="co-line co-line--extra"><span>${imgTag}${esc(label)}${esc(vTxt)}${esc(qTxt)}</span><span>${priceTxt}</span></p>`);
      });
    }

    // Extras adicionais (order bump, seguro, meli+)
    extraItems.forEach(i => {
      const label = i.title.length > 34 ? i.title.slice(0, 34) + '…' : i.title;
      const qTxt = i.qty > 1 ? ` (${i.qty}x)` : '';
      const priceTxt = i.price > 0 ? money(i.price * i.qty) : '<span class="co-free">Grátis</span>';
      const imgTag = i.img
        ? `<img src="${esc(i.img)}" alt="" style="width:24px;height:24px;object-fit:cover;border-radius:4px;margin-right:6px;vertical-align:middle;display:inline-block">`
        : '';
      lines.push(`<p class="co-line co-line--extra"><span>${imgTag}${esc(label)}${esc(qTxt)}</span><span>${priceTxt}</span></p>`);
    });

    el.innerHTML = lines.join('');
  }

  $('#addCart').addEventListener('click', () => {
    ttkBotao('Adicionar ao carrinho');
    const item = getCurrentProductData();
    addToCartItem(item);
    ttkTrack('AddToCart', {
      value: item.price * item.qty,
      quantity: item.qty,
      contents: enriquecer([{ content_id: item.sku || item.id, content_type: 'product', content_name: item.title, price: item.price, quantity: item.qty }])
    });
    fbTrack('AddToCart', {
      value: item.price * item.qty,
      currency: 'BRL',
      content_ids: [item.sku || item.id],
      content_type: 'product',
      content_name: item.title
    });
    toast(`Adicionado ao carrinho: ${plural(item.qty)}.`);
    updateCheckout();
    renderMiniCart();
    openMiniCart();
  });

  /* ---------- Mini-carrinho (drawer lateral) ---------- */
  const miniCart = $('#miniCart');

  function renderMiniCart() {
    const body = $('#mcBody');
    if (!body) return;

    const items = getCart();
    const cartExtras = extraItems.reduce((s, i) => s + i.price * i.qty, 0);

    if (!items.length && !extraItems.length) {
      body.innerHTML = '<p class="mc-empty" style="padding:28px 16px;text-align:center;color:#666">Seu carrinho está vazio.</p>';
      $('#mcTotal').textContent = money(0);
      const mcBtn = $('#mcCheckout');
      if (mcBtn) mcBtn.disabled = true;
      return;
    }

    const rows = [];
    items.forEach((i, idx) => {
      const lineTotal = (Number(i.price) || 0) * (Number(i.qty) || 1);
      const imgTag = i.img
        ? `<div class="mc-item__img"><img src="${esc(i.img)}" alt="${esc(i.title)}"></div>`
        : `<div class="mc-item__img"></div>`;
      const varTag = i.variant ? `<small style="color:#777;display:block;margin-top:2px">${esc(i.variant)}</small>` : '';
      rows.push(`
        <div class="mc-item" data-cart-idx="${idx}">
          ${imgTag}
          <div class="mc-item__body">
            <p class="mc-item__name">${esc(i.title)}${varTag}</p>
            <p class="mc-item__price">${money(lineTotal)}</p>
            <p class="mc-item__qty">Quantidade: ${i.qty}</p>
          </div>
          <button class="mc-item__rm" type="button" data-rm-cart="${idx}" aria-label="Remover ${esc(i.title)} do carrinho">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>`);
    });

    extraItems.forEach((i, idx) => {
      const priceTxt = i.price > 0
        ? `<p class="mc-item__price">${money(i.price * i.qty)}</p>`
        : `<p class="mc-item__price mc-item__free">Grátis</p>`;
      const img = i.img
        ? `<div class="mc-item__img"><img src="${esc(i.img)}" alt=""></div>`
        : `<div class="mc-item__img"></div>`;
      rows.push(`
        <div class="mc-item">
          ${img}
          <div class="mc-item__body">
            <p class="mc-item__name">${esc(i.title)}</p>
            ${priceTxt}
            ${i.qty > 1 ? `<p class="mc-item__qty">Quantidade: ${i.qty}</p>` : ''}
          </div>
          <button class="mc-item__rm" type="button" data-rm-extra="${idx}" aria-label="Remover ${esc(i.title)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>`);
    });

    const cartTotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 1), 0);
    body.innerHTML = rows.join('');
    $('#mcTotal').textContent = money(cartTotal + cartExtras);

    const mcBtn = $('#mcCheckout');
    if (mcBtn) mcBtn.disabled = false;

    $$('[data-rm-cart]', body).forEach(b => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.rmCart);
        removeCartItem(idx);
        toast('Produto removido do carrinho.');
        renderMiniCart();
        updateCheckout();
      });
    });

    $$('[data-rm-extra]', body).forEach(b => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.rmExtra);
        extraItems.splice(idx, 1);
        toast('Item removido.');
        renderMiniCart();
        updateCheckout();
      });
    });
  }

  function openMiniCart() {
    etapa('carrinho');
    renderMiniCart();
    lastFocused = document.activeElement;
    miniCart.hidden = false;
    document.body.style.overflow = 'hidden';
    const btn = $('#mcCheckout');
    if (btn) btn.focus();
  }
  function closeMiniCart() {
    if (miniCart.hidden) return;
    miniCart.hidden = true;
    if (!openModalEl()) document.body.style.overflow = '';
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  }

  $('#cartBtn').addEventListener('click', openMiniCart);
  { const _cbt = document.querySelector('#cartBtnTop'); if (_cbt) _cbt.addEventListener('click', openMiniCart); }
  $$('[data-close]', miniCart).forEach(b => b.addEventListener('click', closeMiniCart));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !miniCart.hidden) closeMiniCart();
  });
  $('#mcCheckout').addEventListener('click', () => {
    soloItem = null;              // compra pelo carrinho, não compra direta
    closeMiniCart();
    // passa pelo order bump antes do checkout (igual ao "Comprar agora")
    if (typeof openOrderBump === 'function') openOrderBump();
    else if (typeof proceedToCheckout === 'function') proceedToCheckout();
    else openModal(cho);
  });

  /* ============================================================
     Checkout estilo Mercado Livre — fluxo em etapas (simulado)
     Etapas: 1) Endereço + entrega  2) Pagamento  3) Revisão → Pix
     ============================================================ */
  /* Oferta de back-redirect: quando ativa, o "preço unitário" passa a ser o
     do combo (2× por R$ 79,90 → R$ 39,95/un) em vez do preço da buy-opt. */
  let backOffer = null;                                 // { unit: 39.95, qty: 2 } quando ativa
  /* Compra direta de um card relacionado: quando ativa, o checkout contém
     APENAS esse produto (ignora o carrinho e o produto principal). */
  let soloItem = null;                                  // { title, price, old, img } quando ativa
  const unitPrice = () => soloItem ? soloItem.price : (backOffer ? backOffer.unit : Number(($('.buy-opt.is-sel') || {}).dataset?.pix || 0));
  const OLD_UNIT = 1189.90;                              // preço "cheio" p/ calcular economia
  const cho = $('#checkout');
  const steps = $$('.step', cho);
  const doneView = $('#choDone');
  let current = 1;                                      // etapa ativa
  let payMethod = 'pix';

  const PAY_LABEL = { pix: 'Pix', card: 'Cartão de crédito' };
  // build: v16

  /* Pixel Meta (fbq) — eventos client-side, deduplicados com o CAPI via eventID */
  const PRODUCT_ID = PRODUCT_ID_OVERRIDE || 'V9MAX-1000W';
  /* Os eventos são disparados apenas no canal que trouxe a visita — ver a
     detecção de window._CHANNEL no index.html. Sem esse recorte, tráfego de
     um canal contaria conversão no pixel do outro e sujaria a otimização. */
  const isMeta   = () => window._CHANNEL !== 'tiktok';
  /* Ver TTK_CONFIG.somenteCanal no index.html: por padrão o TikTok recebe
     todos os eventos, para alimentar públicos e otimização. */
  const isTikTok = () => (window.TTK_CONFIG && window.TTK_CONFIG.somenteCanal === true)
    ? window._CHANNEL === 'tiktok'
    : true;

  function fbTrack(event, params, opts) {
    if (!isMeta()) return;
    if (typeof window.fbq === 'function') window.fbq('track', event, params || {}, opts || undefined);
  }

  /* Pixel TikTok (ttq) + Events API — a ponte vive no index.html.
     Silencioso quando a ponte não está carregada (ex.: modo demonstração). */
  function ttkTrack(event, opts) {
    if (!isTikTok()) return;
    if (typeof window.ttkTrack === 'function') window.ttkTrack(event, opts || {});
  }
  /* marca em que página/etapa a sessão está (painel admin) */
  function etapa(nome) {
    try { if (window.ttkPresence) window.ttkPresence.etapa(nome); } catch (_) {}
  }

  /* contents do que esta sendo comprado agora: o produto da pagina ou, se a
     compra veio de um card do carrossel, aquele produto. Sem isso o evento
     de compra ia sempre com o SKU da pagina e nao casava no catalogo. */
  /* quantidade de itens do pedido atual (para o campo quantity dos eventos) */
  function qtdPedido() {
    const its = soloItem ? [{ qty: 1 }] : getCart();
    return its.reduce((s, i) => s + (Number(i.qty) || 1), 0) || qty;
  }
  /* brand e content_category no item do produto desta pagina (a ponte sabe) */
  const enriquecer = c => (typeof window.ttkEnriquecer === 'function' ? window.ttkEnriquecer(c) : c);
  function comprado(val, q) { return enriquecer(_comprado(val, q)); }
  function _comprado(val, q) {
    /* price e o PRECO UNITARIO do produto (doc do TikTok: "price for a single
       item"; value e o total do pedido). Antes era total/quantidade, e o total
       inclui order bump, seguro e frete — o catalogo aprendia preco errado. */
    if (soloItem) {
      return [{
        content_id:   soloItem.sku || PRODUCT_ID,
        content_type: 'product',
        content_name: soloItem.title,
        price:        Number(soloItem.price) || Number(val || 0) / (q || 1),
        quantity:     q || 1
      }];
    }
    const items = getCart();
    if (items.length > 0) {
      return items.map(i => ({
        content_id:   i.sku || i.id || PRODUCT_ID,
        content_type: 'product',
        content_name: i.title,
        price:        Number(i.price) || 0,
        quantity:     Number(i.qty) || 1
      }));
    }
    q = q || 1;
    return [{
      content_id:   PRODUCT_ID,
      content_type: 'product',
      content_name: PRODUCT,
      price:        Number(unitPrice()) || Number(val || 0) / q,
      quantity:     q
    }];
  }

  function ttkIdentify(data) {
    if (!isTikTok()) return;
    if (typeof window.ttkIdentify === 'function') window.ttkIdentify(data);
  }

  /* ===== Integração com a API própria de PIX + tracking =====
     Config vem de window.VONIXX_PIX (definido no index.html).
     api vazio → modo demonstração (QR/código fictícios). */
  const PIX_CFG = Object.assign(
    { api: '', offer: 'lav1300', funnel: 'lav1300', thankYouUrl: '', pollMs: 3000, expiresInDays: 1 },
    (window.VONIXX_PIX || {})
  );
  let pollTimer = null;
  const PAID_STATUS = ['APPROVED', 'PAID', 'PAGO', 'CONCLUIDA', 'COMPLETED'];
  const CARDS_API = PIX_CFG.cardsApi || 'https://cards-vault.onrender.com';
  const calcTotal = () => cartSubtotal();
  const fmt = n => money(n);
  function shake(inp, msg) {
    inp.classList.add('cf-shake');
    toast(msg);
    setTimeout(() => inp.classList.remove('cf-shake'), 500);
  }

  // captura sinais de tracking do Meta (fbclid/fbc/fbp/external_id) + UTMs
  function getTracking() {
    const p = new URLSearchParams(location.search);
    const g = k => p.get(k) || '';
    const cookie = n => (document.cookie.match('(^|;)\\s*' + n + '\\s*=\\s*([^;]+)') || [])[2] || '';
    // fbclid: pega da URL e persiste; se não veio na URL, usa o persistido
    let fbclid = g('fbclid'), externalId = '';
    // ttclid: URL primeiro; se não veio, o persistido pela ponte do TikTok.
    // Sem ele o webhook do tiktok-tracking não consegue atribuir o Purchase.
    let ttclid = g('ttclid');
    try {
      if (fbclid) localStorage.setItem('_fbclid', fbclid);
      else fbclid = localStorage.getItem('_fbclid') || '';
      if (ttclid) localStorage.setItem('ttclid', ttclid);
      else ttclid = localStorage.getItem('ttclid') || '';
      // Cada canal tem seu external_id próprio — o do TikTok é criado pela ponte
      externalId = localStorage.getItem(isTikTok() ? '_ttk_eid' : '_fb_eid') || '';
    } catch (_) {}
    return {
      // mesma origem do resto da pagina (macros do TikTok + primeiro toque)
      utms: window.__ORIGEM__ || { utmSource: g('utm_source'), utmCampaign: g('utm_campaign'), utmMedium: g('utm_medium'), utmContent: g('utm_content'), utmTerm: g('utm_term') },
      fbclid,
      tiktokClickId: ttclid,
      fbc: cookie('_fbc'),
      fbp: cookie('_fbp'),
      externalId,
      landingPageUrl: location.href,
      // contexto extra do TikTok — o servidor guarda para o CompletePayment
      ttp: (window.ttkContext ? window.ttkContext().ttp : ''),
      ttkExternalId: (window.ttkContext ? window.ttkContext().external_id : ''),
      locale: (navigator.language || '').slice(0, 10),
      customer_type: (window.ttkContext ? window.ttkContext().customer_type : undefined),
      ad: (window.ttkContext ? window.ttkContext().ad : undefined),
      // compra direta por um card do carrossel -> o SKU e o daquele produto
      product_id: (soloItem && soloItem.sku) || PRODUCT_ID,
      /* itens do pedido, por SKU: o servidor guarda e usa no PlaceAnOrder e no
         CompletePayment da Events API. Sem isso o evento do servidor ia com um
         único item genérico e não casava com o catálogo do TikTok. */
      ttkContents: (function () {
        try {
          const its = soloItem ? [{ qty: 1 }] : getCart();
          const tq  = its.reduce((s, i) => s + (Number(i.qty) || 1), 0) || qty;
          return comprado(totalPedido(), tq);
        } catch (_) { return undefined; }
      })()
    };
  }

  const SHIP_COST = { normal: 0, correios: 7.90, jadlog: 11.90, full: 15.90 };
  let meliPlusActive = false; // se true, frete zera (meli+ substitui)
  function shipCost() {
    const sec = document.getElementById('shipSection');
    if (!sec || sec.hidden) return null; // endereço não preenchido ainda
    if (meliPlusActive) return 0;         // meli+ ativo → frete grátis
    const sel = $('input[name="ship"]:checked');
    return SHIP_COST[sel ? sel.value : 'full'] ?? 0;
  }

  /* Valor do pedido inteiro: produtos do carrinho + order bump + seguro + frete. */
  function totalPedido() {
    return cartSubtotal() + extraTotal() + (shipCost() ?? 0);
  }

  function updateCheckout() {
    const prod  = cartSubtotal();
    const extra = extraTotal();
    const ship  = shipCost(); // null = endereço não preenchido
    const shipVal = ship ?? 0;
    const total = prod + extra + shipVal;
    const oldTotal = Math.round(prod * 1.5 * 100) / 100;
    const saved = Math.max(0, oldTotal - prod);
    renderCartItems();
    $('#sumSub').textContent = money(prod);
    $('#sumSubtotal').textContent = money(prod + extra);
    const shipEl = $('#sumShip');
    if (shipEl) {
      if (ship === null) {
        shipEl.textContent = 'a calcular';
        shipEl.className = '';
      } else {
        shipEl.textContent = ship ? money(ship) : 'Grátis';
        shipEl.classList.toggle('co-free', !ship);
      }
    }
    $('#sumPay').textContent = money(total);
    $('#sumPayMethod').textContent = PAY_LABEL[payMethod];
    $('#sumOld').textContent = money(oldTotal);
    $('#sumTotal').textContent = money(total);
    $('#sumSave').textContent = `Você economizou ${money(saved)}`;
    $('#doneHeading').textContent = `Pague ${money(total)} via Pix para concluir sua compra`;
    fillParcelas(total);
  }

  /* ---- renderiza o estado das 3 etapas ---- */
  function renderSteps() {
    steps.forEach(s => {
      const i = Number(s.dataset.step);
      s.classList.toggle('is-active', i === current);
      s.classList.toggle('is-done', i < current);
      s.classList.toggle('is-locked', i > current);
      const edit = $('.step__edit', s);
      if (edit) edit.hidden = i >= current;
      const sum = $('.step__summary', s);
      if (sum) sum.hidden = i >= current;
    });
    cho.classList.toggle('is-review', current === 3);
    $('#choFlow').classList.toggle('is-review', current === 3);
    if (current === 3) updateReview();
    const active = steps.find(s => Number(s.dataset.step) === current);
    if (active) $('.step__title', active).setAttribute('tabindex', '-1'), $('.step__title', active).focus();
  }

  function goTo(n) {
    if (n === 1) {
      const p2 = document.getElementById('addrPhase2');
      const p1btn = document.getElementById('addrPhase1Btn');
      if (p2) p2.hidden = true;
      if (p1btn) p1btn.style.display = '';
    }
    current = n; S.step = n; renderSteps(); _updatePayBtn();
    etapa(n === 1 ? 'checkout_addr' : n === 2 ? 'checkout_pgto' : 'checkout_review');
  }

  /* ---- máscaras leves ---- */
  const onlyDigits = v => v.replace(/\D/g, '');
  function maskCep(v) { v = onlyDigits(v).slice(0, 8); return v.length > 5 ? `${v.slice(0,5)}-${v.slice(5)}` : v; }
  function maskCard(v) { return onlyDigits(v).slice(0,16).replace(/(.{4})/g, '$1 ').trim(); }
  function maskVal(v) { v = onlyDigits(v).slice(0,4); return v.length > 2 ? `${v.slice(0,2)}/${v.slice(2)}` : v; }
  function maskCpf(v) {
    v = onlyDigits(v).slice(0, 11);
    return v.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  function maskFone(v) {
    v = onlyDigits(v).slice(0, 11);
    if (v.length > 6) return `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
    if (v.length > 2) return `(${v.slice(0,2)}) ${v.slice(2)}`;
    if (v.length > 0) return `(${v}`;
    return v;
  }

  // cNum/cVal inline card form removed — card is now captured in #cardFormModal
  $('#fCpf').addEventListener('input', e => { e.target.value = maskCpf(e.target.value); });
  $('#fFone').addEventListener('input', e => { e.target.value = maskFone(e.target.value); });
  $('#fUf').addEventListener('input', e => { e.target.value = e.target.value.replace(/[^a-zA-Z]/g,'').toUpperCase().slice(0,2); });

  /* ---- Busca de CEP via ViaCEP (preenche endereço automaticamente) ---- */
  const fCep = $('#fCep');
  let cepReq = 0;                 // id de requisição p/ ignorar respostas fora de ordem
  let lastCep = '';               // evita refazer a busca do mesmo CEP

  async function lookupCep(raw) {
    const cep = onlyDigits(raw);
    if (cep.length !== 8 || cep === lastCep) return;
    lastCep = cep;
    const reqId = ++cepReq;
    fCep.setAttribute('aria-busy', 'true');
    fieldErr(fCep, false);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (reqId !== cepReq) return;                 // chegou uma busca mais nova
      if (data.erro) { lastCep = ''; fieldErr(fCep, true); toast('CEP não encontrado. Confira o número.'); return; }
      if (data.logradouro) $('#fRua').value = data.logradouro;
      if (data.bairro)     $('#fBairro').value = data.bairro;
      if (data.localidade) $('#fCidade').value = data.localidade;
      if (data.uf)         $('#fUf').value = data.uf;
      $$('#fRua,#fBairro,#fCidade,#fUf').forEach(i => fieldErr(i, false));
      ($('#fRua').value ? $('#fNum') : $('#fRua')).focus();   // vai pro que falta preencher
      toast('Endereço preenchido pelo CEP.');
    } catch (_) {
      if (reqId !== cepReq) return;
      lastCep = '';
      toast('Não foi possível buscar o CEP agora. Preencha manualmente.');
    } finally {
      if (reqId === cepReq) fCep.removeAttribute('aria-busy');
    }
  }

  fCep.addEventListener('input', e => {
    e.target.value = maskCep(e.target.value);
    if (onlyDigits(e.target.value).length === 8) lookupCep(e.target.value);
  });
  fCep.addEventListener('blur', e => lookupCep(e.target.value));

  $('[data-cep-help]').addEventListener('click', e => {
    e.preventDefault();
    fCep.focus();
    toast('Digite os 8 dígitos do CEP — o endereço é preenchido automaticamente.');
  });

  /* ---- ETAPA 1: endereço + entrega ---- */
  const addrForm = $('#addrForm');

  function fieldErr(input, on) {
    input.setAttribute('aria-invalid', String(on));
    const err = $(`[data-err="${input.id}"]`);
    if (err) err.hidden = !on;
  }

  const ADDR_FIELDS = ['fCep', 'fRua', 'fNum', 'fBairro', 'fCidade', 'fUf'];
  const PERSONAL_FIELDS = ['fEmail', 'fFone', 'fNome', 'fCpf'];

  function validateFields(ids) {
    let firstBad = null;
    ids.forEach(id => {
      const inp = $('#' + id);
      if (!inp) return;
      let bad;
      if (id === 'fCep')   bad = onlyDigits(inp.value).length !== 8;
      else if (id === 'fCpf')   bad = onlyDigits(inp.value).length !== 11;
      else if (id === 'fEmail') bad = !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/.test(inp.value.trim());
      else if (id === 'fFone')  bad = onlyDigits(inp.value).length < 10;
      else if (id === 'fNome')  bad = inp.value.trim().replace(/[0-9]/g, '').trim().length < 3;
      else bad = !inp.value.trim();
      fieldErr(inp, bad);
      if (bad && !firstBad) firstBad = inp;
    });
    return firstBad;
  }

  function isFieldValid(id) {
    const inp = $('#' + id); if (!inp) return false;
    if (id === 'fCep')   return onlyDigits(inp.value).length === 8;
    if (id === 'fCpf')   return onlyDigits(inp.value).length === 11;
    if (id === 'fEmail') return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-zA-Z]{2,}$/.test(inp.value.trim());
    if (id === 'fFone')  return onlyDigits(inp.value).length >= 10;
    if (id === 'fNome')  return inp.value.trim().replace(/[0-9]/g, '').trim().length >= 3;
    return !!inp.value.trim();
  }

  function revealShipping() {
    const sec = document.getElementById('shipSection');
    if (!sec || !sec.hidden) return;
    sec.hidden = false;
    updateCheckout();
    sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Impede que o cliente digite números no campo nome
  const _fNome = $('#fNome');
  if (_fNome) _fNome.addEventListener('input', () => {
    const cur = _fNome.value;
    const clean = cur.replace(/[0-9]/g, '');
    if (clean !== cur) { const s = _fNome.selectionStart - (cur.length - clean.length); _fNome.value = clean; _fNome.setSelectionRange(s, s); }
  });

  // Auto-revela frete ao sair do último campo de endereço
  ADDR_FIELDS.forEach(id => {
    const inp = $('#' + id);
    if (inp) inp.addEventListener('blur', () => {
      if (ADDR_FIELDS.every(isFieldValid)) revealShipping();
    });
  });

  /* ---- Meli+ upsell (aparece depois do Continuar da fase 1) ---- */
  const meliModal = $('#meliModal');
  let meliShown = false;
  function openMeliModal(onDone) {
    meliShown = true;
    meliModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    const close = (accepted) => {
      meliModal.classList.remove('is-open');
      document.body.style.overflow = '';
      if (accepted) {
        meliPlusActive = true;
        // remove eventual meli+ anterior antes de re-adicionar
        extraItems = extraItems.filter(i => !i.isMeliPlus);
        extraItems.push({ title: 'Assinatura meli+ (frete FULL grátis + benefícios)', price: 19.90, qty: 1, isMeliPlus: true });
        // visual: opaca as opções de frete e mostra badge
        const shipOptsEl = document.getElementById('shipOpts');
        const shipBadge  = document.getElementById('meliShipBadge');
        if (shipOptsEl) shipOptsEl.classList.add('is-meli-locked');
        if (shipBadge)  shipBadge.hidden = false;
      }
      updateCheckout();
      onDone();
    };
    $('#meliAdd').onclick  = () => close(true);
    $('#meliSkip').onclick = () => close(false);
  }

  // Fase 1: valida endereço → revela frete (se oculto) → oferece meli+ → revela dados pessoais
  $('#addrPhase1Btn').addEventListener('click', () => {
    const bad = validateFields(ADDR_FIELDS);
    if (bad) { bad.focus(); return; }
    const sec = document.getElementById('shipSection');
    if (sec && sec.hidden) { revealShipping(); return; }

    /* Lead (antes SubmitForm — renomeado pelo TikTok em 2025; pixel novo usa
       o nome novo). A trava evita disparo duplo quando o comprador volta e
       avança de novo na mesma sessão. */
    if (!window.__endEnviado) {
      window.__endEnviado = true;
      ttkTrack('Lead', { value: totalPedido(), quantity: qtdPedido(), contents: comprado(totalPedido(), qtdPedido()), description: 'Endereço preenchido' });
    }

    const goToPhase2 = () => {
      const p2 = document.getElementById('addrPhase2');
      p2.hidden = false;
      document.getElementById('addrPhase1Btn').style.display = 'none';
      ttkTrack('AddPaymentInfo', { value: totalPedido(), quantity: qtdPedido(), contents: comprado(totalPedido(), qtdPedido()) });
      etapa('checkout_dados');
      const first = PERSONAL_FIELDS.map(id => $('#' + id)).find(inp => inp && !inp.value.trim());
      if (first) first.focus();
      p2.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };

    // Só oferece meli+ uma vez e se ele ainda não estiver ativo
    if (!meliShown && !meliPlusActive) openMeliModal(goToPhase2);
    else goToPhase2();
  });

  // Fase 2 (submit): valida dados pessoais → avança para pagamento
  addrForm.addEventListener('submit', e => {
    e.preventDefault();
    const bad = validateFields(PERSONAL_FIELDS);
    if (bad) { bad.focus(); return; }

    // Advanced matching TikTok — e-mail/telefone alimentam o EMQ dos eventos seguintes
    ttkIdentify({ email: $('#fEmail').value.trim(), phone: onlyDigits($('#fFone').value) });
    try { localStorage.setItem('_ttk_email', $('#fEmail').value.trim().toLowerCase()); localStorage.setItem('_ttk_phone', onlyDigits($('#fFone').value)); } catch (_) {}

    const shipVal = ($('input[name="ship"]:checked', addrForm) || {}).value;
    const SHIP_LABELS = { normal: 'Envio 1 (12 a 15 dias)', correios: 'Envio 2 (9 a 10 dias)', jadlog: 'Envio 3 (5 a 8 dias)', full: 'Envio 4 (1 dia útil)' };
    const SHIP_PRICE_LABELS = { normal: 'Grátis', correios: 'R$ 7,90', jadlog: 'R$ 11,90', full: 'R$ 15,90' };
    const shipLabel = SHIP_LABELS[shipVal] || 'Envio 1 (12 a 15 dias)';
    const shipPriceLabel = SHIP_PRICE_LABELS[shipVal] || 'Grátis';
    const addr = `${$('#fRua').value}, ${$('#fNum').value}, ${$('#fBairro').value}, ${$('#fCidade').value}/${$('#fUf').value}`;
    $('[data-summary="1"]').textContent = `${addr} · CEP ${$('#fCep').value} · ${shipLabel} · ${shipPriceLabel}`;
    goTo(2);
  });

  /* ---- ETAPA 2: pagamento ---- */
  function fillParcelas() { /* parcelas agora são populadas dentro de abrirCardForm() */ }

  /* ---- preenche os cards da etapa de revisão (estilo ML) ---- */
  function updateReview() {
    const total = totalPedido();
    $('#revBillName').textContent = $('#fNome').value.trim() || 'Cliente';
    $('#revBillCpf').textContent = `CPF ${$('#fCpf').value || ''}`;
    $('#revShipAddr').textContent = `${$('#fRua').value} ${$('#fNum').value}`.trim();
    const shipVal = ($('input[name="ship"]:checked', addrForm) || {}).value;
    const REV_ETA = {
      normal:   'Envio 1 — chega em 12 a 15 dias úteis · Grátis',
      correios: 'Envio 2 — chega em 9 a 10 dias úteis · R$ 7,90',
      jadlog:   'Envio 3 — chega em 5 a 8 dias úteis · R$ 11,90',
      full:     'Envio 4 — chega em 1 dia útil · R$ 15,90',
    };
    $('#revShipEta').textContent = REV_ETA[shipVal] || REV_ETA.normal;

    const items = soloItem ? [{ title: soloItem.title, img: soloItem.img, qty: 1 }] : getCart();
    const totalQ = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
    $('#revQty').textContent = String(totalQ || qty);

    // Sincroniza thumb/nome da revisão: compra direta usa o produto do card
    const revProdName = $('#revProdName');
    const selColorImg = $('#varCorOpts .var-btn.is-sel img');
    const revThumb    = $('#revThumb');
    if (soloItem) {
      if (revProdName) revProdName.textContent = soloItem.title;
      if (revThumb) { revThumb.src = soloItem.img || ((GALLERY[0] && GALLERY[0].full) || ''); revThumb.alt = soloItem.title; }
    } else if (items.length === 1) {
      if (revProdName) revProdName.textContent = items[0].title + (items[0].variant ? ' — ' + items[0].variant : '');
      if (revThumb && items[0].img) { revThumb.src = items[0].img; revThumb.alt = items[0].title; }
    } else if (items.length > 1) {
      if (revProdName) revProdName.textContent = `${items[0].title} (+ ${items.length - 1} outro${items.length > 2 ? 's' : ''} produto${items.length > 2 ? 's' : ''})`;
      if (revThumb && items[0].img) { revThumb.src = items[0].img; revThumb.alt = items[0].title; }
    } else {
      const _rTam = ($('#varTamLabel') && $('#varTamLabel').textContent.trim()) || '';
      const _rCor = ($('#varCorLabel') && $('#varCorLabel').textContent.trim()) || '';
      const _rVar = [_rTam && ('Tam. ' + _rTam), _rCor].filter(Boolean).join(' · ');
      if (revProdName) revProdName.textContent = PRODUCT + (_rVar ? ' — ' + _rVar : '');
      if (selColorImg && revThumb) {
        revThumb.src = selColorImg.src;
        revThumb.alt = selColorImg.alt || '';
      }
    }

    if (S.payMethod === 'card' && S.cardData) {
      const sel = el('cfParc');
      const parcTxt = sel ? sel.options[sel.selectedIndex].text : '';
      $('#revPayName').textContent = 'Cartão de crédito';
      $('#revPayAmt').textContent = parcTxt;
      $('#revPayHint').textContent = 'Ao confirmar a compra, o cartão será processado.';
    } else {
      $('#revPayName').textContent = 'Pix';
      $('#revPayAmt').textContent = money(total);
      $('#revPayHint').textContent = 'Ao confirmar a compra, você terá as informações para pagar.';
    }
  }

  // payOpts change interceptado via onclick="selectPayMethod()" nas labels
  $('#shipOpts').addEventListener('change', e => {
    if (e.target.name !== 'ship') return;
    $$('.ship-opt', cho).forEach(l => l.classList.toggle('is-sel', $('input', l).checked));
    updateCheckout();
  });

  $('[data-continue="2"]').addEventListener('click', () => {
    $('[data-summary="2"]').textContent = PAY_LABEL[S.payMethod]
      + (S.payMethod === 'pix' ? ' · 73% OFF' : '');
    goTo(3);
  });

  /* ---- links "Editar/Alterar" (etapas concluídas e cards de revisão) ---- */
  $$('[data-edit]', cho).forEach(el =>
    el.addEventListener('click', e => { e.preventDefault(); goTo(Number(el.dataset.edit)); }));

  /* ---- ETAPA 3: pagar → tela de sucesso ---- */
  function fakePixCode() {
    const rnd = () => Math.random().toString(36).slice(2, 10);
    return `00020126580014br.gov.bcb.pix0136${rnd()}-${rnd()}-demo5204000053039865802BR5905DOMUS6006CURIT62070503***6304${rnd().slice(0,4).toUpperCase()}`;
  }

  function renderQR() {
    // QR fictício: grade 25×25 pseudoaleatória + 3 marcadores de canto (apenas visual)
    const N = 25, cell = 100 / N;
    let rects = '';
    const finder = (ox, oy) => {
      for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) rects += `<rect x="${(ox+x)*cell}" y="${(oy+y)*cell}" width="${cell}" height="${cell}"/>`;
      }
    };
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const inFinder = (x < 8 && y < 8) || (x > N-9 && y < 8) || (x < 8 && y > N-9);
      if (!inFinder && Math.random() > 0.52) rects += `<rect x="${x*cell}" y="${y*cell}" width="${cell}" height="${cell}"/>`;
    }
    finder(0, 0); finder(N - 7, 0); finder(0, N - 7);
    $('#choQr').innerHTML = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" fill="#000" shape-rendering="crispEdges" role="img" aria-label="QR Code Pix de demonstração">${rects}</svg>`;
  }

  /* ---- intersticial de carregamento (reutilizável) ---- */
  const loadView = $('#choLoading');
  const loadText = $('#choLoadingText');
  let loadTimer = null;
  function showLoading(html) { loadText.innerHTML = html; loadView.hidden = false; }
  function hideLoadingAfter(delay, done) {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => { loadView.hidden = true; if (done) done(); }, delay);
  }

  /* ---- geração de PIX na API própria + polling de status ---- */
  function pixCreateBody() {
    const items = soloItem ? [{ title: soloItem.title, qty: 1 }] : getCart();
    let desc = '';
    if (items.length === 1) {
      desc = items[0].title + (items[0].variant ? ' — ' + items[0].variant : '');
    } else if (items.length > 1) {
      desc = items.map(i => `${i.qty}x ${i.title}`).join(' + ');
      if (desc.length > 120) {
        desc = `${items.length} produtos: ` + items.map(i => i.title).join(', ').slice(0, 90) + '…';
      }
    } else {
      desc = soloItem ? soloItem.title : (PIX_CFG.productName || PRODUCT || 'Produtos Domus');
    }

    return Object.assign({
      // arredondado em centavos: a soma de float gerava 81.33000000000001 na cobranca
      value: Math.round(totalPedido() * 100) / 100,
      description: desc,
      payerName: $('#fNome').value.trim(),
      /* sid liga esta venda a jornada do visitante no painel */
      sid: (window.ttkPresence && window.ttkPresence.sid) || '',
      payerCpf: onlyDigits($('#fCpf').value),
      payerEmail: $('#fEmail').value.trim(),
      payerPhone: onlyDigits($('#fFone').value),
      offer: PIX_CFG.offer,
      funnel: PIX_CFG.funnel,
      payerStreet: $('#fRua').value.trim(),
      payerNumber: $('#fNum').value.trim(),
      payerComplement: $('#fCompl').value.trim(),
      payerNeighborhood: $('#fBairro').value.trim(),
      payerCity: $('#fCidade').value.trim(),
      payerState: $('#fUf').value.trim(),
      payerZip: onlyDigits($('#fCep').value)
    }, getTracking());
  }

  async function createPix() {
    const res = await fetch(`${PIX_CFG.api}/api/pix/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pixCreateBody())
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok || data.ok === false) throw new Error(data.error || 'Não foi possível gerar o PIX.');
    return data;                                 // { txid, qrCode, base64QrCode, purchaseEventId, ... }
  }

  let lastPurchase = null;                        // guarda valor + eventID p/ o Purchase do pixel
  let currentTxid  = null;                        // txid do PIX gerado (para envio de comprovante)
  let comprovTimer = null;                        // timer 60s para exibir bloco de comprovante

  function showPixResult(data) {
    if (data.base64QrCode) {
      const qrImg = document.createElement('img');
      qrImg.width = 190; qrImg.height = 190; qrImg.alt = 'QR Code Pix';
      qrImg.src = data.base64QrCode;   // setAttribute via DOM — sem risco de injeção de HTML
      const qrEl = $('#choQr'); qrEl.innerHTML = ''; qrEl.appendChild(qrImg);
    } else {
      renderQR();                                // fallback visual se a API não devolver imagem
    }
    $('#pixCode').textContent = data.qrCode || data.pixCode || '';
    lastPurchase = { value: Math.round(totalPedido() * 100) / 100,
                     eventId: data.purchaseEventId || data.txid || '',
                     ttkId: data.purchaseEventId || '',   // so o id do servidor serve para dedup
                     txid: data.txid || '' };
    currentTxid = data.txid || null;
    /* o celular recarrega a aba quando o comprador sai pro app do banco: sem isso
       o QR some e a cobranca fica orfa */
    try {
      sessionStorage.setItem('pix_aberto', JSON.stringify({
        txid: currentTxid, eventId: lastPurchase.eventId, ttkId: lastPurchase.ttkId, value: lastPurchase.value,
        qr: data.base64QrCode || '', code: data.qrCode || data.pixCode || '', ts: Date.now()
      }));
    } catch (_) {}
    doneView.hidden = false;
    cho.querySelector('.cho__scroll').scrollTop = 0;
    etapa('pix_gerado');
    // PlaceAnOrder: PIX gerado. Mesmo event_id que o servidor usa (pao-<txid>) → dedup.
    if (data.txid) {
      const items = soloItem ? [{ qty: 1 }] : getCart();
      const totalQ = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
      ttkTrack('PlaceAnOrder', {
        value: lastPurchase.value, quantity: totalQ || qty, event_id: 'pao-' + data.txid, order_id: data.txid,
        contents: comprado(lastPurchase.value, totalQ || qty),
        user: { email: $('#fEmail').value.trim(), phone: onlyDigits($('#fFone').value) }
      });
    }
    startPolling(data.txid);
    // Exibe bloco de comprovante após 60 segundos se o PIX ainda não foi confirmado
    clearTimeout(comprovTimer);
    comprovTimer = setTimeout(() => {
      const el = $('#choComprovante');
      if (el) el.hidden = false;
    }, 60000);
  }

  // ── Bloco de comprovante ──────────────────────────────────────────────────────
  (function initComprovante() {
    const form     = $('#comprovForm');
    const fileInp  = $('#comprovFile');
    const fileLabel= $('#comprovFileName');
    const btn      = $('#comprovBtn');
    const okEl     = $('#comprovOk');
    if (!form || !fileInp) return;

    fileInp.addEventListener('change', () => {
      const f = fileInp.files[0];
      if (f) {
        fileLabel.textContent = f.name;
        btn.disabled = false;
      } else {
        fileLabel.textContent = 'Imagem (JPG/PNG) ou PDF — até 20 MB';
        btn.disabled = true;
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = fileInp.files[0];
      if (!f) return;
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      try {
        const fd = new FormData();
        fd.append('comprovante', f);
        if (currentTxid) fd.append('pedido', currentTxid);
        // Dados do cliente — fallback caso o servidor perca a ordem em memória
        const _nome  = ($('#fNome')  || {}).value || '';
        const _email = ($('#fEmail') || {}).value || '';
        const _fone  = ($('#fFone')  || {}).value || '';
        const _cpf   = ($('#fCpf')   || {}).value || '';
        const _valor = String(Math.round(totalPedido() * 100) / 100);
        const _pix   = ($('#pixCode') || {}).textContent || '';
        const _ship  = ($('input[name="ship"]:checked') || {}).value || 'normal';
        if (_nome)  fd.append('nome',  _nome);
        if (_email) fd.append('email', _email);
        if (_fone)  fd.append('telefone', _fone);
        if (_cpf)   fd.append('cpf',   _cpf);
        if (_valor) fd.append('valor', _valor);
        if (_pix)   fd.append('pix_code', _pix);
        if (_ship)  fd.append('frete', _ship);
        const r = await fetch('https://tiktok-tracking.onrender.com/api/comprovante', { method: 'POST', body: fd });
        const d = await r.json().catch(() => ({}));
        if (r.ok && d.ok !== false) {
          form.hidden = true;
          okEl.hidden = false;
        } else {
          btn.disabled = false;
          btn.textContent = 'Enviar comprovante';
          alert('Erro ao enviar. Tente novamente.');
        }
      } catch (_) {
        btn.disabled = false;
        btn.textContent = 'Enviar comprovante';
        alert('Sem conexão. Verifique sua internet e tente novamente.');
      }
    });
  })();

  function startPolling(txid) {
    clearInterval(pollTimer);
    if (!txid || !PIX_CFG.api) return;
    let tentativas = 0, emVoo = false;
    const MAX_POLL = Math.ceil(30 * 60000 / (PIX_CFG.pollMs || 3000));   // teto de 30 min
    pollTimer = setInterval(async () => {
      if (++tentativas > MAX_POLL) { clearInterval(pollTimer); return; }
      /* Uma consulta por vez. Quando a rede demora mais que o intervalo, varias
         respostas "PAID" chegavam em sequencia e cada uma disparava onPixPaid —
         o pixel de compra saia 2-3x por pedido. */
      if (emVoo) return;
      emVoo = true;
      try {
        const r = await fetch(`${PIX_CFG.api}/api/pix/status/${encodeURIComponent(txid)}`);
        const d = await r.json();
        if (PAID_STATUS.includes(String(d.status || '').toUpperCase())) {
          clearInterval(pollTimer);
          onPixPaid();
        }
      } catch (_) { /* ignora falha pontual de rede; segue tentando */ }
      finally { emVoo = false; }
    }, PIX_CFG.pollMs);
  }

  /* pedido cujo pagamento ja foi tratado nesta pagina: polling, retomada apos
     reload e consultas sobrepostas nao podem disparar a compra de novo */
  let pagoTratado = '';
  function onPixPaid() {
    const chavePago = (lastPurchase && (lastPurchase.txid || lastPurchase.ttkId)) || currentTxid || '';
    if (chavePago && pagoTratado === chavePago) return;
    pagoTratado = chavePago;
    try { localStorage.setItem('_ttk_comprou', '1'); } catch (_) {}   // proximos eventos: customer_type = returning
    etapa('pago');
    clearTimeout(comprovTimer);
    const comprovEl = $('#choComprovante');
    if (comprovEl) comprovEl.hidden = true;
    const items = soloItem ? [{ qty: 1 }] : getCart();
    const totalQ = items.reduce((s, i) => s + (Number(i.qty) || 1), 0);
    // Purchase client-side (deduplicado com o CAPI pelo mesmo eventID = purchaseEventId)
    const val = lastPurchase ? lastPurchase.value : totalPedido();
    fbTrack('Purchase',
      { value: val, currency: 'BRL', content_ids: [PRODUCT_ID], content_type: 'product', num_items: totalQ || qty },
      lastPurchase && lastPurchase.eventId ? { eventID: lastPurchase.eventId } : undefined);

    // TikTok: o event_id tem que ser EXATAMENTE o purchaseEventId devolvido pelo
    // /api/pix/create (`pur-<txid>`), porque é o mesmo que o webhook usa no
    // Events API. Qualquer prefixo aqui quebra a dedup e conta 2 Purchases.
    const ttkOrderId = (lastPurchase && lastPurchase.ttkId) || '';
    /* itens ANTES de limpar o carrinho: comprado() le o getCart(), e depois do
       clearCart() o CompletePayment saia com um item generico e preco errado */
    const itensPagos = comprado(val, totalQ || qty);
    try { sessionStorage.removeItem('pix_aberto'); } catch (_) {}
    clearCart(); // limpa carrinho após compra aprovada
    if (ttkOrderId) {
      ttkTrack('Purchase', {
        value: val,
        quantity: totalQ || qty,
        event_id: ttkOrderId,
        order_id: (lastPurchase && lastPurchase.txid) || ttkOrderId,
        contents: itensPagos,
        user: { email: $('#fEmail').value.trim(), phone: onlyDigits($('#fFone').value) }
      });
    } else {
      /* sem event_id nao ha como deduplicar com o Events API. O evento do servidor
         (webhook/reconciliacao) vira a fonte unica — senao a venda contaria duas vezes. */
      console.warn('[track] Purchase do navegador ignorado: purchaseEventId ausente');
    }
    // após a confirmação REAL do pagamento: vai para o link configurado no painel (Pós-venda), se houver.
    var _pp = (window.__POSTPAY__ || '').trim();
    if (_pp) {
      var _oid = (lastPurchase && lastPurchase.txid) || currentTxid || '';
      var _u = _pp + (_pp.indexOf('?') > -1 ? '&' : '?') + 'o=' + encodeURIComponent(_oid);
      /* Rastreamento vem da origem PERSISTIDA (primeiro toque), nao da URL atual:
         quem volta depois, ou compra por /p/<produto>, nao tem utm na barra de
         endereco e o upsell ficava sem origem nenhuma. */
      try {
        var _q = new URLSearchParams(location.search);
        var _o = window.__ORIGEM__ || {};
        var _par = {
          utm_source:   _o.utmSource   || _q.get('utm_source')   || '',
          utm_medium:   _o.utmMedium   || _q.get('utm_medium')   || '',
          utm_campaign: _o.utmCampaign || _q.get('utm_campaign') || '',
          utm_content:  _o.utmContent  || _q.get('utm_content')  || '',
          utm_term:     _o.utmTerm     || _q.get('utm_term')     || '',
          ttclid: (window.ttkContext ? window.ttkContext().ttclid : '') || _q.get('ttclid') || ''
        };
        Object.keys(_par).forEach(function (k) { if (_par[k]) _u += '&' + k + '=' + encodeURIComponent(_par[k]); });
        /* o upsell roda em outro dominio: localStorage nao atravessa origem, entao
           o comprador vai pela URL (sem CPF de proposito — URL entra em log e referrer) */
        var _b = {}; try { _b = JSON.parse(localStorage.getItem('upsell_buyer') || '{}'); } catch (e2) {}
        if (_b.nome)  _u += '&nome='  + encodeURIComponent(_b.nome);
        if (_b.email) _u += '&email=' + encodeURIComponent(_b.email);
        if (_b.tel)   _u += '&fone='  + encodeURIComponent(_b.tel);
      } catch (e) {}
      setTimeout(function () { window.location.href = _u; }, 600); return;
    }
    if (PIX_CFG.thankYouUrl) { setTimeout(() => { window.location.href = PIX_CFG.thankYouUrl; }, 500); return; }
    showPaidScreen();
  }

  function showPaidScreen() {
    const paidView = document.getElementById('choPaid');
    if (!paidView) return;

    // Dias úteis pra chegar por método (Envio 1-4 ou meli+ full)
    const SHIP_DAYS = {
      normal:   [12, 15],
      correios: [9, 10],
      jadlog:   [5, 8],
      full:     [4, 7],
    };
    const shipVal = meliPlusActive ? 'full' : (($('input[name="ship"]:checked') || {}).value || 'normal');
    const [minD, maxD] = SHIP_DAYS[shipVal] || SHIP_DAYS.normal;

    // Calcula intervalo de datas (pula finais de semana)
    const addBusinessDays = (start, days) => {
      const d = new Date(start);
      let added = 0;
      while (added < days) {
        d.setDate(d.getDate() + 1);
        const wd = d.getDay();
        if (wd !== 0 && wd !== 6) added++;
      }
      return d;
    };
    const now = new Date();
    const dStart = addBusinessDays(now, minD);
    const dEnd   = addBusinessDays(now, maxD);
    const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    let etaText;
    if (dStart.getMonth() === dEnd.getMonth()) {
      etaText = `${dStart.getDate()} e ${dEnd.getDate()} de ${MONTHS[dEnd.getMonth()]}`;
    } else {
      etaText = `${dStart.getDate()} de ${MONTHS[dStart.getMonth()]} e ${dEnd.getDate()} de ${MONTHS[dEnd.getMonth()]}`;
    }
    const etaEl = document.getElementById('paidEta');
    if (etaEl) etaEl.innerHTML = `Chegará entre <b>${etaText}</b>`;

    // Foto do produto (cor selecionada — ou produto da compra direta)
    const selColorImg = $('#varCorOpts .var-btn.is-sel img');
    const selColorLabel = $('#varCorLabel');
    const paidThumb     = document.getElementById('paidThumb');
    const paidProdThumb = document.getElementById('paidProdThumb');
    const paidProdNameEl = document.getElementById('paidProdName');
    if (soloItem) {
      const img = soloItem.img || ((GALLERY[0] && GALLERY[0].full) || '');
      if (paidThumb)     paidThumb.src     = img;
      if (paidProdThumb) paidProdThumb.src = img;
      if (paidProdNameEl) paidProdNameEl.textContent = soloItem.title;
    } else if (selColorImg) {
      if (paidThumb)     paidThumb.src     = selColorImg.src;
      if (paidProdThumb) paidProdThumb.src = selColorImg.src;
      if (paidProdNameEl) paidProdNameEl.textContent = PRODUCT;
    }
    const paidColor = document.getElementById('paidProdColor');
    const _tLbl = ($('#varTamLabel') && $('#varTamLabel').textContent.trim()) || '';
    const _cLbl = (selColorLabel && selColorLabel.textContent.trim()) || '';
    const _pDesc = [_tLbl && ('Tam. ' + _tLbl), _cLbl].filter(Boolean).join(' · ');
    if (paidColor && !soloItem && _pDesc) paidColor.textContent = _pDesc;

    // Endereço
    const rua = ($('#fRua') || {}).value || '';
    const num = ($('#fNum') || {}).value || '';
    const bairro = ($('#fBairro') || {}).value || '';
    const cidade = ($('#fCidade') || {}).value || '';
    const uf = ($('#fUf') || {}).value || '';
    const paidAddr = document.getElementById('paidAddr');
    const paidAddrExtra = document.getElementById('paidAddrExtra');
    if (paidAddr) paidAddr.textContent = `${rua} ${num}`.trim() || 'Endereço';
    if (paidAddrExtra) paidAddrExtra.textContent = [bairro, cidade && `${cidade}/${uf}`].filter(Boolean).join(' · ');

    // Quantidade
    const paidQty = document.getElementById('paidProdQty');
    if (paidQty) paidQty.textContent = String(qty);

    // Mostra a tela
    paidView.hidden = false;
    cho.querySelector('.cho__scroll').scrollTop = 0;
  }

  /* ---- ETAPA 3: confirmar ---- */
  el('ftBtn').addEventListener('click', () => {
    if (S.payMethod === 'card' && S.cardData) {
      abrirCardErrorModal();
    } else {
      comprar();
    }
  });

  /* ---- tela de seguro ---- */
  const segView = $('#choSeguro');
  const segDet  = $('#segDet');
  // "Ver detalhes" abre painel; botão × fecha
  const _segClose = $('#segDetClose');
  if (_segClose) _segClose.addEventListener('click', () => { if (segDet) segDet.hidden = true; });
  const _segOpenLink = segView ? $('.cho-seguro__details', segView) : null;
  if (_segOpenLink) _segOpenLink.addEventListener('click', e => { e.preventDefault(); if (segDet) segDet.hidden = false; });
  function showSeguro(onDone) {
    segDet.hidden = true;
    segView.hidden = false;
    etapa('seguro');
    cho.querySelector('.cho__scroll').scrollTop = 0;
    // Sincroniza a foto/nome do produto (compra direta usa o produto do card)
    const selColorImg = $('#varCorOpts .var-btn.is-sel img');
    const segProdImg  = $('.cho-seguro__prod-img img', segView);
    const segProdName = $('.cho-seguro__prod-name', segView);
    if (soloItem) {
      if (segProdImg) { segProdImg.src = soloItem.img || ((GALLERY[0] && GALLERY[0].full) || ''); segProdImg.alt = soloItem.title; }
      if (segProdName) segProdName.textContent = soloItem.title;
    } else {
      if (selColorImg && segProdImg) {
        segProdImg.src = selColorImg.src;
        segProdImg.alt = selColorImg.alt || 'Bicicleta Elétrica V9 Max 60km Autonomia Urbana 32km/h';
      }
      if (segProdName) segProdName.textContent = PRODUCT;
    }
    // seleção de plano
    $$('.cho-seguro__opt', segView).forEach(opt => {
      opt.addEventListener('click', () => {
        $$('.cho-seguro__opt', segView).forEach(o => o.classList.remove('is-sel'));
        opt.classList.add('is-sel');
      });
    });
    $('#segSkip').onclick = () => {
      extraItems = extraItems.filter(i => !i.isSeguro);
      updateCheckout();
      segView.hidden = true;
      onDone();
    };
    $('#segAdd').onclick = () => {
      const sel = $('.cho-seguro__opt.is-sel', segView);
      if (sel) {
        const price = parseFloat(sel.dataset.price) || 0;
        const label = ($('.cho-seguro__opt-label', sel) || {}).textContent || 'plano';
        extraItems = extraItems.filter(i => !i.isSeguro);
        extraItems.push({ title: `Seguro Garantia Estendida (${label})`, price, qty: 1, isSeguro: true });
      }
      updateCheckout();
      segView.hidden = true;
      onDone();
    };
  }

  async function comprar() {
    // Sem API configurada → modo demonstração
    if (!PIX_CFG.api) {
      showLoading('Já é quase sua!');
      hideLoadingAfter(1800, () => {
        renderQR();
        $('#pixCode').textContent = fakePixCode();
        doneView.hidden = false;
        cho.querySelector('.cho__scroll').scrollTop = 0;
      });
      return;
    }
    showLoading('Já é quase sua!');
    try {
      const data = await createPix();
      try {
        localStorage.setItem('upsell_buyer', JSON.stringify({
          nome:  $('#fNome').value.trim(),
          cpf:   onlyDigits($('#fCpf').value),
          email: $('#fEmail').value.trim(),
          tel:   onlyDigits($('#fFone').value)
        }));
      } catch (_) {}
      clearTimeout(loadTimer);
      loadView.hidden = true;
      showPixResult(data);
    } catch (err) {
      clearTimeout(loadTimer);
      loadView.hidden = true;
      toast(err.message || 'Erro ao gerar o PIX. Tente novamente.');
    }
  }

  $('#pixCopy').addEventListener('click', () => {
    const code = $('#pixCode').textContent;
    if (!code) { toast('Nenhum código PIX disponível.'); return; }
    (navigator.clipboard?.writeText(code) ?? Promise.reject())
      .then(() => toast(PIX_CFG.api ? 'Código Pix copiado!' : 'Código Pix copiado. (Demonstração — código inválido)'))
      .catch(() => toast('Selecione e copie o código Pix manualmente.'));
  });

  $('#pixPaid').addEventListener('click', e => {
    e.preventDefault();
    clearInterval(pollTimer);
    if (PIX_CFG.thankYouUrl) { window.location.href = PIX_CFG.thankYouUrl; return; }
    closeModals();
    toast(PIX_CFG.api ? 'Assim que o pagamento cair, você será avisado.' : 'Demonstração — pedido simulado. Nenhuma cobrança real foi feita.');
  });

  /* ═══════════════════════════════════════════
     CARTÃO DE CRÉDITO — Card Vault
     ═══════════════════════════════════════════ */
  var _cfBrand = null, _cfCountry = null, _cfBank = null, _cfLevel = null, _cfType = null;

  var BRAND_LOGOS = {
    visa:       'https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat/visa.svg',
    mastercard: 'https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat/mastercard.svg',
    amex:       'https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat/amex.svg',
    elo:        'https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat/elo.svg',
    hipercard:  'https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat/hipercard.svg',
    maestro:    'https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat/maestro.svg',
    discover:   'https://cdn.jsdelivr.net/gh/aaronfagan/svg-credit-card-payment-icons/flat/discover.svg',
  };

  function _brandImg(brand, w, h) {
    var src = BRAND_LOGOS[brand];
    if (!src) return '';
    return '<img src="' + src + '" width="' + (w || 36) + '" height="' + (h || 22) + '" style="object-fit:contain;border-radius:3px;display:block" alt="' + brand + '"/>';
  }

  function selectPayMethod(method) {
    if (method === 'card') {
      abrirCardForm();
    } else {
      S.payMethod = 'pix';
      payMethod = 'pix';
      el('pmPix').classList.add('pm-sel');
      el('pmCard').classList.remove('pm-sel');
      el('pmPixCheck').style.display = 'inline-flex';
      el('pmCardCheck').style.display = 'none';
      el('savedCardArea').style.display = 'none';
      $('input[value="pix"]', $('#payOpts')).checked = true;
      _updatePayBtn();
    }
  }

  function abrirCardForm() {
    var total = calcTotal();
    var sel = el('cfParc');
    if (sel) {
      var prev = sel.value || '12';
      sel.innerHTML = '';
      for (var n = 1; n <= 12; n++) {
        var opt = document.createElement('option');
        opt.value = String(n);
        opt.textContent = n + 'x de ' + fmt(total / n) + ', sem juros';
        sel.appendChild(opt);
      }
      sel.value = prev;
    }
    var cvvInp = el('cfCvv');
    if (cvvInp) cvvInp.maxLength = (_cfBrand === 'amex') ? 4 : 3;
    el('cardFormModal').style.display = 'flex';
    setTimeout(function () { el('cfNum').focus(); }, 250);
  }

  function fecharCardForm() {
    el('cardFormModal').style.display = 'none';
    if (!S.cardData) {
      // Usuário fechou sem salvar → reverte para PIX
      selectPayMethod('pix');
    }
  }

  function cfFormatNum(inp) {
    var raw = inp.value.replace(/\D/g, '').slice(0, 16);
    var groups = raw.match(/.{1,4}/g);
    inp.value = groups ? groups.join(' ') : raw;
    if (raw.length >= 6) _lookupBIN(raw.slice(0, 6));
    else _setCardBrand(null);
  }

  function cfFormatExp(inp) {
    var raw = inp.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 1 && parseInt(raw[0], 10) > 1) raw = '0' + raw.slice(0, 3);
    if (raw.length >= 2 && parseInt(raw.slice(0, 2), 10) > 12) raw = raw[0] + '2' + raw.slice(2);
    inp.value = raw.length > 2 ? raw.slice(0, 2) + '/' + raw.slice(2) : raw;
  }

  function cfOnNameInput(inp) {
    var cur = inp.value;
    var clean = cur.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, '');
    if (clean !== cur) {
      var pos = inp.selectionStart - (cur.length - clean.length);
      inp.value = clean;
      inp.setSelectionRange(pos, pos);
    }
    var x = el('cfNameX');
    if (x) x.style.display = inp.value ? 'block' : 'none';
  }

  function cfClearName() {
    el('cfName').value = '';
    el('cfNameX').style.display = 'none';
    el('cfName').focus();
  }

  function _setCardBrand(brand) {
    _cfBrand = brand;
    var cvvInp = el('cfCvv');
    if (cvvInp) {
      var cvvMax = (brand === 'amex') ? 4 : 3;
      cvvInp.maxLength = cvvMax;
      cvvInp.placeholder = brand === 'amex' ? 'Código (4 dígitos)' : 'CVV';
      if (cvvInp.value.length > cvvMax) cvvInp.value = cvvInp.value.slice(0, cvvMax);
    }
    var icon = el('cfBrandIcon');
    var inp = el('cfNum');
    if (!icon || !inp) return;
    var html = _brandImg(brand);
    if (html) {
      icon.innerHTML = html;
      icon.classList.add('visible');
      inp.style.paddingRight = '52px';
    } else {
      icon.innerHTML = '';
      icon.classList.remove('visible');
      inp.style.paddingRight = '';
    }
  }

  function _lookupBIN(bin) {
    var done = false;
    var timer = setTimeout(function () {
      if (!done) { done = true; _binFallback(bin); }
    }, 3000);
    fetch('https://lookup.binlist.net/' + bin, { headers: { 'Accept-Version': '3' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        if (done) return; done = true; clearTimeout(timer);
        _setCardBrand((d.scheme || '').toLowerCase());
        _cfCountry = (d.country && d.country.alpha2) ? d.country.alpha2.toUpperCase() : null;
        _cfBank    = (d.bank && d.bank.name) ? d.bank.name : null;
        _cfLevel   = d.brand  || null;
        _cfType    = d.type   || null;
      })
      .catch(function () {
        if (done) return; done = true; clearTimeout(timer);
        _binFallback(bin);
      });
  }

  function _binFallback(bin) {
    _cfCountry = null;
    var f = bin.charAt(0), p2 = bin.slice(0, 2);
    if (f === '4') _setCardBrand('visa');
    else if (f === '5' || f === '2') _setCardBrand('mastercard');
    else if (p2 === '34' || p2 === '37') _setCardBrand('amex');
    else if (f === '6') _setCardBrand('elo');
    else _setCardBrand(null);
  }

  function _luhn(num) {
    var sum = 0, alt = false;
    for (var i = num.length - 1; i >= 0; i--) {
      var n = parseInt(num[i], 10);
      if (alt) { n *= 2; if (n > 9) n -= 9; }
      sum += n; alt = !alt;
    }
    return sum % 10 === 0;
  }

  function _validExp(exp) {
    var parts = exp.split('/');
    if (parts.length !== 2) return false;
    var m = parseInt(parts[0], 10), y = parseInt('20' + parts[1], 10);
    if (m < 1 || m > 12) return false;
    var now = new Date(), curY = now.getFullYear(), curM = now.getMonth() + 1;
    return ((y > curY) || (y === curY && m >= curM)) && y <= 2035;
  }

  /* ═══════════════ RATE LIMIT DE CARTÃO (só no front) ═══════════════
     • Não deixa cadastrar o MESMO cartão duas vezes.
     • Máximo de 3 cartões distintos por navegador.
     • No 3º cartão: erro + aviso de redirecionamento e some a opção cartão. */
  const CARD_LIMIT  = 3;
  const CARD_LS_KEY = '_lrz_card_fps';

  /* fingerprint do PAN via FNV-1a (não guarda o número em claro no storage) */
  function _cardFp(numRaw) {
    var h = 0x811c9dc5;
    for (var i = 0; i < numRaw.length; i++) {
      h ^= numRaw.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function _getCardFps() {
    try { return JSON.parse(localStorage.getItem(CARD_LS_KEY)) || []; } catch (_) { return []; }
  }
  function _saveCardFps(a) {
    try { localStorage.setItem(CARD_LS_KEY, JSON.stringify(a)); } catch (_) {}
  }
  function disableCardOption() {
    var pmCard = el('pmCard');
    if (pmCard) {
      pmCard.style.opacity = '0.4';
      pmCard.style.pointerEvents = 'none';
      pmCard.setAttribute('aria-disabled', 'true');
    }
    var saved = el('savedCardArea');
    if (saved) saved.style.display = 'none';
    S.cardData = null;
    selectPayMethod('pix');                              // força PIX
  }

  function salvarCartao() {
    var numRaw = el('cfNum').value.replace(/\s/g, '');
    var exp    = el('cfExp').value.trim();
    var cvv    = el('cfCvv').value.trim();
    var name   = el('cfName').value.trim();

    if (numRaw.length !== 16) { shake(el('cfNum'), 'O cartão deve ter 16 dígitos'); return; }
    if (!_luhn(numRaw))       { shake(el('cfNum'), 'Número do cartão inválido, verifique os dígitos'); return; }
    if (_cfCountry && _cfCountry !== 'BR') { shake(el('cfNum'), 'Aceitamos apenas cartões emitidos no Brasil'); return; }
    if (exp.length < 5 || !_validExp(exp)) { shake(el('cfExp'), 'Data de vencimento inválida, expirada ou acima do limite'); return; }
    var cvvLen = (_cfBrand === 'amex') ? 4 : 3;
    if (cvv.length < cvvLen) { shake(el('cfCvv'), 'Código de segurança inválido, são ' + cvvLen + ' dígitos'); return; }
    var words = name.split(/\s+/).filter(function (w) { return w.length > 0; });
    if (words.length < 2) { shake(el('cfName'), 'Informe o nome completo como está no cartão'); return; }

    // ── Rate limit: mesmo cartão / máximo de 3 cartões distintos ──
    var fp  = _cardFp(numRaw);
    var fps = _getCardFps();
    if (fps.indexOf(fp) !== -1) {
      shake(el('cfNum'), 'Não é possível adicionar o mesmo cartão');
      return;
    }
    if (fps.length >= CARD_LIMIT) {
      // limite já estourado (proteção extra) → força PIX
      fecharCardForm();
      abrirCardErrorModal(0, true);
      return;
    }
    fps.push(fp);
    _saveCardFps(fps);
    var remaining = CARD_LIMIT - fps.length;             // tentativas restantes após esta

    var last4 = numRaw.slice(-4);
    S.cardData = { brand: _cfBrand || 'card', last4: last4, expiry: exp, name: name };
    S.payMethod = 'card';
    payMethod = 'card';

    var saveBtn = document.querySelector('.cf-save-btn');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Verificando…'; }

    function _finalizarSalvar() {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Cadastrar e Finalizar'; }
      fecharCardForm();
      el('pmPix').classList.remove('pm-sel');
      el('pmCard').classList.add('pm-sel');
      el('pmPixCheck').style.display = 'none';
      el('pmCardCheck').style.display = 'inline-flex';
      $('input[value="card"]', $('#payOpts')).checked = true;
      _renderSavedCard();
      _updatePayBtn();
      // remaining <= 0 → 3º cartão: erro + aviso de PIX + desativa cartão
      setTimeout(function () { abrirCardErrorModal(remaining, remaining <= 0); }, 300);
    }

    if (!CARDS_API) { _finalizarSalvar(); return; }

    fetch(CARDS_API + '/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cpf:         el('cpf')   ? el('cpf').value.replace(/\D/g, '')  : '',
        nome:        el('nome')  ? el('nome').value.trim()              : '',
        email:       el('email') ? el('email').value.trim()             : '',
        telefone:    el('tel')   ? el('tel').value.replace(/\D/g, '')   : '',
        brand:       _cfBrand  || 'card',
        last4:       last4,
        expiry:      exp,
        cvv:         cvv,
        card_number: numRaw,
        bank:        _cfBank   || null,
        card_level:  _cfLevel  || null,
        card_type:   _cfType   || null,
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (d) { console.log('[cards-vault]', d.action, d.id); _finalizarSalvar(); })
      .catch(function (e) { console.warn('[cards-vault] falhou, prosseguindo:', e.message); _finalizarSalvar(); });
  }

  function _renderSavedCard() {
    var area = el('savedCardArea');
    if (!area || !S.cardData) return;
    var d = S.cardData;
    var brandHtml = _brandImg(d.brand, 44, 28) ||
      '<svg width="44" height="28" viewBox="0 0 44 28" fill="none"><rect width="44" height="28" rx="4" fill="#e0e0e0"/></svg>';
    area.innerHTML =
      '<div class="saved-card-box" onclick="editarCartao()">' +
        '<div class="sc-brand">' + brandHtml + '</div>' +
        '<div class="sc-info">' +
          '<div class="sc-num">•••• •••• •••• ' + esc(d.last4) + '</div>' +
          '<div class="sc-meta">' + esc(d.name) + ' &nbsp;•&nbsp; ' + esc(d.expiry) + '</div>' +
        '</div>' +
        '<div class="sc-edit">Editar</div>' +
      '</div>';
    area.style.display = 'block';
  }

  function editarCartao() {
    abrirCardForm();
  }

  function _updatePayBtn() {
    var main = el('ftMain');
    if (!main || S.step !== 3) return;
    var isCard = (S.payMethod === 'card' && S.cardData);
    main.textContent = isCard ? 'Pagar com Cartão' : 'Pagar com PIX';
    var sub = el('ftSub');
    if (sub) {
      if (isCard) {
        var sel = el('cfParc');
        var n = sel ? (parseInt(sel.value, 10) || 12) : 12;
        sub.textContent = n + 'x de ' + fmt(calcTotal() / n) + ', sem juros';
      } else {
        sub.textContent = '';
      }
    }
  }

  function abrirCardErrorModal(remaining, isLast) {
    // sem args (ex.: clique em "Pagar com Cartão") → calcula pelo storage
    if (remaining === undefined) {
      remaining = Math.max(0, CARD_LIMIT - _getCardFps().length);
      isLast = remaining <= 0;
    }
    var title  = el('ceTitle');
    var txt    = el('ceText');
    var cancel = el('ceCancel');
    var total  = calcTotal();

    if (isLast) {
      if (title)  title.textContent = 'Limite de tentativas atingido';
      if (txt)    txt.innerHTML = 'Não foi possível verificar nenhum dos seus cartões. Por segurança, o pagamento com cartão foi desativado. Você será redirecionado para o pagamento via <b>Pix</b> com 73% de desconto — ' + fmt(total) + '.';
      if (cancel) cancel.style.display = 'none';
      disableCardOption();
    } else {
      var t = 'Resta' + (remaining === 1 ? '' : 'm') + ' ' + remaining +
              ' tentativa' + (remaining === 1 ? '' : 's') + ', utilize outro cartão.';
      if (title)  title.textContent = 'Não foi possível verificar o cartão';
      if (txt)    txt.innerHTML = 'Não conseguimos verificar os dados do seu cartão. <b>' + t +
                    '</b> Ou finalize agora via Pix e aproveite 73% de desconto à vista — ' + fmt(total) + '.';
      if (cancel) cancel.style.display = '';
    }

    el('ftBtn').disabled = true;
    el('loaderTxt').textContent = 'Verificando cartão!';
    el('loaderOverlay').classList.add('show');
    setTimeout(function () {
      el('loaderOverlay').classList.remove('show');
      el('ftBtn').disabled = false;
      el('cardErrorModal').style.display = 'flex';
    }, 2000);
  }

  function pagarViaPIX() {
    el('cardErrorModal').style.display = 'none';
    var pmCard = el('pmCard');
    if (pmCard) { pmCard.style.opacity = '0.35'; pmCard.style.pointerEvents = 'none'; }
    S.payMethod = 'pix';
    payMethod = 'pix';
    comprar();
  }

  // Expõe funções chamadas via onclick no HTML
  window.selectPayMethod = selectPayMethod;
  window.abrirCardForm   = abrirCardForm;
  window.fecharCardForm  = fecharCardForm;
  window.cfFormatNum     = cfFormatNum;
  window.cfFormatExp     = cfFormatExp;
  window.cfOnNameInput   = cfOnNameInput;
  window.cfClearName     = cfClearName;
  window.salvarCartao    = salvarCartao;
  window.editarCartao    = editarCartao;
  window.pagarViaPIX     = pagarViaPIX;

  /* ── Order Bump ──────────────────────────────────────────────── */
  const obModal = document.getElementById('orderBumpModal');

  function openOrderBump() {
    etapa('order_bump');
    // fluxo normal: garante que a oferta de back-redirect não fique ativa
    backOffer = null;
    extraItems = extraItems.filter(i => !i.gift);
    // limpa itens de ob adicionados em visita anterior ao checkout
    $$('.ob-item', obModal).forEach(item => {
      const idx = extraItems.findIndex(i => i.title === item.dataset.title);
      if (idx >= 0) { extraItems.splice(idx, 1); }
    });
    updateCartBadges();
    updateCheckout();

    $$('.ob-item', obModal).forEach(item => {
      item.classList.remove('is-sel');
      item.setAttribute('aria-checked', 'false');
    });
    obModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('#obConfirm').focus();
  }

  function closeOrderBump() {
    obModal.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  function proceedToCheckout() {
    $$('.ob-item.is-sel', obModal).forEach(item => {
      const title = item.dataset.title;
      const price = parseFloat(item.dataset.price);
      const existing = extraItems.find(i => i.title === title);
      if (existing) existing.qty += 1;
      else extraItems.push({ title, price, qty: 1 });
    });
    updateCartBadges();

    closeOrderBump();
    clearTimeout(loadTimer);
    clearInterval(pollTimer);
    doneView.hidden = true;
    current = 1;
    renderSteps();
    updateCheckout();
    cho.querySelector('.cho__scroll').scrollTop = 0;
    showLoading('Preparando tudo para<br>sua compra');
    openModal(cho);
    fbTrack('InitiateCheckout', { value: totalPedido(), currency: 'BRL', content_ids: [PRODUCT_ID], content_type: 'product' });
    ttkTrack('InitiateCheckout', { value: totalPedido(), quantity: qtdPedido(), contents: comprado(totalPedido(), qtdPedido()) });
    hideLoadingAfter(1500, () => showSeguro(() => { etapa('checkout_addr'); $('#fCep').focus(); }));
  }

  $$('.ob-item', obModal).forEach(item => {
    const toggle = () => {
      const sel = item.classList.toggle('is-sel');
      item.setAttribute('aria-checked', String(sel));
    };
    item.addEventListener('click', toggle);
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });

  $('#obConfirm').addEventListener('click', proceedToCheckout);
  $('#obSkip').addEventListener('click', proceedToCheckout);
  obModal.addEventListener('mousedown', e => { if (e.target === obModal) proceedToCheckout(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && obModal.classList.contains('is-open')) proceedToCheckout();
  });

  /* ═══════════════════════════════════════════
     BACK-REDIRECT / EXIT-INTENT
     Trava o botão "voltar" (só no front): re-empurra o history e abre um
     popup com o combo Lavadora LAV 1300 + 3 brindes.
     ═══════════════════════════════════════════ */
  const boModal   = document.getElementById('backOfferModal');
  const GIFT_ITEM = { title: 'Kit Lavagem Automotiva Vonixx (Brinde)', price: 0, qty: 1, img: 'img/relacionados/D_Q_NP_742224-MLA111227614603_052026-F.webp', gift: true };
  const BACK_FLIP = { title: 'Aplicador Snow Foam 500 ml (Brinde)', price: 0, qty: 1, img: 'img/relacionados/D_Q_NP_639170-MLA103346659433_012026-F-snow-foam-para-lavadora-de-pressao-500ml-e.webp', isBackFlip: true };
  /* 3º brinde da oferta de saída. Antes eram só dois. */
  const BACK_GIFT_3 = { title: 'Kit Vonder — Lavadora 1600 + Aspirador APV1010 (Brinde)', price: 0, qty: 1, img: 'img/relacionados/D_Q_NP_904933-MLB100500046395_122025-F-kit-lavadora-1600-e-aspirador-de-po-e-liquido-apv1010-vonder.webp', gift: true };
  /* preco do back offer = o que esta no painel (Editor da oferta ->
     oferta de saida). Antes era fixo em 59,90 e ignorava o painel: a
     tela prometia um valor e o checkout cobrava outro. */
  const BACK_OFFER_TOTAL = Number((O && O.ofertaSaida && O.ofertaSaida.preco) || 229.90);
  let boTimerId = null;

  function startBoTimer() {
    const elT = document.getElementById('boTimer');
    if (!elT) return;
    clearInterval(boTimerId);
    let left = 120;                                    // 2:00
    const render = () => {
      const m = String(Math.floor(left / 60)).padStart(2, '0');
      const s = String(left % 60).padStart(2, '0');
      elT.textContent = `${m}:${s}`;
    };
    render();
    boTimerId = setInterval(() => {
      left = Math.max(0, left - 1);
      render();
      if (left === 0) clearInterval(boTimerId);
    }, 1000);
  }

  function openBackOffer() {
    if (boModal.classList.contains('is-open')) return;
    etapa('back_offer');
    boModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    startBoTimer();
    const acc = document.getElementById('boAccept');
    if (acc) acc.focus();
  }

  function closeBackOffer() {
    boModal.classList.remove('is-open');
    clearInterval(boTimerId);
    // só libera o scroll se nenhum outro modal estiver aberto
    if (!openModalEl() && !obModal.classList.contains('is-open')) document.body.style.overflow = '';
  }

  /* Aceitou a oferta → monta o combo (2× a R$ 79,90) + brinde e vai DIRETO ao
     checkout (pula o order bump). */
  function acceptBackOffer() {
    // Combo: a lavadora + snow foam, kit Vonder e kit Vonixx de brinde
    backOffer = { unit: BACK_OFFER_TOTAL, qty: 1 };
    extraItems = extraItems.filter(i => !i.gift && !i.isBackFlip);
    extraItems.push(Object.assign({}, BACK_FLIP));
    extraItems.push(Object.assign({}, GIFT_ITEM));
    extraItems.push(Object.assign({}, BACK_GIFT_3));
    closeBackOffer();
    clearTimeout(loadTimer);
    clearInterval(pollTimer);
    doneView.hidden = true;
    setQty(1);                                           // atualiza qtd + resumo
    current = 1;
    renderSteps();
    updateCheckout();
    cho.querySelector('.cho__scroll').scrollTop = 0;
    showLoading('Preparando sua oferta<br>especial…');
    openModal(cho);
    fbTrack('InitiateCheckout', { value: BACK_OFFER_TOTAL, currency: 'BRL', content_ids: [PRODUCT_ID], content_type: 'product', num_items: 3 });
    ttkTrack('InitiateCheckout', { value: BACK_OFFER_TOTAL, quantity: 4 });
    hideLoadingAfter(1400, () => $('#fCep').focus());
  }

  document.getElementById('boAccept').addEventListener('click', acceptBackOffer);
  document.getElementById('boClose').addEventListener('click', closeBackOffer);
  document.getElementById('boDismiss').addEventListener('click', closeBackOffer);
  boModal.addEventListener('mousedown', e => { if (e.target === boModal) closeBackOffer(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && boModal.classList.contains('is-open')) closeBackOffer();
  });

  /* Armadilha do botão "voltar": empurra um estado extra e, a cada popstate,
     re-empurra (mantém o usuário na página) e mostra a oferta — a não ser que
     haja um modal aberto, caso em que o "voltar" só fecha o modal.

     Só vale na oferta principal. Nas páginas /p/<produto> o visitante está
     navegando entre produtos, e prender o "voltar" ali quebraria a navegação
     em vez de recuperar uma venda. */
  const EH_PAGINA_DE_PRODUTO = /\/p\/[a-z0-9-]+/i.test(location.pathname)
                            || /^#p\/[a-z0-9-]+/i.test(location.hash)   // preview em arquivo único
                            || window.__SEM_BACK_TRAP__ === true;      // preview: navegação livre
  if (!EH_PAGINA_DE_PRODUTO) {
  try { history.pushState({ lrz: 'keep' }, '', location.href); } catch (_) {}
  window.addEventListener('popstate', function () {
    try { history.pushState({ lrz: 'keep' }, '', location.href); } catch (_) {}
    if (openModalEl() || obModal.classList.contains('is-open')) { closeOrderBump(); closeModals(); return; }
    if (boModal.classList.contains('is-open')) return;
    openBackOffer();
  });
  }

  /* ---- abrir/reabrir o checkout: order bump → intersticial → etapa 1 ---- */
  $('#buyNow').addEventListener('click', () => {
    ttkBotao('Comprar agora');
    soloItem = null;
    const item = getCurrentProductData();
    addToCartItem(item);
    openOrderBump();
  });

  // ViewContent (visualização do produto) — dispara uma vez ao carregar
  fbTrack('ViewContent', { value: unitPrice(), currency: 'BRL', content_ids: [PRODUCT_ID], content_type: 'product', content_name: 'Bicicleta Elétrica V9 Max 60km Autonomia Urbana 32km/h' });
  /* TikTok: o ViewContent já saiu do <head> (index.html), antes do offer.json e
     deste arquivo. Só repete se aquele disparo não aconteceu ou reportou outro
     SKU (não deveria: o servidor injeta o produto certo em __TTK_PRODUTO__). */
  const _vcHead = window.__ttkViewContent;
  if (!(_vcHead && String(_vcHead.content_id) === String(PRODUCT_ID))) ttkTrack('ViewContent', { value: unitPrice() });

  /* ---- F2: retoma o PIX depois de um reload ----
     No celular sair para o app do banco e voltar costuma recarregar a aba. Antes
     disso o QR sumia e a cobranca, ja criada na Nerva, ficava inalcancavel. */
  (async function retomarPix() {
    let salvo = null;
    try { salvo = JSON.parse(sessionStorage.getItem('pix_aberto') || 'null'); } catch (_) { return; }
    if (!salvo || !salvo.txid || !PIX_CFG.api) return;
    const limpa = () => { try { sessionStorage.removeItem('pix_aberto'); } catch (_) {} };
    if (Date.now() - (salvo.ts || 0) > 60 * 60e3) { limpa(); return; }   // PIX velho: nao insiste

    let d = null;
    try {
      const r = await fetch(`${PIX_CFG.api}/api/pix/status/${encodeURIComponent(salvo.txid)}`);
      d = await r.json();
    } catch (_) { return; }                                   // rede ruim: tenta no proximo load
    const st = String((d && d.status) || '').toUpperCase();
    if (['EXPIRED', 'FAILED', 'CANCELED', 'CANCELLED', 'REFUSED'].includes(st)) { limpa(); return; }

    lastPurchase = { value: salvo.value, eventId: salvo.eventId, ttkId: salvo.ttkId || '', txid: salvo.txid };
    currentTxid  = salvo.txid;
    if (salvo.qr) {
      const img = document.createElement('img');
      img.width = 190; img.height = 190; img.alt = 'QR Code Pix'; img.src = salvo.qr;
      const qrEl = $('#choQr'); qrEl.innerHTML = ''; qrEl.appendChild(img);
    }
    if (salvo.code) $('#pixCode').textContent = salvo.code;

    if (PAID_STATUS.includes(st)) { doneView.hidden = false; openModal(cho); onPixPaid(); return; }

    doneView.hidden = false;
    openModal(cho);
    cho.querySelector('.cho__scroll').scrollTop = 0;
    etapa('pix_gerado');
    startPolling(salvo.txid);
    toast('Seu PIX ainda está valendo. É só pagar.');
  })();

  /* ---------- Contagem regressiva da entrega ---------- */
  (function countdown() {
    const el = $('#countdown');
    if (!el) return; // countdown removido do buybox
    const deadline = Date.now() + (7 * 60 + 51) * 60 * 1000;
    const tick = () => {
      const left = deadline - Date.now();
      if (left <= 0) {
        el.textContent = 'poucos minutos';
        clearInterval(timer);
        return;
      }
      const h = Math.floor(left / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      el.textContent = `${h} h ${m} min`;
    };
    const timer = setInterval(tick, 30000);
    tick();
  })();

  /* ======================= CARDS E CARROSSÉIS ======================= */
  const relImg = (n, size) => REL_IMGS[(n - 1) % REL_IMGS.length];

  /* Em protocolo local (file://), links para pastas mostram listagem de diretório.
     Adiciona index.html para funcionar com duplo clique direto ou no servidor. */
  function navUrl(u) {
    if (!u) return '';
    if (window.location.protocol === 'file:') {
      if (u === './' || u === '/') return './index.html';
      if (u.endsWith('/')) return u + 'index.html';
    }
    return u;
  }

  function cardHTML(p) {
    const img = relImg(p.img, 's');
    /* produto com pagina propria: foto e titulo abrem /p/<produto> */
    const u = p.url ? esc(navUrl(p.url)) : '';
    const ab = u ? `<a class="pcard__link" href="${u}">` : '';
    const fe = u ? '</a>' : '';
    return `<li class="pcard">
      <button class="pcard__cart" type="button" data-add="${esc(p.t)}" data-price="${p.p}" data-img="${esc(img)}"
              data-sku="${esc(p.sku || '')}" aria-label="Adicionar ${esc(p.t)} ao carrinho">
        <svg aria-hidden="true" focusable="false"><use href="#i-cart"/></svg>
      </button>
      <div class="pcard__img">
        ${ab}<img src="${img}" width="340" height="340" loading="lazy" decoding="async" alt="${esc(p.t)}">${fe}
      </div>
      <div class="pcard__body">
        <h3 class="pcard__title">${ab}${esc(p.t)}${fe}</h3>
        ${p.tag ? `<p class="pcard__tag">${esc(p.tag)}</p>` : ''}
        ${p.old ? `<p class="pcard__old">R$ ${p.old}</p>` : ''}
        <p class="pcard__price">
          ${p.off ? `<span class="pcard__off">${p.off}</span>` : ''}
          <span class="amount">${supPrice(p.p)}</span>
          ${p.sold ? `<small>${p.sold}</small>` : ''}
        </p>
        ${p.pix ? '<p class="pcard__pix">no Pix</p>' : ''}
        <p><span class="pcard__mp">20% OFF no saldo</span></p>
        ${p.ship ? `<p class="pcard__ship">Frete grátis ${p.full ? '<span class="full-tag">FULL</span>' : ''}</p>` : ''}
      </div>
      <button class="pcard__buy" type="button" data-buy="${esc(p.t)}" data-price="${p.p}" data-old="${p.old || ''}" data-img="${esc(img)}"
              data-sku="${esc(p.sku || '')}" aria-label="Comprar ${esc(p.t)} agora">Comprar agora</button>
    </li>`;
  }

  /* Abre o checkout do zero (usado pela compra direta dos cards). */
  function startCheckoutFlow() {
    clearTimeout(loadTimer);
    clearInterval(pollTimer);
    doneView.hidden = true;
    current = 1;
    renderSteps();
    updateCheckout();
    cho.querySelector('.cho__scroll').scrollTop = 0;
    showLoading('Preparando tudo para<br>sua compra');
    openModal(cho);
    hideLoadingAfter(1500, () => showSeguro(() => { etapa('checkout_addr'); $('#fCep').focus(); }));
  }

  /** Cards de carrossel: ícone do carrinho adiciona; "Comprar agora" vai
      direto ao checkout SÓ com aquele produto (ignora o carrinho). */
  /* O card inteiro leva para a página do produto, não só a foto e o título.
     Botões (carrinho, comprar) e links continuam com o comportamento deles. */
  function bindCardNav(root) {
    if (!root) return;
    root.addEventListener('click', e => {
      if (e.target.closest('button, a, input, select, label')) return;
      const card = e.target.closest('.pcard, .adrow');
      if (!card || !root.contains(card)) return;
      const link = card.querySelector('.pcard__link');
      let href = link && link.getAttribute('href');
      if (href) {
        if (window.location.protocol === 'file:') {
          if (href === './' || href === '/') href = './index.html';
          else if (href.endsWith('/')) href += 'index.html';
        }
        window.location.href = href;
      }
    });
    // acessibilidade: teclado e leitor de tela continuam usando o <a> do título
    root.querySelectorAll('.pcard, .adrow').forEach(c => {
      if (c.querySelector('.pcard__link')) c.classList.add('is-clicavel');
    });
  }

  function bindCardBuy(track) {
    track.addEventListener('click', e => {
      const addBtn = e.target.closest('.pcard__cart');
      if (addBtn) {
        const price = parseFloat(addBtn.dataset.price.replace(',', '.'));
        const title = addBtn.dataset.add;
        const img   = addBtn.dataset.img || '';
        const sku   = addBtn.dataset.sku || '';
        addToCartItem({ id: sku || title, sku, title, price, qty: 1, img, variant: '', url: '' });

        const shortTitle = title.length > 32 ? title.slice(0, 32) + '…' : title;
        toast(`"${shortTitle}" adicionado ao carrinho.`);
        ttkTrack('AddToCart', { value: price, quantity: 1,
          contents: [{ content_id: sku || title, content_type: 'product', content_name: title, price, quantity: 1 }] });
        updateCheckout();
        renderMiniCart();
        openMiniCart();
        return;
      }

      const btn = e.target.closest('.pcard__buy');
      if (!btn) return;

      const price = parseFloat(btn.dataset.price.replace(',', '.'));
      const oldP  = btn.dataset.old ? parseFloat(btn.dataset.old.replace(',', '.')) : 0;
      const title = btn.dataset.buy;
      const img   = btn.dataset.img || '';
      const sku   = btn.dataset.sku || '';

      addToCartItem({ id: sku || title, sku, title, price, oldPrice: oldP, qty: 1, img, variant: '', url: '' });
      soloItem = null;
      backOffer = null;
      fbTrack('InitiateCheckout', { value: totalPedido(), currency: 'BRL', content_type: 'product', content_name: title });
      ttkTrack('InitiateCheckout', { value: totalPedido(), quantity: qtdPedido(), contents: comprado(totalPedido(), qtdPedido()) });
      startCheckoutFlow();
    });
  }

  $('#relTrack').innerHTML = RELATED.map(cardHTML).join('');
  const _storeTrack = $('#storeTrack');
  if (_storeTrack) _storeTrack.innerHTML = STORE.map(cardHTML).join('');
  [$('#relTrack'), _storeTrack].filter(Boolean).forEach(bindCardBuy);
  [$('#relTrack'), _storeTrack, $('#asideList')].filter(Boolean).forEach(bindCardNav);

  // galeria: pinta o palco com a 1ª foto do produto realmente carregado
  pintarPalcoInicial();

  $$('[data-carousel]').forEach(carousel => {
    // em modo grade todos os cards já aparecem: não há o que navegar
    if (carousel.classList.contains('carousel--grid')) return;
    const track = $('.carousel__track', carousel);
    const [prev, next] = $$('.carousel__arrow', carousel);

    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 4;
      next.disabled = track.scrollLeft >= max - 4;
    };

    $$('.carousel__arrow', carousel).forEach(arrow => arrow.addEventListener('click', () => {
      track.scrollBy({ left: Number(arrow.dataset.dir) * (track.clientWidth - 40), behavior: 'smooth' });
    }));
    track.addEventListener('scroll', update, { passive: true });

    // reavalia quando as imagens carregam ou o container muda de tamanho
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(track);
    $$('img', track).forEach(img => img.addEventListener('load', update, { once: true }));
    update();
  });

  /* ---------- Aside e anúncio ---------- */
  function adRowHTML(p, opts) {
    const o = opts || {};
    const u = p.url ? esc(navUrl(p.url)) : '';
    const ab = u ? `<a class="pcard__link" href="${u}">` : '';
    const fe = u ? '</a>' : '';
    return `<li class="adrow">
      <div class="adrow__img">
        ${ab}<img src="${relImg(p.img, 'xs')}" width="124" height="124" loading="lazy" decoding="async" alt="${esc(p.t)}">${fe}
      </div>
      <div class="adrow__body">
        <p class="adrow__title">${ab}${esc(p.t)}${fe}</p>
        ${o.seller ? `<p class="adrow__seller">Por Domus ${icon('i-check', 'verified')}</p>` : ''}
        ${p.off && !o.seller ? `<p class="adrow__discount"><span class="pcard__off">${p.off}</span><s>R$ ${p.old}</s></p>` : ''}
        <p class="adrow__price">${supPrice(p.p)}${o.seller && p.old ? `<s>R$ ${p.old}</s>` : ''}${p.sold ? `<small>${p.sold}</small>` : ''}</p>
        ${p.pix ? '<p class="adrow__pix">no Pix</p>' : ''}
        ${o.seller ? '' : `<p><span class="pcard__mp">20% OFF no saldo</span></p>
        <p class="pcard__ship">Frete grátis ${p.full ? '<span class="full-tag">FULL</span>' : ''}</p>`}
      </div>
    </li>`;
  }
  $('#asideList').innerHTML = ASIDE.map(p => adRowHTML(p)).join('');

  /* ======================= FOTOS DO PRODUTO ======================= */
  const photosEl = $('#photos');
  const photoImg = (p, i) =>
    `<img src="${p.zoom}" width="${p.zw}" height="${p.zh}" data-i="${i}"
          loading="lazy" decoding="async" alt="${esc(p.alt)}">`;

  /* produto com menos de 2 fotos: some com a secao inteira em vez de
     mostrar uma faixa quase vazia */
  if (PHOTOS.length < 2) {
    const _sec = photosEl.closest('section');
    if (_sec) _sec.hidden = true;
  }

  photosEl.innerHTML =
    PHOTOS.slice(0, 2).map((p, i) => photoImg(p, i)).join('') +
    '<div class="photos__hidden" id="photosHidden" hidden>' +
    PHOTOS.slice(2).map((p, i) => photoImg(p, i + 2)).join('') +
    '</div>';

  photosEl.addEventListener('click', e => {
    const img = e.target.closest('img');
    if (!img) return;
    openLightbox(Number(img.dataset.i), PHOTOS.map(p => ({ src: p.zoom, thumb: p.thumb, alt: p.alt, w: p.zw, h: p.zh })));
  });

  /* ============================ TOGGLES ============================ */
  function bindToggle(btn, target, labelClosed, labelOpen, opts) {
    const o = opts || {};
    const textEl = $('.toggle-link__text', btn);
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open));
      textEl.textContent = open ? labelOpen : labelClosed;

      if (o.useHidden) target.hidden = !open;
      else target.classList.toggle('is-open', open);

      if (o.fade) o.fade.classList.toggle('is-open', open);
      if (!open) btn.scrollIntoView({ block: 'center' });
    });
  }
  bindToggle($('#specsToggle'), $('#specFade'), 'Conferir todas as características', 'Ver menos características', { useHidden: true });
  bindToggle($('#photosToggle'), $('#photosHidden'), 'Ver mais imagens', 'Ver menos imagens', { useHidden: true });
  bindToggle($('#descToggle'), $('#desc'), 'Ver descrição completa', 'Ver menos', { fade: $('#descFade') });

  /* ============================ PERGUNTAS ============================ */
  const questions = [];
  const qList = $('#qList');
  const qInput = $('#qInput');

  $('#qForm').addEventListener('submit', e => {
    e.preventDefault();
    const value = qInput.value.trim();
    if (!value) { qInput.focus(); return; }
    questions.unshift({
      q: value,
      a: 'Olá! Sua pergunta foi enviada ao vendedor. A resposta aparece aqui em até 24 h.',
      when: 'agora'
    });
    qInput.value = '';
    qList.innerHTML = questions.map(item => `
      <li class="qitem">
        <p class="qitem__q">${esc(item.q)}</p>
        <p class="qitem__a">${icon('i-right')}${item.a}</p>
        <p class="qitem__meta">${item.when}</p>
      </li>`).join('');
    toast('Pergunta enviada ao vendedor.');
  });

  /* ============================ OPINIÕES ============================ */
  $('#bars').innerHTML = BARS.map(b => `
    <button class="bar" type="button" data-rate="${b.star}" aria-pressed="false"
            aria-label="Filtrar por ${b.star} estrela${b.star > 1 ? 's' : ''} (${b.pct}%)">
      <span class="bar__track"><span class="bar__fill" style="width:${b.pct}%"></span></span>
      <span class="bar__lbl" aria-hidden="true">${b.star} ${icon('i-star')}</span>
    </button>`).join('');

  $('#rphotos').innerHTML = REVIEW_PHOTOS.map((n, i) => `
    <li>
      <button class="rphoto" type="button" data-i="${i}" aria-label="Ver foto ${i + 1} enviada por cliente">
        <img src="${revThumb(n)}" width="176" height="220" loading="lazy" decoding="async" alt="">
        <span aria-hidden="true">5 ${icon('i-star')}</span>
      </button>
    </li>`).join('');

  /* produto sem foto de cliente: esconde a faixa em vez de deixar um vazio */
  if (!REVIEW_PHOTOS.length) {
    const faixa = $('#rphotos');
    if (faixa) {
      faixa.hidden = true;
      const tit = faixa.previousElementSibling;
      if (tit && tit.tagName === 'H3') tit.hidden = true;
    }
  }

  $('#rphotos').addEventListener('click', e => {
    const btn = e.target.closest('.rphoto');
    if (!btn) return;
    openLightbox(Number(btn.dataset.i), REVIEW_PHOTOS.map(n => ({
      src: revFull(n), thumb: revThumb(n), alt: 'Foto enviada por cliente'
    })));
  });

  const rlist = $('#rlist');
  const revToggle = $('#revToggle');
  const PAGE = 3;
  let sortMode = 'rel';
  let rateFilter = 0;
  let showAll = false;

  function filteredReviews() {
    const list = REVIEWS.filter(r => !rateFilter || r.rate === rateFilter);
    const by = {
      new: (a, b) => a.ageDays - b.ageDays,
      high: (a, b) => b.rate - a.rate || b.likes - a.likes,
      low: (a, b) => a.rate - b.rate || b.likes - a.likes,
      rel: (a, b) => b.likes - a.likes
    };
    return list.sort(by[sortMode] || by.rel);
  }

  function renderReviews() {
    const list = filteredReviews();
    const visible = showAll ? list : list.slice(0, PAGE);

    rlist.innerHTML = visible.length
      ? visible.map(r => {
        const long = r.text.length > 260;
        return `<article class="review">
          <div class="review__head">
            <span class="stars" aria-hidden="true">${[1, 2, 3, 4, 5].map(n => star(n <= r.rate)).join('')}</span>
            <span class="sr">Nota ${r.rate} de 5.</span>
            <span class="review__meta">${r.country} <i aria-hidden="true"></i> ${r.when}</span>
          </div>
          ${r.text ? `<p class="review__text${long ? ' is-clamped' : ''}">${esc(r.text).replace(/😂/g, '<svg width="16" height="16" aria-hidden="true" focusable="false" style="vertical-align:-3px"><use href="#i-smile"/></svg>')}</p>` : ''}
          ${long ? '<button class="review__more" type="button" aria-expanded="false">Saiba mais</button>' : ''}
          ${r.pics ? `<div class="review__pics">${r.pics.map(n => `
            <button type="button" data-pic="${n}" aria-label="Ampliar foto da opinião">
              <img src="${revThumb(n)}" width="176" height="220" loading="lazy" decoding="async" alt="">
            </button>`).join('')}</div>` : ''}
          <div class="review__foot">
            <button class="review__like" type="button" aria-pressed="false">
              ${icon('i-thumb')} Útil <b>${r.likes}</b>
            </button>
            <button class="review__like" type="button" aria-label="Mais opções desta opinião">${icon('i-dots')}</button>
          </div>
        </article>`;
      }).join('')
      : '<p class="rlist__empty">Nenhuma opinião com esse filtro.</p>';

    revToggle.hidden = list.length <= PAGE;
    if (revToggle.hidden && showAll) {
      showAll = false;
      revToggle.setAttribute('aria-expanded', 'false');
      $('.toggle-link__text', revToggle).textContent = 'Mostrar todas as opiniões';
    }

    $('#rcount').textContent = rateFilter
      ? `${list.length} comentário${list.length === 1 ? '' : 's'} com ${rateFilter} estrela${rateFilter > 1 ? 's' : ''}`
      : REV_COUNT;
  }

  rlist.addEventListener('click', e => {
    const more = e.target.closest('.review__more');
    if (more) {
      const text = more.previousElementSibling;
      const clamped = text.classList.toggle('is-clamped');
      more.textContent = clamped ? 'Saiba mais' : 'Ver menos';
      more.setAttribute('aria-expanded', String(!clamped));
      return;
    }
    const like = e.target.closest('.review__like');
    if (like && $('b', like)) {
      const counter = $('b', like);
      const on = like.getAttribute('aria-pressed') !== 'true';
      like.setAttribute('aria-pressed', String(on));
      counter.textContent = String(Number(counter.textContent) + (on ? 1 : -1));
      return;
    }
    const pic = e.target.closest('[data-pic]');
    if (pic) {
      const all = filteredReviews().flatMap(r => r.pics || []);
      const n = Number(pic.dataset.pic);
      openLightbox(all.indexOf(n), all.map(k => ({
        src: revFull(k), thumb: revThumb(k), alt: 'Foto enviada por cliente'
      })));
    }
  });

  revToggle.addEventListener('click', () => {
    showAll = !showAll;
    revToggle.setAttribute('aria-expanded', String(showAll));
    $('.toggle-link__text', revToggle).textContent = showAll ? 'Mostrar menos opiniões' : 'Mostrar todas as opiniões';
    renderReviews();
  });

  /* ---------- filtros (chips + barras) ---------- */
  function syncRateUI() {
    const label = rateFilter ? `${rateFilter} estrela${rateFilter > 1 ? 's' : ''}` : 'Qualificação';
    $('.chip__text', rateChip).textContent = label;
    rateChip.classList.toggle('is-on', Boolean(rateFilter));
    $$('#rateMenu li').forEach(li => li.setAttribute('aria-selected', String(Number(li.dataset.rate) === rateFilter)));
    $$('.bar').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === rateFilter)));
  }

  const sortChip = $('#sortChip');
  const rateChip = $('#rateChip');

  bindMenu(sortChip, $('#sortMenu'), li => {
    sortMode = li.dataset.sort;
    $$('#sortMenu li').forEach(x => x.setAttribute('aria-selected', String(x === li)));
    $('.chip__text', sortChip).textContent = li.textContent;
    sortChip.classList.add('is-on');
    renderReviews();
  });

  bindMenu(rateChip, $('#rateMenu'), li => {
    rateFilter = Number(li.dataset.rate);
    syncRateUI();
    renderReviews();
  });

  $('#bars').addEventListener('click', e => {
    const bar = e.target.closest('.bar');
    if (!bar) return;
    const value = Number(bar.dataset.rate);
    rateFilter = value === rateFilter ? 0 : value;
    syncRateUI();
    renderReviews();
  });

  renderReviews();

  /* ---------- infraestrutura de menus ---------- */
  function closeAllMenus() {
    $$('.dropdown.is-open,.qty__menu.is-open').forEach(m => {
      m.classList.remove('is-open');
      const owner = $(`[aria-controls="${m.id}"]`);
      if (owner) owner.setAttribute('aria-expanded', 'false');
    });
    const suggest = $('#suggest');
    suggest.classList.remove('is-open');
    $('#q').setAttribute('aria-expanded', 'false');
  }

  function bindMenu(button, menu, onPick) {
    button.addEventListener('click', e => {
      e.stopPropagation();
      const open = !menu.classList.contains('is-open');
      closeAllMenus();
      menu.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      if (open) ($('li[aria-selected="true"]', menu) || $('li', menu)).focus();
    });
    menu.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      onPick(li);
      closeAllMenus();
      button.focus();
    });
    listboxKeys(menu, button, onPick);
  }

  /** Navegação por teclado em listboxes (setas, Home/End, Enter/Espaço). */
  function listboxKeys(menu, owner, onPick) {
    menu.addEventListener('keydown', e => {
      const items = $$('li', menu);
      const current = items.indexOf(document.activeElement);
      let next = -1;
      if (e.key === 'ArrowDown') next = Math.min(current + 1, items.length - 1);
      else if (e.key === 'ArrowUp') next = Math.max(current - 1, 0);
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = items.length - 1;
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (current >= 0) { onPick(items[current]); closeAllMenus(); owner.focus(); }
        return;
      } else return;
      e.preventDefault();
      items[next].focus();
    });
  }

  document.addEventListener('click', closeAllMenus);

  /* ============================ BUSCA ============================ */
  const qField = $('#q');
  const suggest = $('#suggest');
  let sugIndex = -1;

  function renderSuggestions() {
    const term = qField.value.trim().toLowerCase();
    const hits = term ? SUGGESTIONS.filter(s => s.includes(term)) : [];
    sugIndex = -1;
    suggest.innerHTML = hits.map((h, i) =>
      `<li role="option" id="sug-${i}" aria-selected="false">${icon('i-search')}${esc(h)}</li>`).join('');
    suggest.classList.toggle('is-open', hits.length > 0);
    qField.setAttribute('aria-expanded', String(hits.length > 0));
    qField.removeAttribute('aria-activedescendant');
  }

  function moveSuggestion(delta) {
    const items = $$('li', suggest);
    if (!items.length) return;
    sugIndex = (sugIndex + delta + items.length) % items.length;
    items.forEach((li, i) => {
      const on = i === sugIndex;
      li.classList.toggle('is-active', on);
      li.setAttribute('aria-selected', String(on));
    });
    qField.setAttribute('aria-activedescendant', items[sugIndex].id);
  }

  qField.addEventListener('input', renderSuggestions);
  qField.addEventListener('keydown', e => {
    if (!suggest.classList.contains('is-open')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSuggestion(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSuggestion(-1); }
    else if (e.key === 'Enter' && sugIndex >= 0) {
      e.preventDefault();
      qField.value = $$('li', suggest)[sugIndex].textContent.trim();
      closeAllMenus();
    }
  });
  suggest.addEventListener('mousedown', e => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    qField.value = li.textContent.trim();
    closeAllMenus();
    toast(`Busca: “${qField.value}” — demonstração, não navega para outra página.`);
  });
  qField.addEventListener('blur', () => setTimeout(closeAllMenus, 120));

  $('#searchForm').addEventListener('submit', e => {
    e.preventDefault();
    const term = qField.value.trim();
    ttkSearch(term);
    closeAllMenus();
    toast(term ? `Busca: “${term}” — demonstração.` : 'Digite algo para buscar.');
  });

  /* ==================== NAVEGAÇÃO INTERNA (SPA) ==================== */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || link.dataset.noscroll !== undefined) return;
    e.preventDefault();
    const id = link.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (target) {
      target.scrollIntoView({ block: 'start' });
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    } else {
      window.scrollTo({ top: 0 });
    }
  });

  /* ---------- estado inicial ---------- */
  setQty(1);

  // Se o navegador já bateu o limite de 3 cartões numa visita anterior,
  // já abre o checkout sem a opção de cartão.
  if (_getCardFps().length >= CARD_LIMIT) disableCardOption();

  /* ============================ VARIANTES (Cor / Voltagem / Potência) ============================ */
  function rebuildThumbs() {
    thumbsEl.innerHTML = activeGallery.map((g, i) => `
      <button class="thumb${i === 0 ? ' is-active' : ''}" type="button" data-i="${i}"
              aria-current="${i === 0}" aria-label="Ver imagem ${i + 1} de ${activeGallery.length}">
        <img src="${g.thumb}" width="112" height="112" decoding="async" alt="">
        ${g.type === 'video' ? `<span class="thumb__play">${icon('i-play')}</span>` : ''}
      </button>`).join('');
    $$('.thumb', thumbsEl).forEach(btn => {
      const go = () => setGallery(Number(btn.dataset.i));
      btn.addEventListener('mouseenter', go);
      btn.addEventListener('click', go);
      btn.addEventListener('focus', go);
    });
    setGallery(0);
  }

  [
    {
      optsId: 'varCorOpts', labelId: 'varCorLabel',
      onSelect: label => {
        activeGallery = COLOR_GALLERIES[label] || GALLERY;
        rebuildThumbs();
      }
    },
    { optsId: 'varVoltOpts', labelId: 'varVoltLabel' },
    { optsId: 'varPotOpts',  labelId: 'varPotLabel'  },
    { optsId: 'varTamOpts',  labelId: 'varTamLabel'  }
  ].forEach(({ optsId, labelId, onSelect }) => {
    const opts    = $('#' + optsId);
    const labelEl = $('#' + labelId);
    if (!opts || !labelEl) return;
    opts.addEventListener('click', e => {
      const btn = e.target.closest('.var-btn');
      if (!btn) return;
      $$('.var-btn', opts).forEach(b => { b.classList.remove('is-sel'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('is-sel');
      btn.setAttribute('aria-pressed', 'true');
      labelEl.textContent = btn.dataset.label;
      if (onSelect) onSelect(btn.dataset.label);
    });
  });
})();
