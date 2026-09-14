import re, json, http.server, socketserver, threading, functools, sys, os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))

def launch(p):
    """Chromium do Playwright; se o download padrão não existir, tenta o caminho
       em CHROMIUM_PATH (ex.: /usr/bin/chromium)."""
    try: return p.chromium.launch()
    except Exception:
        return p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 9500), functools.partial(Q, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
B = 'http://127.0.0.1:9500'

PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
                    '0000000d49444154789c63f8cfc0f01f0005fe02fea3a4eb1d0000000049454e44ae426082')
falhas = []
def ok(c, m):
    print(('  ok    ' if c else '  FALHA ') + m)
    if not c: falhas.append(m)

# O snippet real do TikTok enfileira as chamadas em window.ttq ate o
# script externo carregar. Como bloqueamos o externo, a fila fica intacta
# e podemos ler exatamente o que seria enviado.
STUB = ""

def _fila(pg):
    return pg.evaluate("""()=>{
      const q = window.ttq;
      if (!q || !q.length) return [];
      return [].slice.call(q).map(x => ({ m: x[0], a: [].slice.call(x).slice(1) }));
    }""")

def abrir(ctx, url):
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: falhas.append('JS: %s' % e))
    pg.goto(url, wait_until='load'); pg.wait_for_timeout(2200)
    return pg

def eventos(pg):
    out = []
    for c in _fila(pg):
        if c['m'] == 'track':
            a = c['a']
            out.append({'ev': a[0], 'props': a[1] if len(a) > 1 else {}, 'opts': a[2] if len(a) > 2 else {}})
        elif c['m'] == 'page':
            out.append({'ev': 'Pageview', 'props': {}, 'opts': {}})
    return out

nomes = lambda pg: [e['ev'] for e in eventos(pg)]
def limpar(pg): pg.evaluate("()=>{ window.ttq.length = 0; }")

with sync_playwright() as p:
    b = launch(p)
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000})
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda r: (
        r.fulfill(status=200, content_type='image/png', body=PNG)
        if r.request.resource_type == 'image' else r.abort()))

    # ---------- 0. o pixel está no <head> e sai antes do app.js ----------
    print('\n0) PIXEL NO <head> — Pageview e ViewContent sem esperar o app.js')
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    head = html.split('</head>')[0]
    ok('TikTok Pixel Code Start' in head, 'base do pixel TikTok dentro do <head>')
    ok('window.TTK_CONFIG' in head, 'ponte TTK_CONFIG dentro do <head>')
    ok('rel="preconnect" href="https://analytics.tiktok.com"' in head, 'preconnect com analytics.tiktok.com')
    ctx0 = b.new_context(viewport={'width': 1440, 'height': 1000})
    ctx0.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda r: r.abort())
    ctx0.route(re.compile(r'/app\.js'), lambda r: r.abort())     # SEM o app.js
    pg0 = ctx0.new_page(); pg0.goto(B + '/index.html', wait_until='load'); pg0.wait_for_timeout(800)
    fila0 = _fila(pg0)
    ms = [c['m'] for c in fila0]
    ok('page' in ms and 'identify' in ms and ms.index('identify') < ms.index('page'),
       'ordem: identify antes do page (Pageview já sai com external_id): ' + ', '.join(ms[:4]))
    ident = next((c for c in fila0 if c['m'] == 'identify'), None)
    ok(ident and bool((ident['a'][0] or {}).get('external_id')), 'identify carrega external_id')
    ev0 = eventos(pg0)
    vc0 = [e for e in ev0 if e['ev'] == 'ViewContent']
    ok(len(vc0) == 1, 'ViewContent disparou %d vez sem o app.js (vem do <head>)' % len(vc0))
    ok(vc0 and vc0[0]['props']['contents'][0]['content_id'] == 'VONDER-LAV1300' and vc0[0]['props']['value'] == 67.88,
       'ViewContent do <head> com SKU e preço certos')
    ok(pg0.evaluate("()=>!!(window.__ttkViewContent && window.__ttkViewContent.event_id)"),
       'window.__ttkViewContent guarda o event_id (o app.js não repete)')
    # telefone em E.164: sem o +55 o hash do pixel nunca casa
    pg0.evaluate("()=>window.ttkIdentify({ email: ' Joao@Teste.com ', phone: '(11) 98888-7777' })")
    ult = [c for c in _fila(pg0) if c['m'] == 'identify'][-1]['a'][0]
    ok(ult.get('phone_number') == '+5511988887777', 'ttkIdentify: telefone em E.164 -> ' + str(ult.get('phone_number')))
    ok(ult.get('email') == 'joao@teste.com', 'ttkIdentify: e-mail minúsculo e sem espaços')
    pg0.close(); ctx0.close()

    # ---------- 1. tráfego direto (sem ttclid) ----------
    print('\n1) TRÁFEGO DIRETO — o pixel deve disparar mesmo assim')
    pg = abrir(ctx, B + '/index.html')
    ns = nomes(pg)
    ok('ViewContent' in ns, 'ViewContent disparou: ' + ', '.join(ns))
    ok(ns.count('ViewContent') == 1, 'ViewContent só 1x com o app.js carregado (não repete o do <head>)')
    vc = next((e for e in eventos(pg) if e['ev'] == 'ViewContent'), None)
    ok(vc and vc['props'].get('currency') == 'BRL', 'moeda BRL')
    ok(vc and vc['props']['contents'][0]['content_id'] == 'VONDER-LAV1300',
       'content_id: ' + (vc['props']['contents'][0]['content_id'] if vc else '—'))
    ok(vc and vc['props']['value'] == 67.88, 'value: ' + str(vc['props']['value'] if vc else '—'))
    ok(vc and bool(vc['opts'].get('event_id')), 'event_id presente (dedup com a Events API)')
    ok(vc and vc['props'].get('content_ids') == ['VONDER-LAV1300'] and vc['props'].get('quantity') == 1 and bool(vc['props'].get('description')),
       'parametros recomendados: content_ids, quantity e description')
    c0 = vc['props']['contents'][0] if vc else {}
    ok(c0.get('brand') == 'Vonder' and c0.get('content_category') == 'Lavadoras de Alta Pressão',
       'contents com brand e content_category (catálogo): %s / %s' % (c0.get('brand'), c0.get('content_category')))

    # ---------- 2. funil completo ----------
    print('\n2) FUNIL — cada etapa marca seu evento')
    limpar(pg)
    pg.click('#favBtn'); pg.wait_for_timeout(400)
    ok('AddToWishlist' in nomes(pg), 'favoritar -> AddToWishlist')

    limpar(pg)
    pg.fill('#q', 'lavadora vonder'); pg.press('#q', 'Enter'); pg.wait_for_timeout(500)
    ev = eventos(pg); s = next((e for e in ev if e['ev'] == 'Search'), None)
    ok(s is not None, 'buscar -> Search')
    ok(s and s['props'].get('search_string') == 'lavadora vonder' and s['props'].get('query') == 'lavadora vonder', 'search_string (nome atual) + query: ' + str(s['props'].get('search_string') if s else '—'))
    ok(s and s['props'].get('customer_type') == 'new' and 'value' not in s['props'], 'customer_type presente; Search sem value')

    limpar(pg)
    pg.click('#addCart'); pg.wait_for_timeout(700)
    ns = nomes(pg)
    ok('ClickButton' not in ns, 'sem ClickButton (descontinuado pelo TikTok)')
    ok('AddToCart' in ns, 'adicionar ao carrinho -> AddToCart')

    limpar(pg)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)   # fecha o mini-carrinho que abriu
    pg.click('#buyNow'); pg.wait_for_timeout(1200)
    limpar(pg)
    pg.click('#obConfirm'); pg.wait_for_timeout(1400)
    ns = nomes(pg)
    ok('InitiateCheckout' in ns, 'seguir do order bump -> InitiateCheckout: ' + ', '.join(ns))
    pg.close()

    # ---------- 3. página de produto reporta o produto certo ----------
    print('\n3) PÁGINA DE PRODUTO — o pixel tem de reportar AQUELE produto')
    for rota, sku, preco in [('/p/capacete-norisk-razor/', 'NORISK-RAZOR-56', 59.3),
                             ('/p/snow-foam-500ml/',      'SNOWFOAM-500',    19.9),
                             ('/p/serra-marmore-makita/', 'MAKITA-4100NH3Z', 23.1)]:
        pg = abrir(ctx, B + rota)
        vc = next((e for e in eventos(pg) if e['ev'] == 'ViewContent'), None)
        cid = vc['props']['contents'][0]['content_id'] if vc else '—'
        val = vc['props']['value'] if vc else '—'
        ok(cid == sku and val == preco, '%-28s content_id=%s value=%s' % (rota, cid, val))
        pg.close()

    # ---------- 4. recorte por canal ----------
    print('\n4) RECORTE POR CANAL (TTK_CONFIG.somenteCanal)')
    pg = ctx.new_page()
    pg.add_init_script("""
      Object.defineProperty(window, 'TTK_CONFIG', {
        configurable: true,
        set: function(v){ v.somenteCanal = true; this.__c = v; },
        get: function(){ return this.__c; }
      });
    """)
    pg.goto(B + '/index.html', wait_until='load'); pg.wait_for_timeout(2200)
    ok('ViewContent' in nomes(pg),
       'somenteCanal=true + sem sinal -> dispara (o canal padrão é tiktok, por desenho)')
    pg.close()

    pg = ctx.new_page()
    pg.add_init_script("""
      Object.defineProperty(window, 'TTK_CONFIG', {
        configurable: true,
        set: function(v){ v.somenteCanal = true; this.__c = v; },
        get: function(){ return this.__c; }
      });
    """)
    pg.goto(B + '/index.html?utm_source=facebook', wait_until='load'); pg.wait_for_timeout(2200)
    ok('ViewContent' not in nomes(pg), 'somenteCanal=true + utm_source=facebook -> não dispara')
    pg.close()
    b.close()
srv.shutdown()

print('\n' + '=' * 54)
print('falhas:', len(falhas))
for f in falhas: print('  -', f)
sys.exit(1 if falhas else 0)
