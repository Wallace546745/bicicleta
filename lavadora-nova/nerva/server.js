/* =========================================================
   Nerva — gateway ÚNICO da oferta Lavadora Vonder LAV 1300
   Adaptador que mantém o contrato que o front já usa:
     POST /api/pix/create        -> Nerva POST /sales
     GET  /api/pix/status/:id    -> Nerva GET  /sales/:id
     POST /webhooks/nerva        -> recebe sale.paid (HMAC verificado)
     GET  /api/admin/nerva/saldo  -> Nerva GET  /withdrawals/balance
     GET  /api/admin/nerva/saques -> Nerva GET  /withdrawals/my-withdrawals
     POST /api/admin/nerva/saques -> Nerva POST /withdrawals

   A API Key vive SÓ aqui (variável de ambiente). Nunca no front.
   ========================================================= */
'use strict';

/* Carrega o .env antes de qualquer outra coisa. Sem isso, preencher o
   arquivo não teria efeito: o servidor lê process.env e abortaria
   dizendo que falta a NERVA_API_KEY. */
require('./env').carregar();

const express = require('express');
const crypto  = require('crypto');
const admin   = require('./admin');
const content = require('./content');
const pages   = require('./pages');
const tracking = require('./tracking');
const settings = require('./settings');
const push = require('./push');
const ads  = require('./ads');
const geo  = require('./geo');
const precos = require('./precos');   // tabela oficial de preços (checkout e /api/pix/create)

const app  = express();
const PORT = process.env.PORT || 3000;

const NERVA_BASE    = process.env.NERVA_BASE_URL || 'https://pixnerva.com.br/api';
const NERVA_KEY     = process.env.NERVA_API_KEY;             // sk_live_...
const WEBHOOK_SECRET= process.env.NERVA_WEBHOOK_SECRET;      // signing secret do painel
const PUBLIC_URL    = process.env.PUBLIC_URL || '';          // ex: https://api.suaoferta.com
const ALLOWED_ORIGIN= process.env.ALLOWED_ORIGIN || '*';     // domínio da loja

if (!NERVA_KEY) {
  console.error('FALTA NERVA_API_KEY no ambiente. Abortando.');
  process.exit(1);
}

/* body raw preservado: a assinatura HMAC é sobre o corpo cru */
app.use(express.json({
  limit: '12mb',                                   // imagens do editor chegam em base64
  verify: (req, _res, buf) => { req.rawBody = buf.toString('utf8'); }
}));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-requested-with');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

/* painel admin + presença, e o editor da oferta */
const adm = admin.mount(app);
pages.mount(app, adm.auth);    // /p/<produto> — antes do content: trata /api/offer.json?p=
content.mount(app, adm.auth);
tracking.mount(app, adm.auth, express);
settings.mount(app, adm.auth);
ads.mount(app, adm.auth);      // relatorio das campanhas do TikTok no painel
geo.mount(app, adm.auth);      // localizacao dos clientes (IP -> estado/cidade)
push.mount(app, adm.auth);
precos.mount(app);             // GET /api/precos e POST /api/precos/cotar

const onlyDigits = s => String(s || '').replace(/\D/g, '');
const clientIp = req =>
  (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
  req.socket.remoteAddress || '';

async function nerva(path, { method = 'GET', body, idempotencyKey } = {}) {
  const headers = { 'x-api-key': NERVA_KEY };
  if (body) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;

  const r = await fetch(`${NERVA_BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined
  });
  let data = {};
  try { data = await r.json(); } catch (_) {}
  if (!r.ok) {
    const msg = data.message || `Nerva ${r.status}`;
    const err = new Error(msg); err.status = r.status; err.payload = data;
    throw err;
  }
  return data;
}

/* memória local só para reconciliar txid -> eventId do pixel.
   Em produção troque por Redis/DB. */
const sales = new Map();

/* ---------------- idempotência POR PEDIDO (não por navegador) ----------------
   Regra: mesmo CPF + mesmo valor + mesmo produto, dentro de 30 min e ainda
   pendente  ->  devolve A MESMA cobrança (clique repetido não duplica).
   Carrinho mudou, já pagou, ou passou a janela  ->  cobrança NOVA, com o valor
   certo. Antes a chave era o external_id de rastreamento do navegador, que não
   muda nunca: o comprador mexia no carrinho e recebia o QR antigo, com o valor
   da primeira vez. A impressão digital é um hash — o CPF não é guardado. */
const IDEM_WINDOW_MS = 30 * 60e3;
const orderFingerprint = (document, amount, description) =>
  crypto.createHash('sha256')
    .update(`${document}|${Number(amount).toFixed(2)}|${String(description).trim().toLowerCase()}`)
    .digest('hex').slice(0, 24);
const novaChave = fp => `lav1300-${fp.slice(0, 8)}-${Date.now().toString(36)}`;

/* ---------------- CRIAR PIX ---------------- */
app.post('/api/pix/create', async (req, res) => {
  const b = req.body || {};
  try {
    let amount = Number(b.value);
    /* O valor que o navegador manda não é a palavra final. Quando o pedido
       vem junto (itens, extras, oferta de saída, frete), o total é
       recalculado pela tabela oficial (nerva/precos.js) e é ESSE que vai
       para a cobrança. Item fora do catálogo não gera Pix. Sem pedido
       (cliente antigo), vale o valor enviado, como antes. */
    let valorCorrigido = false;
    if (b.pedido && typeof b.pedido === 'object') {
      const cot = precos.cotar(b.pedido);
      if (!cot.ok) {
        return res.status(400).json({ ok: false, error: 'Produto fora do catálogo: ' + cot.naoEncontrados.join(', ') });
      }
      if (cot.itens.length) {
        if (Math.abs(cot.total - amount) > 0.009) {
          valorCorrigido = true;
          admin.logEvent('pix_valor_corrigido', { enviado: amount, oficial: cot.total, rev: cot.rev });
        }
        amount = cot.total;
      }
    }
    // A doc diz mínimo R$ 0,01, mas a API de produção rejeita abaixo de R$ 1,00.
    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({ ok: false, error: 'Valor mínimo da venda é R$ 1,00.' });
    }
    /* A Nerva recusa acima de R$ 10.000 com um 400 genérico. Barrar aqui
       dá uma mensagem que o comprador entende, em vez de "erro ao gerar
       o Pix". Alcançável com muitas unidades no seletor de quantidade. */
    if (amount > 10000) {
      return res.status(400).json({
        ok: false,
        error: 'Valor máximo por pedido é R$ 10.000,00. Reduza a quantidade ou divida em dois pedidos.'
      });
    }
    const document = onlyDigits(b.payerCpf);
    if (document.length !== 11 && document.length !== 14) {
      return res.status(400).json({ ok: false, error: 'CPF inválido.' });
    }

    // eventId único: deduplica pixel + CAPI (Meta/TikTok) no lado da Nerva
    const eventId    = crypto.randomUUID();
    const description = b.description || 'Bicicleta Elétrica V9 Max';
    const orderFp     = orderFingerprint(document, amount, description);
    const anterior    = admin.findRecentByFp(orderFp, IDEM_WINDOW_MS);
    // mesma chave -> a Nerva devolve a mesma cobrança; chave nova -> cobrança nova
    const externalId  = (anterior && anterior.externalId) || novaChave(orderFp);
    const t = b.utms || {};

    const payload = {
      amount,
      description,
      expirationInSeconds: 86400,
      externalId,
      customer: {
        document,
        name:  b.payerName  || undefined,
        email: b.payerEmail || undefined,
        phone: onlyDigits(b.payerPhone) || undefined
      },
      items: [{
        description,
        quantity: 1,
        unitPrice: amount,
        tangible: true
      }],
      /* Rastreamento é NOSSO (tracking.js). Só repassa à Nerva se pedido
         explicitamente, senão ela dispararia um 2º CompletePayment. */
      tracking: process.env.NERVA_SEND_TRACKING !== '1' ? undefined : {
        utmSource:   t.utmSource   || undefined,
        utmMedium:   t.utmMedium   || undefined,
        utmCampaign: t.utmCampaign || undefined,
        utmContent:  t.utmContent  || undefined,
        utmTerm:     t.utmTerm     || undefined,
        fbclid: b.fbclid        || undefined,
        ttclid: b.tiktokClickId || undefined,
        fbp:    b.fbp           || undefined,
        fbc:    b.fbc           || undefined,
        clientUserAgent: req.headers['user-agent'] || undefined,
        clientIpAddress: clientIp(req) || undefined,
        eventId
      }
    };
    if (PUBLIC_URL) payload.postbackUrl = `${PUBLIC_URL}/webhooks/nerva`;

    let sale = await nerva('/sales', {
      method: 'POST', body: payload, idempotencyKey: externalId
    });
    /* a cobrança reaproveitada pode ter sido paga ou expirada sem o painel
       saber (webhook perdido): nesse caso emite uma nova, para o comprador
       nunca receber um QR morto. */
    if (anterior && String(sale.status || '').toLowerCase() !== 'pending') {
      payload.externalId = novaChave(orderFp);
      sale = await nerva('/sales', {
        method: 'POST', body: payload, idempotencyKey: payload.externalId
      });
    }

    sales.set(sale.id, { eventId, externalId: payload.externalId, amount, status: sale.status });
    /* sem o sid a venda nao se liga a jornada do visitante, e o painel nao
       consegue mostrar "quem" comprou */
    try {
      const mon = require('./monitor');
      if (b.sid) mon.passo(b.sid, 'pix_gerado', { valor: amount, vendaId: sale.id });
      mon.emitir('pix', { sid: b.sid || '', id: sale.id, amount });   // painel atualiza na hora
    } catch (_) {}

    /* contexto de match guardado para o CompletePayment sair do servidor
       mesmo que o comprador feche o navegador antes de pagar */
    /* itens por SKU vindos do navegador (mesmo contents do pixel). Fallback:
       um item só, com o SKU da página — antes era sempre assim, e o evento do
       servidor não casava com o catálogo quando o carrinho tinha mais de um. */
    const contents = tracking.sanitizeContents(b.ttkContents)
      || [{ content_id: b.product_id || 'produto', content_name: b.description || '', price: amount, quantity: 1 }];
    const ctx = {
      eventId, amount,
      ttclid: b.tiktokClickId || '', ttp: b.ttp || '',
      external_id: b.ttkExternalId || '',
      email: b.payerEmail || '', phone: b.payerPhone || '',
      ip: clientIp(req), user_agent: req.headers['user-agent'] || '',
      locale: b.locale || tracking.localeDe(req) || '',
      customer_type: b.customer_type === 'returning' ? 'returning' : 'new',
      ad: tracking.sanitizeAd(b.ad) || undefined,
      page_url: b.landingPageUrl || '', product_id: b.product_id || '', product_name: b.description || '',
      contents
    };
    tracking.remember(sale.id, ctx);
    tracking.enqueue(Object.assign({}, ctx, {
      event: 'PlaceAnOrder', event_id: 'pao-' + sale.id, order_id: sale.id, value: amount
    }));

    admin.recordSale(sale, {
      sid: b.sid || '',          // liga a venda a jornada do visitante
      payerName: b.payerName || '',
      utmSource: t.utmSource || '', utmCampaign: t.utmCampaign || '',
      utmMedium: t.utmMedium || '', utmContent: t.utmContent || '', utmTerm: t.utmTerm || '',
      /* aparelho fica na venda: sem isso nao da para saber que a queda de
         conversao veio de troca de publico (iOS -> Android) e nao da oferta.
         Vai so para o painel; a Nerva continua sem tracking (2o CompletePayment). */
      device: admin.deviceOf(req.headers['user-agent']),
      description: b.description || '', ttclid: b.tiktokClickId || '', eventId, orderFp
    });
    admin.logEvent(anterior && sale.id === anterior.id ? 'pix_reaproveitado' : 'pix_criado',
      { id: sale.id, amount, utmCampaign: t.utmCampaign || '' });
    push.notifyPixCreated(admin.getSale(sale.id));   // notifica PIX gerado (pendente)

    // contrato que o front já espera
    return res.json({
      valor: amount, valorCorrigido,          // total oficial cobrado (pode diferir do enviado)
      ok: true,
      txid: sale.id,
      qrCode: sale.pixCode,
      base64QrCode: sale.pixQrCode,
      purchaseEventId: eventId,
      externalId: payload.externalId,
      transactionId: sale.transactionId,
      status: sale.status
    });
  } catch (e) {
    console.error('createPix:', e.message, e.payload || '');
    const errMsg = (e.payload && e.payload.message) || (e.status && e.status < 500 && e.message) || 'Não foi possível gerar o PIX.';
    return res.status(e.status || 500).json({ ok: false, error: errMsg });
  }
});

/* ---------------- CompletePayment server-side ---------------- */
// Guarda contra corrida: webhook e polling podem confirmar a mesma venda
// quase ao mesmo tempo. Só o primeiro dispara; o enqueue ainda deduplica por
// event_id, mas esta trava evita até o trabalho repetido.
/* F6: trava anti-duplicacao PERSISTIDA. Era so em memoria — um restart do
   processo zerava e um webhook re-entregue disparava CompletePayment de novo. */
const _fsP   = require('fs'), _pathP = require('path');
const PAID_DB = _pathP.join(process.env.DATA_DIR || _pathP.join(__dirname, 'data'), 'paid-fired.json');
const paidFired = new Set((() => {
  try { return JSON.parse(_fsP.readFileSync(PAID_DB, 'utf8')) || []; } catch (_) { return []; }
})());
let paidSujo = false;
setInterval(() => {
  if (!paidSujo) return;
  paidSujo = false;
  try { _fsP.writeFileSync(PAID_DB, JSON.stringify([...paidFired].slice(-20000))); }
  catch (e) { console.error('[paid] persist:', e.message); }
}, 5000);
/* hora em que a Nerva confirmou o pagamento (paidAt/updatedAt): vai como
   event_time do CompletePayment. E o instante real da compra, o que o TikTok
   usa para atribuir ao clique; sem isso ia a hora em que ficamos sabendo. */
function quandoPagou(data) {
  const t = Date.parse((data && (data.paidAt || data.updatedAt)) || '');
  const agora = Date.now();
  return Number.isFinite(t) && t <= agora + 60e3 && t >= agora - 7 * 86400e3 ? t : agora;
}
function firePaid(saleId, amount, origem, data) {
  if (paidFired.has(saleId)) return;
  paidFired.add(saleId); paidSujo = true;
  /* ORDEM: primeiro o TikTok, depois push e painel. O evento de compra e o que
     mais vale; nada de esperar gravacao em disco ou notificacao na frente dele. */
  let r;
  const c = tracking.contextOf(saleId);
  if (c) {
    const valor = amount != null ? amount : c.amount;
    r = tracking.enqueue(Object.assign({}, c, {
      event: 'Purchase', event_id: c.eventId, order_id: saleId,   // era CompletePayment (renomeado pelo TikTok)
      event_time: quandoPagou(data),
      value: valor,
      /* contexto antigo (antes desta versão) pode não ter contents */
      contents: (c.contents && c.contents.length) ? c.contents
        : [{ content_id: c.product_id || 'produto', content_name: c.product_name, price: valor, quantity: 1 }]
    }), { imediato: true });
  }
  push.notifyPaid(admin.getSale(saleId), amount);   // notifica venda aprovada (1x)
  if (!c) { console.warn('[track] pago sem contexto de match:', saleId, '(via ' + (origem||'?') + ')'); return; }
  admin.logEvent('purchase_tracked', { id: saleId, via: origem || '?', match: tracking.matchScore ? tracking.matchScore(c) : null });
  return r;
}

/* ---------------- STATUS (polling do front) ---------------- */
app.get('/api/pix/status/:id', async (req, res) => {
  try {
    /* ja confirmado aqui (webhook, vigia ou reconciliacao)? responde na hora,
       sem mais uma ida a Nerva — o comprador ve "pago" no proximo poll */
    const local = admin.getSale(req.params.id);
    if (local && String(local.status).toLowerCase() === 'paid') {
      return res.json({ status: 'PAID', amount: local.amount, paidAt: local.paidAt, purchaseEventId: local.eventId || undefined });
    }
    const sale = await nerva(`/sales/${encodeURIComponent(req.params.id)}`);
    const cached = sales.get(sale.id);
    if (cached) cached.status = sale.status;
    if (String(sale.status).toLowerCase() === 'paid') { firePaid(sale.id, sale.amount, 'polling', sale); admin.markPaid(sale.id, sale); }
    else admin.setStatus(sale.id, sale.status);
    const stored = admin.getSale(sale.id);
    const eventId = (cached && cached.eventId) || (stored && stored.eventId) || undefined;
    // o front compara em MAIÚSCULO: pending->PENDING, paid->PAID
    return res.json({
      status: String(sale.status || '').toUpperCase(),
      amount: sale.amount,
      paidAt: sale.updatedAt,
      purchaseEventId: eventId
    });
  } catch (e) {
    console.error('status:', e.message);
    return res.status(e.status || 500).json({ status: 'UNKNOWN' });
  }
});

/* ---------------- SALDO E SAQUES (painel) ----------------
   Repassam as rotas da Nerva, protegidos pelo ADMIN_TOKEN. A API Key
   nunca sai daqui. Só leitura, exceto o POST de saque. */
function exigeAdmin(req, res, next) {
  const esperado = process.env.ADMIN_TOKEN;
  if (!esperado) return res.status(500).json({ error: 'ADMIN_TOKEN não configurado' });
  const t = req.query.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(String(t)), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Token inválido' });
  }
  next();
}

// A Nerva devolve o saldo em CENTAVOS. Converter aqui evita que o painel
// mostre "R$ 150.000,00" no lugar de "R$ 1.500,00".
const centavosParaReais = c => Number(c || 0) / 100;

app.get('/api/admin/nerva/saldo', exigeAdmin, async (req, res) => {
  try {
    const r = await nerva('/withdrawals/balance');
    const d = (r && r.data) || {};
    res.json({
      disponivel: centavosParaReais(d.available),
      retido:     centavosParaReais(d.withheld),
      bruto:      { available: d.available, withheld: d.withheld }
    });
  } catch (e) {
    console.error('saldo:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.get('/api/admin/nerva/saques', exigeAdmin, async (req, res) => {
  try {
    const q = new URLSearchParams();
    q.set('page',  req.query.page  || '1');
    q.set('limit', Math.min(Number(req.query.limit) || 20, 100));
    if (req.query.status) q.set('status', req.query.status);
    res.json(await nerva(`/withdrawals/my-withdrawals?${q}`));
  } catch (e) {
    console.error('saques:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

app.post('/api/admin/nerva/saques', exigeAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const amount = Number(b.amount);
    if (!(amount >= 1)) return res.status(400).json({ error: 'Valor mínimo de saque: R$ 1,00.' });

    const tipos = ['cpf', 'cnpj', 'email', 'phone', 'random'];
    const pixKeyType = String(b.pixKeyType || '').toLowerCase();
    if (!tipos.includes(pixKeyType)) {
      return res.status(400).json({ error: `pixKeyType deve ser um de: ${tipos.join(', ')}.` });
    }
    if (!b.pixKey) return res.status(400).json({ error: 'Informe a chave PIX.' });

    const saque = await nerva('/withdrawals', {
      method: 'POST',
      body: {
        amount, method: 'pix', pixKeyType, pixKey: String(b.pixKey),
        reference: b.reference || `saque-${Date.now().toString(36)}`
      },
      // sem isso, um duplo clique no painel viraria dois saques
      idempotencyKey: b.reference || `saque-${Date.now().toString(36)}`
    });
    res.status(201).json(saque);
  } catch (e) {
    console.error('saque:', e.message);
    res.status(e.status || 500).json({ error: e.message });
  }
});

/* ---------------- WEBHOOK ---------------- */
function verifySignature(req) {
  if (!WEBHOOK_SECRET) return false;
  const timestamp = req.headers['x-pixnerva-timestamp'];
  const signature = req.headers['x-pixnerva-signature'];
  if (!timestamp || !signature) return false;

  // replay protection: 5 min
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(`${timestamp}.${req.rawBody}`)
    .digest('hex');

  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

app.post('/webhooks/nerva', (req, res) => {
  if (!verifySignature(req)) return res.status(401).json({ error: 'Assinatura inválida' });

  const { event, data } = req.body || {};
  const rec = data && sales.get(data.id);

  switch (event) {
    case 'sale.paid':
      console.log('PAGO:', data.id, data.amount, 'eventId:', rec && rec.eventId);
      firePaid(data.id, data.amount, 'webhook', data);   // TikTok primeiro
      admin.markPaid(data.id, data);                      // depois painel/disco
      // Aqui: libere o pedido / dispare o Purchase server-side se não usar o da Nerva.
      break;
    case 'sale.expired':
    case 'sale.failed':
      console.log('NÃO PAGO:', event, data && data.id);
      if (data && data.id) admin.setStatus(data.id, event === 'sale.expired' ? 'expired' : 'failed');
      break;
    /* Estorno: o dinheiro voltou para o comprador. Sem tratar isso, a venda
       seguia marcada como paga no painel e o faturamento ficava inflado. */
    case 'sale.refunded':
    case 'sale.med_accepted':
      console.warn('ESTORNADO:', event, data && data.id, data && data.amount);
      if (data && data.id) admin.setStatus(data.id, 'refunded');
      break;

    case 'sale.med_created':
      // MED é passivo: apenas registra, não abre disputa.
      console.warn('MED aberto:', data && data.id);
      break;

    case 'sale.med_rejected':
    case 'sale.med_cancelled':
      // contestação encerrada a favor do seller: a venda continua paga
      console.log('MED encerrado:', event, data && data.id);
      break;

    case 'sale.status_changed':
      console.log('status:', data && data.previousStatus, '->', data && data.status);
      break;

    /* Saques: só registram no log. O saldo é consultado sob demanda em
       /api/admin/nerva/saldo, então não há estado local a atualizar. */
    case 'withdrawal.completed':
      console.log('SAQUE PAGO:', data && data.id, data && data.amount);
      break;
    case 'withdrawal.failed':
    case 'withdrawal.rejected':
      console.warn('SAQUE NÃO PAGO:', event, data && data.id, '- saldo devolvido');
      break;

    default:
      console.log('evento:', event);
  }
  if (rec && data) rec.status = data.status;
  return res.status(200).json({ received: true });
});

/* ---------------- RECONCILIAÇÃO COM A NERVA (rede de segurança) ----------------
   A Nerva é a fonte da verdade. A cada poucos minutos puxamos as vendas DESTA
   oferta (descrição dos produtos da loja) e: (a) preenchemos no painel qualquer PIX
   pago/pendente que tenha faltado; (b) corrigimos status de quem já está no
   painel (pending -> paid/expired) caso um webhook tenha falhado.
   Só mexe no painel — não redispara pixel nem push. */
/* descrições das vendas desta loja: produto principal, relacionados, combo e
   os textos genéricos de taxa/entrega que o funil usa */
const LAV_RE = /v9\s?max|bicicleta|bike|patinete|cavalletta|capacete|compressor|boombox|carregador|combo|vonder|lavadora|lav\s?1[36]00|planeta|taxa|tnef|libera|entrega|frete/i;
const RECON_MAX_AGE = 3 * 86400e3;                 // só últimos 3 dias
let reconciling = false;
async function reconcileFromNerva() {
  if (reconciling) return;
  reconciling = true;
  let added = 0, healed = 0, scanned = 0;
  try {
    const cutoff = Date.now() - RECON_MAX_AGE;
    for (let page = 1; page <= 8; page++) {
      let d;
      try { d = await nerva(`/sales?limit=50&page=${page}`); }
      catch (e) { console.error('[reconcile] page', page, e.message); break; }
      const arr = Array.isArray(d) ? d : (d && d.data);
      if (!Array.isArray(arr) || !arr.length) break;
      let anyRecent = false;
      for (const s of arr) {
        if (!s || !s.id) continue;
        const created = new Date(s.createdAt || 0).getTime();
        if (created >= cutoff) anyRecent = true; else continue;
        const isDaqui = (s.externalId && String(s.externalId).startsWith('lav1300-')) ||
                        !!admin.getSale(s.id) ||
                        LAV_RE.test(String(s.description || ''));
        if (!isDaqui) continue;   // só vendas desta oferta/catálogo
        scanned++;
        const st = String(s.status || '').toLowerCase();
        const existing = admin.getSale(s.id);
        const realPaidAt = s.paidAt || (st === 'paid' ? (s.updatedAt || s.createdAt) : null);
        if (!existing) {
          if (st !== 'paid' && st !== 'pending') continue;         // ignora órfão expirado/falho
          admin.recordSale({
            id: s.id, status: st, amount: s.amount, fee: s.fee, netAmount: s.netAmount,
            description: s.description, externalId: s.externalId, transactionId: s.transactionId,
            createdAt: s.createdAt, paidAt: realPaidAt
          }, { payerName: (s.customer && s.customer.name) || '', description: s.description });
          if (st === 'paid') { firePaid(s.id, s.amount, 'reconcile', Object.assign({}, s, { paidAt: realPaidAt })); admin.markPaid(s.id, Object.assign({}, s, { paidAt: realPaidAt })); }
          added++;
        } else {
          const cur = String(existing.status || '').toLowerCase();
          if (st === 'paid' && cur !== 'paid') { firePaid(s.id, s.amount, 'reconcile', Object.assign({}, s, { paidAt: realPaidAt })); admin.markPaid(s.id, Object.assign({}, s, { paidAt: realPaidAt })); healed++; }
          else if ((st === 'expired' || st === 'failed') && cur === 'pending') { admin.setStatus(s.id, st); healed++; }
        }
      }
      if (!anyRecent) break;   // páginas seguintes são ainda mais antigas
    }
    if (added || healed) console.log(`[reconcile] +${added} add, ${healed} corrigidas (scan ${scanned})`);
  } catch (e) { console.error('[reconcile]', e.message); }
  finally { reconciling = false; }
}
setTimeout(reconcileFromNerva, 15000);              // ao subir
setInterval(reconcileFromNerva, 2 * 60 * 1000);     // a cada 2 min

/* ---------------- VIGIA DAS COBRANÇAS PENDENTES ----------------
   O caminho mais comum no celular: a pessoa gera o Pix, vai para o app do
   banco e NAO volta para a aba. Sem webhook cadastrado (ou quando ele
   falha), o pagamento so aparecia na reconciliacao, minutos depois. Aqui o
   servidor consulta cada cobranca pendente na Nerva por conta propria:
     • primeiros 15 min : a cada 3 s   (e quando a maioria paga)
     • ate 2 h          : a cada 30 s
     • ate 24 h         : a cada 5 min (o Pix expira em 24 h)
   Uma consulta por vez, no maximo 10 por rodada, para nao estourar a API. */
const ultimaChecagem = new Map();      // saleId -> ts da ultima consulta
let vigiando = false;
async function vigiarPendentes() {
  if (vigiando) return;
  vigiando = true;
  try {
    const agora = Date.now();
    const pend = admin.pendingSales(24 * 3600e3)
      .filter(s => {
        const idade = agora - new Date(s.createdAt || 0).getTime();
        const passo = idade < 15 * 60e3 ? 3000 : idade < 2 * 3600e3 ? 30e3 : 5 * 60e3;
        return agora - (ultimaChecagem.get(s.id) || 0) >= passo;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
    for (const s of pend) {
      ultimaChecagem.set(s.id, Date.now());
      let atual;
      try { atual = await nerva(`/sales/${encodeURIComponent(s.id)}`); }
      catch (e) { if (e.status === 404) admin.setStatus(s.id, 'failed'); continue; }
      const st = String((atual && atual.status) || '').toLowerCase();
      if (st === 'paid') {
        firePaid(s.id, atual.amount, 'vigia', atual);
        admin.markPaid(s.id, atual);
        console.log('PAGO (vigia):', s.id, atual.amount);
      } else if (st === 'expired' || st === 'failed' || st === 'refunded') {
        admin.setStatus(s.id, st);
      }
    }
    // limpa o mapa de quem ja saiu de pendente
    if (ultimaChecagem.size > 2000) ultimaChecagem.clear();
  } catch (e) { console.error('[vigia]', e.message); }
  finally { vigiando = false; }
}
setInterval(vigiarPendentes, 3000);

app.get('/health', (_req, res) => res.json({ ok: true, gateway: 'nerva' }));

/* a loja em si — assim o editor visual consegue exibi-la no mesmo domínio */
/* seguranca: nunca expor dados de clientes (nerva/data) nem o codigo do
   backend (nerva/*.js|json|md) pela web — so as paginas .html do admin/editor */
app.use((req, res, next) => {
  const rp = req.path || '';
  /* qualquer segmento oculto (/.git/config, /.env, /nerva/.env) e a pasta de
     deploy: o express.static entregava /.git/config — e o clone do
     repositorio poderia carregar credenciais. Bloqueio aqui E no Nginx. */
  const oculto = rp.split('/').some(seg => seg.startsWith('.'));
  if (oculto || rp.startsWith('/deploy/') || rp.startsWith('/nerva/data/') || /^\/nerva\/[^/]+\.(js|json|md|example)$/i.test(rp)) {
    return res.status(404).end();
  }
  next();
});

app.use(express.static(require('path').join(__dirname, '..'), { index: 'index.html', extensions: ['html'] }));

const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => console.log(`Nerva adapter on ${HOST}:${PORT}`));
