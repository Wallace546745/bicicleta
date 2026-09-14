/* =========================================================
   Modo edição da loja — só roda com ?editor=1 dentro do iframe
   do /admin/editor. Marca cada parte editável, mostra um lápis
   ao passar o mouse e avisa o editor qual campo foi clicado.
   ========================================================= */
(function () {
  'use strict';
  if (!new URLSearchParams(location.search).has('editor')) return;
  if (window.parent === window) return;

  /* o que é editável e como cada coisa se chama no offer.json */
  var ALVOS = [
    { sel: '[data-of]',                     kind: 'texto',    path: function (el) { return el.dataset.of; } },
    { sel: '.price',                        kind: 'preco',    path: function () { return 'preco'; },              label: 'Preço' },
    { sel: '.buy-opt',                      kind: 'preco',    path: function () { return 'preco'; },              label: 'Preço' },
    { sel: '.gallery',                      kind: 'fotos',    path: function () { return 'fotos'; },              label: 'Fotos do produto' },
    { sel: '#photos',                       kind: 'fotos',    path: function () { return 'fotos'; },              label: 'Fotos do produto' },
    { sel: '.var-selectors',                kind: 'variante', path: function () { return 'variante'; },           label: 'Variantes' },
    { sel: '.specs-hi',                     kind: 'lista',    path: function () { return 'bullets'; },            label: 'O que você precisa saber' },
    { sel: '#descricao',                    kind: 'longo',    path: function () { return 'descricao'; },          label: 'Descrição' },
    { sel: '#caracteristicas',              kind: 'specs',    path: function () { return 'specs'; },              label: 'Características' },
    { sel: '.crumbs',                       kind: 'lista',    path: function () { return 'produto.categoria'; },  label: 'Categorias' },
    { sel: '.interest',                     kind: 'lista',    path: function () { return 'seo.buscas'; },         label: 'Buscas relacionadas' },
    { sel: '#relTrack .pcard',              kind: 'relacionado', path: idx('#relTrack .pcard', 'relacionados'), label: 'Produto relacionado' },
    { sel: '#rlist .review',                kind: 'avaliacao',   path: idx('#rlist .review', 'avaliacoes.lista'), label: 'Avaliação' },
    { sel: '.rsum',                         kind: 'texto',    path: function () { return 'produto.nota'; },       label: 'Nota' },
    { sel: '.seller-card',                  kind: 'texto',    path: function () { return 'produto.vendedor'; },   label: 'Vendedor' },
    { sel: '#loja',                         kind: 'texto',    path: function () { return 'produto.vendedor'; },   label: 'Loja' },
    { sel: '.ob-item',                      kind: 'orderbump',   path: idx('.ob-item', 'orderBump.itens'),        label: 'Item da oferta' },
    { sel: '.ob-head',                      kind: 'orderbump-cab', path: function () { return 'orderBump'; },     label: 'Oferta antes de finalizar' },
    { sel: '.bo-box',                       kind: 'saida',    path: function () { return 'ofertaSaida'; },        label: 'Oferta de saída' }
  ];

  function idx(sel, base) {
    return function (el) {
      var all = Array.prototype.slice.call(document.querySelectorAll(sel));
      return base + '.' + all.indexOf(el);
    };
  }

  /* ---- estilo do modo edição ---- */
  var css = document.createElement('style');
  css.textContent = [
    '.ed-hl{position:absolute;pointer-events:none;border:2px solid #d4a012;border-radius:6px;box-shadow:0 0 0 4px rgba(212,160,18,.18);z-index:99998;transition:all .08s}',
    '.ed-btn{position:absolute;z-index:99999;display:flex;align-items:center;gap:6px;background:#d4a012;color:#1a1405;font:600 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:7px 10px;border-radius:20px;border:0;cursor:pointer;box-shadow:0 3px 12px rgba(0,0,0,.35);white-space:nowrap}',
    '.ed-btn svg{width:13px;height:13px}',
    '.ed-btn:hover{background:#e6b027}',
    'body.ed-on a[href^="#"]{cursor:default}',
    '.ed-bar{position:fixed;left:0;right:0;top:0;z-index:99997;background:rgba(212,160,18,.95);color:#1a1405;font:600 12px/1 -apple-system,sans-serif;padding:7px 14px;text-align:center}'
  ].join('');
  document.head.appendChild(css);
  document.body.classList.add('ed-on');

  var bar = document.createElement('div');
  bar.className = 'ed-bar';
  bar.textContent = 'Modo edição: passe o mouse sobre qualquer parte e clique no lápis';
  document.body.appendChild(bar);

  var hl = document.createElement('div'); hl.className = 'ed-hl'; hl.hidden = true;
  var btn = document.createElement('button'); btn.className = 'ed-btn'; btn.type = 'button'; btn.hidden = true;
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span></span>';
  document.body.appendChild(hl); document.body.appendChild(btn);

  var atual = null;

  function achar(el) {
    for (; el && el !== document.body; el = el.parentElement) {
      for (var i = 0; i < ALVOS.length; i++) {
        if (el.matches && el.matches(ALVOS[i].sel)) return { el: el, alvo: ALVOS[i] };
      }
    }
    return null;
  }

  function rotulo(hit) {
    if (hit.alvo.label) return hit.alvo.label;
    var p = hit.alvo.path(hit.el);
    var nomes = {
      'produto.titulo': 'Título', 'produto.condicao': 'Condição', 'produto.vendidos': 'Vendidos',
      'produto.badge': 'Selo', 'produto.badgeLink': 'Ranking', 'produto.nota': 'Nota',
      'produto.avaliacoes': 'Nº de avaliações', 'produto.vendedor': 'Vendedor', 'preco.cupom': 'Cupom',
      'variante.rotulo': 'Nome da variante', 'avaliacoes.resumoIA': 'Resumo das avaliações',
      'avaliacoes.comentarios': 'Nº de comentários'
    };
    return nomes[p] || p;
  }

  function mostrar(hit) {
    atual = hit;
    var r = hit.el.getBoundingClientRect();
    var sx = window.scrollX, sy = window.scrollY;
    hl.hidden = false;
    hl.style.left = (r.left + sx - 3) + 'px'; hl.style.top = (r.top + sy - 3) + 'px';
    hl.style.width = (r.width + 6) + 'px'; hl.style.height = (r.height + 6) + 'px';
    btn.hidden = false;
    btn.querySelector('span').textContent = rotulo(hit);
    var bx = Math.min(r.right + sx - 8, window.innerWidth + sx - 160);
    btn.style.left = Math.max(sx + 8, bx - btn.offsetWidth) + 'px';
    btn.style.top = Math.max(sy + 40, r.top + sy - 34) + 'px';
  }
  function esconder() { atual = null; hl.hidden = true; btn.hidden = true; }

  document.addEventListener('mousemove', function (e) {
    if (e.target === btn || btn.contains(e.target)) return;
    var hit = achar(e.target);
    if (!hit) return;
    if (!atual || atual.el !== hit.el) mostrar(hit);
  });
  document.addEventListener('mouseleave', esconder);

  btn.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    if (!atual) return;
    window.parent.postMessage({
      type: 'editar',
      kind: atual.alvo.kind,
      path: atual.alvo.path(atual.el),
      label: rotulo(atual)
    }, '*');
  });

  /* clicar em qualquer alvo também abre o editor (sem precisar acertar o lápis) */
  document.addEventListener('click', function (e) {
    if (e.target === btn || btn.contains(e.target)) return;
    var hit = achar(e.target);
    if (!hit) return;
    // deixa funcionar botões que abrem telas (comprar, carrinho) para editar o que está dentro
    if (e.target.closest('#buyNow, #cartBtn, #addCart, .pcard__buy, .pcard__cart, #obConfirm, #obSkip, #segSkip, #segAdd, .var-btn, #qtyBtn, .thumb, .stage__nav')) return;
    e.preventDefault(); e.stopPropagation();
    window.parent.postMessage({ type: 'editar', kind: hit.alvo.kind, path: hit.alvo.path(hit.el), label: rotulo(hit) }, '*');
  }, true);

  /* o editor pede para abrir telas escondidas */
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'abrir') {
      if (d.o === 'orderbump') { var b = document.getElementById('buyNow'); if (b) b.click(); }
      if (d.o === 'saida') { var m = document.getElementById('backOfferModal'); if (m) m.classList.add('is-open'); }
      if (d.o === 'topo') window.scrollTo({ top: 0, behavior: 'smooth' });
      if (d.o === 'avaliacoes') { var op = document.getElementById('opinioes'); if (op) op.scrollIntoView({ behavior: 'smooth' }); }
      if (d.o === 'relacionados') { var rl = document.getElementById('relacionados'); if (rl) rl.scrollIntoView({ behavior: 'smooth' }); }
    }
  });

  window.parent.postMessage({ type: 'pronto' }, '*');
})();
