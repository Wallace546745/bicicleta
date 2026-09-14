"""Percorre o checkout inteiro num navegador real e audita:
   - todo evento do pixel TikTok, na ordem
   - os event_id, para conferir a deduplicacao com a Events API
   - o que o servidor recebeu
"""
import re, json, http.server, socketserver, threading, functools, sys, os
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.abspath(__file__))

def launch(p):
    try: return p.chromium.launch()
    except Exception:
        return p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
TXID = 'venda-uuid-teste'
EVENTID_SERVIDOR = 'ev-servidor-abc123'
recebido = []

class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def _j(self, o, c=200):
        b = json.dumps(o).encode()
        self.send_response(c); self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b))); self.end_headers()
        try: self.wfile.write(b)
        except Exception: pass
    def do_GET(self):
        p = self.path.split('?')[0]
        if p.startswith('/api/pix/status/'):
            recebido.append(('GET', p, {}))
            return self._j({'status': 'PAID', 'amount': 76.91, 'paidAt': '2026-03-23T10:05:00Z',
                            'purchaseEventId': EVENTID_SERVIDOR})
        if p.startswith('/api/'): return self._j({'ok': True})
        return super().do_GET()
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        corpo = self.rfile.read(n)
        try: j = json.loads(corpo or b'{}')
        except Exception: j = {}
        p = self.path.split('?')[0]
        recebido.append(('POST', p, j))
        if p == '/api/pix/create':
            return self._j({'ok': True, 'txid': TXID,
                            'qrCode': '00020101021226580014br.gov.bcb.pix...',
                            'base64QrCode': 'https://exemplo/qr.png',
                            'purchaseEventId': EVENTID_SERVIDOR,
                            'externalId': 'v9max-abc', 'transactionId': 'gw_tx_1', 'status': 'pending'})
        return self._j({'ok': True})

socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(('127.0.0.1', 9700), functools.partial(H, directory=ROOT))
threading.Thread(target=srv.serve_forever, daemon=True).start()
B = 'http://127.0.0.1:9700'

PNG = bytes.fromhex('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489'
                    '0000000d49444154789c63f8cfc0f01f0005fe02fea3a4eb1d0000000049454e44ae426082')
falhas = []
def ok(c, m):
    print(('  ok    ' if c else '  FALHA ') + m)
    if not c: falhas.append(m)

def fila(pg):
    return pg.evaluate("""()=>{const q=window.ttq; if(!q||!q.length) return [];
      return [].slice.call(q).filter(x=>x[0]==='track').map(x=>({
        ev:x[1], props:x[2]||{}, opts:x[3]||{}}));}""")

with sync_playwright() as p:
    b = launch(p)
    ctx = b.new_context(viewport={'width': 1440, 'height': 1000})
    ctx.route(re.compile(r'^https?://(?!127\.0\.0\.1)'), lambda r: (
        r.fulfill(status=200, content_type='image/png', body=PNG)
        if r.request.resource_type == 'image' else r.abort()))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: falhas.append('JS: %s' % str(e)[:90]))

    print('\n' + '=' * 58)
    print('FUNIL COMPLETO — do anúncio ao pagamento')
    print('=' * 58)

    # entra como tráfego do TikTok
    pg.goto(B + '/index.html?ttclid=TTCLID_TESTE&utm_source=tiktok&utm_campaign=lavadora-frio-01',
            wait_until='load'); pg.wait_for_timeout(2500)
    print('\n1) CHEGADA (?ttclid=...)')
    ns = [e['ev'] for e in fila(pg)]
    ok('ViewContent' in ns, 'ViewContent: ' + ', '.join(ns))
    # o mesmo evento chega ao servidor (Events API) com o mesmo event_id e o ttclid
    vc_px = next((e for e in fila(pg) if e['ev'] == 'ViewContent'), None)
    vc_sv = [r[2] for r in recebido if r[1] == '/api/track' and r[2].get('event') == 'ViewContent']
    ok(len(vc_sv) == 1, 'servidor recebeu ViewContent %dx' % len(vc_sv))
    if vc_sv and vc_px:
        ok(vc_sv[0].get('event_id') == vc_px['opts'].get('event_id'), 'event_id igual no pixel e no servidor')
        ok(vc_sv[0].get('ttclid') == 'TTCLID_TESTE', 'ttclid repassado ao servidor')
        ok(isinstance(vc_sv[0].get('event_time'), (int, float)), 'event_time (instante real do evento) enviado')
        ok(bool(vc_sv[0].get('external_id')), 'external_id enviado')
    # Search/ClickButton nao sao eventos de produto: sem value/contents em NENHUM dos lados
    pg.evaluate("()=>window.ttkTrack('Search', { query: 'lavadora' })"); pg.wait_for_timeout(600)
    s_sv = [r[2] for r in recebido if r[1] == '/api/track' and r[2].get('event') == 'Search']
    ok(bool(s_sv) and 'value' not in s_sv[0] and 'contents' not in s_sv[0] and s_sv[0].get('query') == 'lavadora',
       'Search ao servidor: so query, sem value/contents (igual ao pixel)')

    print('\n2) COMPRAR AGORA')
    pg.click('#buyNow'); pg.wait_for_timeout(1200)
    ok('ClickButton' not in [e['ev'] for e in fila(pg)], 'sem ClickButton (descontinuado)')

    print('\n3) ORDER BUMP → CHECKOUT')
    pg.eval_on_selector_all('.ob-item', "ls=>ls[0].click()"); pg.wait_for_timeout(400)
    pg.click('#obConfirm'); pg.wait_for_timeout(1600)
    ok('InitiateCheckout' in [e['ev'] for e in fila(pg)], 'InitiateCheckout')
    ic = next((e for e in fila(pg) if e['ev'] == 'InitiateCheckout'), None)
    if ic:
        ct = ic['props'].get('contents') or [{}]
        ok(ct[0].get('content_id') == 'VONDER-LAV1300' and ct[0].get('price') == 67.88,
           'InitiateCheckout: contents com SKU e preco UNITARIO (%s / R$ %s), value = total (R$ %s)'
           % (ct[0].get('content_id'), ct[0].get('price'), ic['props'].get('value')))

    print('\n4) ENDEREÇO E DADOS (o checkout tem etapas)')
    VALORES = {'fCep': '01310100', 'fNum': '1000', 'fCompl': 'Apto 12',
               'fNome': 'João da Silva Teste', 'fEmail': 'joao@teste.com',
               'fFone': '11988887777', 'fCpf': '12345678909',
               'fRua': 'Avenida Paulista', 'fBairro': 'Bela Vista',
               'fCidade': 'São Paulo', 'fUf': 'SP'}
    AVANCA = ['Continuar', 'Finalizar', 'Gerar', 'Pagar', 'Pix', 'Ir para o pagamento']

    for volta in range(6):
        pg.wait_for_timeout(900)
        # preenche o que estiver visível e vazio
        preenchidos = pg.evaluate("""(vals)=>{const out=[];
          document.querySelectorAll('input').forEach(i=>{
            if(!i.offsetParent) return;
            const v = vals[i.id]; if(!v) return;
            if(i.value && i.value.trim()) return;
            i.focus();
            const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
            set.call(i, v);
            i.dispatchEvent(new Event('input',{bubbles:true}));
            i.dispatchEvent(new Event('change',{bubbles:true}));
            i.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true}));
            out.push(i.id);});
          return out;}""", VALORES)
        if preenchidos: print('   preenchi: ' + ', '.join(preenchidos))
        pg.wait_for_timeout(1100)
        # pula o seguro, se aparecer
        sk = pg.query_selector('#segSkip')
        if sk and sk.is_visible():
            sk.click(); pg.wait_for_timeout(900); continue
        # clica no botão de avanço visível
        clicou = pg.evaluate("""(rot)=>{
          const bs=[...document.querySelectorAll('button')].filter(b=>b.offsetParent && !b.disabled);
          const b=bs.find(x=>rot.some(r=>x.textContent.trim().toLowerCase().startsWith(r.toLowerCase()))
                              && !/comprar agora|adicionar/i.test(x.textContent));
          if(b){ b.click(); return (b.id||'')+':'+b.textContent.trim().slice(0,24);} return null;}""", AVANCA)
        if clicou: print('   cliquei: ' + clicou)
        pg.wait_for_timeout(1600)
        if [r for r in recebido if r[1] == '/api/pix/create']:
            print('   → Pix solicitado ao servidor')
            break

    ev = fila(pg)
    ns = sorted(set(e['ev'] for e in ev))
    ok('AddPaymentInfo' in ns, 'AddPaymentInfo na etapa de pagamento')
    print('   eventos até aqui: ' + ', '.join(ns))

    print('\n5) PIX GERADO')
    pg.wait_for_timeout(2000)
    ev = fila(pg)
    pao = next((e for e in ev if e['ev'] == 'PlaceAnOrder'), None)
    ok(pao is not None, 'PlaceAnOrder disparou')
    if pao:
        ok(pao['opts'].get('event_id') == 'pao-' + TXID,
           'event_id = pao-<txid>  →  ' + str(pao['opts'].get('event_id')))
        ok(pao['props'].get('order_id') == TXID, 'order_id = txid')
        ok(pao['props'].get('value') is not None, 'value: R$ ' + str(pao['props'].get('value')))
    criou = [r for r in recebido if r[1] == '/api/pix/create']
    ok(len(criou) == 1, 'servidor recebeu %d pedido(s) de Pix' % len(criou))
    if criou:
        c = criou[0][2]
        ok(bool(c.get('payerCpf')), 'CPF enviado ao servidor')
        ok(bool(c.get('payerEmail')), 'e-mail enviado')
        ok(bool(c.get('tiktokClickId')) or bool((c.get('utms') or {}).get('utmSource')),
           'rastreamento repassado: utm=%s ttclid=%s' % ((c.get('utms') or {}).get('utmSource'),
                                                          str(c.get('tiktokClickId'))[:16]))
        tc = c.get('ttkContents') or []
        ok(bool(tc) and bool(tc[0].get('content_id')),
           'itens por SKU (ttkContents) enviados para o servidor: ' + ', '.join(str(i.get('content_id')) for i in tc))
        ok(bool(c.get('ttkExternalId')), 'external_id do TikTok enviado')
    pao_sv = [r[2] for r in recebido if r[1] == '/api/track' and r[2].get('event') == 'PlaceAnOrder']
    ok(len(pao_sv) == 1, 'servidor recebeu PlaceAnOrder %dx' % len(pao_sv))
    if pao_sv:
        ok(str(pao_sv[0].get('phone', '')).startswith('+55'), 'telefone ao servidor em E.164: ' + str(pao_sv[0].get('phone')))
        ok(pao_sv[0].get('email') == 'joao@teste.com', 'e-mail ao servidor: ' + str(pao_sv[0].get('email')))

    print('\n6) PAGAMENTO CONFIRMADO (polling)')
    pg.wait_for_timeout(5000)
    ev = fila(pg)
    cp = next((e for e in ev if e['ev'] == 'Purchase'), None)
    ok(cp is not None, 'Purchase disparou (nome novo do CompletePayment)')
    ok('Lead' in [e['ev'] for e in ev] and 'SubmitForm' not in [e['ev'] for e in ev], 'Lead no lugar de SubmitForm')
    if cp:
        ok(cp['opts'].get('event_id') == EVENTID_SERVIDOR,
           'event_id = o do servidor  →  ' + str(cp['opts'].get('event_id')))
        ok(cp['props'].get('order_id') == TXID, 'order_id = txid')
        ok(cp['props'].get('value') is not None, 'value: R$ ' + str(cp['props'].get('value')))
        cont = cp['props'].get('contents') or [{}]
        ok(bool(cont[0].get('content_id')), 'content_id: ' + str(cont[0].get('content_id')))
        ok(cont[0].get('price') == 67.88,
           'price UNITARIO do produto (R$ %s), nao o total do pedido — itens lidos antes de limpar o carrinho' % cont[0].get('price'))

    print('\n7) DEDUPLICAÇÃO E DUPLICIDADE')
    todos = fila(pg)
    from collections import Counter
    cont = Counter(e['ev'] for e in todos)
    for nome in ['ViewContent', 'InitiateCheckout', 'PlaceAnOrder', 'Purchase']:
        ok(cont.get(nome, 0) <= 1 or nome == 'InitiateCheckout',
           '%s disparou %dx' % (nome, cont.get(nome, 0)))
    ids = [e['opts'].get('event_id') for e in todos if e['opts'].get('event_id')]
    ok(len(ids) == len(set(ids)), 'todos os event_id são únicos (%d eventos)' % len(ids))

    print('\n8) SEQUÊNCIA COMPLETA')
    for e in todos:
        v = e['props'].get('value')
        print('   %-18s %s' % (e['ev'], ('R$ ' + str(v)) if v is not None else ''))
    b.close()
srv.shutdown()

print('\n' + '=' * 58)
print('falhas:', len(falhas))
for f in falhas: print('  -', f)
sys.exit(1 if falhas else 0)
