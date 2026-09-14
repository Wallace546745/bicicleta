# -*- coding: utf-8 -*-
"""Confere a implementacao contra cada item da documentacao da Nerva."""
import io, re, sys

S = io.open('nerva/server.js', encoding='utf-8').read()
E = io.open('nerva/.env.example', encoding='utf-8').read()
falhas, avisos = [], []

def ok(c, m, critico=True):
    print(('  ok    ' if c else ('  FALHA ' if critico else '  aviso ')) + m)
    if not c:
        (falhas if critico else avisos).append(m)

print('\n' + '=' * 60)
print('CONFORMIDADE COM A DOC DA NERVA')
print('=' * 60)

print('\n1. AUTENTICAÇÃO')
ok("'x-api-key': NERVA_KEY" in S, "header x-api-key em toda requisição")
ok("process.env.NERVA_API_KEY" in S, "chave lida de variável de ambiente")
ok("if (!NERVA_KEY)" in S, "servidor recusa subir sem a chave")
ok('NERVA_API_KEY' in E, "documentada no .env.example")
front = io.open('index.html', encoding='utf-8').read() + io.open('app.js', encoding='utf-8').read()
ok('sk_live_' not in front, "a chave NÃO aparece no front")

print('\n2. BASE URL')
ok("'https://pixnerva.com.br/api'" in S, "https://pixnerva.com.br/api")

print('\n3. CRIAR COBRANÇA — POST /sales')
ok("nerva('/sales'" in S, "chama POST /sales")
for campo, obrig in [('amount', True), ('customer', True), ('document', True),
                     ('description', False), ('items', False),
                     ('expirationInSeconds', False), ('postbackUrl', False),
                     ('externalId', False)]:
    achou = re.search(r'\b%s\s*[:=]' % campo, S) is not None or ('.' + campo) in S
    ok(achou, ('obrigatório: ' if obrig else 'opcional: ') + campo, obrig)
ok('expirationInSeconds: 86400' in S, "expiração dentro de 300–86400")
ok("document.length !== 11 && document.length !== 14" in S, "valida CPF/CNPJ antes de enviar")
ok('amount < 1' in S, "valida o valor mínimo")
ok('amount > 10000' in S, "teto de R$ 10.000 validado antes de chamar a API")

print('\n4. IDEMPOTÊNCIA')
ok("headers['idempotency-key']" in S, "header idempotency-key")
ok('IDEM_WINDOW_MS' in S, "janela de reaproveitamento da cobrança")
ok('orderFingerprint' in S, "chave por pedido (CPF + valor + produto)")

print('\n5. TRACKING DE MARKETING')
for c in ['utmSource', 'utmMedium', 'utmCampaign', 'utmContent', 'utmTerm',
          'fbclid', 'ttclid', 'fbp', 'fbc', 'clientUserAgent', 'clientIpAddress', 'eventId']:
    ok(c in S, 'campo ' + c, False)

print('\n6. CONSULTAR COBRANÇA — GET /sales/:id')
ok("nerva(`/sales/${encodeURIComponent" in S, "GET /sales/:id com o id escapado")
for st in ['paid', 'pending', 'expired', 'failed', 'refunded']:
    ok("'%s'" % st in S, 'status ' + st, st in ('paid', 'expired', 'failed', 'refunded'))

print('\n7. SALDO E SAQUES')
ok("'/withdrawals/balance'" in S, "GET /withdrawals/balance")
ok("'/withdrawals'" in S, "POST /withdrawals")
ok("/withdrawals/my-withdrawals" in S, "GET /withdrawals/my-withdrawals")
ok('centavosParaReais' in S, "converte centavos para reais")
ok("['cpf', 'cnpj', 'email', 'phone', 'random']" in S, "valida pixKeyType")
ok('toLowerCase()' in S, "normaliza pixKeyType para minúsculo")
ok('amount >= 1' in S, "valida o mínimo de R$ 1,00 no saque")

print('\n8. WEBHOOK')
ok("app.post('/webhooks/nerva'" in S, "rota do webhook")
ok("x-pixnerva-timestamp" in S, "lê o header de timestamp")
ok("x-pixnerva-signature" in S, "lê o header de assinatura")
ok("createHmac('sha256', WEBHOOK_SECRET)" in S, "HMAC-SHA256 com o secret")
ok("`${timestamp}.${req.rawBody}`" in S, "assina timestamp + corpo BRUTO")
ok('> 300' in S, "rejeita timestamp com mais de 5 min (replay)")
ok('timingSafeEqual' in S, "comparação resistente a timing attack")
ok("res.status(401)" in S, "responde 401 quando a assinatura não confere")
ok("res.status(200).json({ received: true })" in S, "responde 2xx (evita retentativa)")

print('\n9. EVENTOS TRATADOS')
for ev, critico in [('sale.paid', True), ('sale.expired', True), ('sale.failed', True),
                    ('sale.refunded', True), ('sale.med_created', False),
                    ('sale.med_accepted', True), ('sale.med_rejected', False),
                    ('sale.med_cancelled', False), ('sale.status_changed', False),
                    ('withdrawal.completed', False), ('withdrawal.failed', False),
                    ('withdrawal.rejected', False)]:
    ok("'%s'" % ev in S, ev, critico)

print('\n10. POSTBACK URL')
ok("payload.postbackUrl = `${PUBLIC_URL}/webhooks/nerva`" in S, "postbackUrl por transação")
ok('PUBLIC_URL' in E, "PUBLIC_URL documentada")

print('\n11. ERROS')
ok('err.status = r.status' in S, "propaga o status HTTP da Nerva")
ok('data.message' in S, "usa a mensagem de erro da API")

print('\n' + '=' * 60)
print('falhas críticas:', len(falhas), '| avisos:', len(avisos))
for f in falhas: print('  FALHA', f)
for a in avisos: print('  aviso', a)
sys.exit(1 if falhas else 0)
