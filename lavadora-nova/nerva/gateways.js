'use strict';
/* =============================================================================
   GATEWAYS DE PAGAMENTO (Pix)

   Um adaptador por gateway, todos com a MESMA cara. O servidor não sabe qual
   está recebendo: pede `ativo()` e chama criarCobranca / consultar / webhook.
   Trocar quem recebe = clicar no painel (Gateways). Vale na hora, sem
   reiniciar, e as cobranças já emitidas continuam sendo acompanhadas no
   gateway em que nasceram (a venda guarda `gateway`).

   Contrato de cada adaptador:
     id, nome, site, campos[]        — o que o painel mostra/pede
     webhookPath                     — rota que o gateway chama (/webhooks/<id>)
     pronto(cfg)                     — tem credenciais para cobrar?
     criarCobranca(cfg, pedido)      — -> venda normalizada (ver normalizar())
     consultar(cfg, id)              — -> venda normalizada
     webhook.verificar(cfg, req)     — assinatura ok? ('sem' = não verifica)
     webhook.interpretar(body)       — -> { evento, id, amount, status, dados }
     listar(cfg, page)  [opcional]   — vendas recentes (reconciliação)
     saldo/saques/sacar [opcional]   — painel financeiro
     testar(cfg)                     — chamada leve para validar a credencial

   Venda normalizada:
     { id, status: pending|paid|expired|failed|refunded, amount (reais),
       pixCode (copia e cola), pixQrCode (imagem base64/url), transactionId,
       externalId, description, fee, netAmount, createdAt, paidAt, updatedAt,
       raw }
   ============================================================================= */
const crypto   = require('crypto');
const settings = require('./settings');

const onlyDigits = s => String(s || '').replace(/\D/g, '');

/* ---------- status: cada gateway fala de um jeito; aqui vira 5 palavras ---------- */
function normStatus(s) {
  s = String(s || '').toLowerCase().trim();
  if (['paid', 'approved', 'completed', 'confirmed', 'pago', 'aprovado', 'aprovada', 'success', 'succeeded', 'settled', 'received', 'concluida', 'concluída'].includes(s)) return 'paid';
  if (['pending', 'waiting_payment', 'waiting', 'processing', 'created', 'pendente', 'aguardando', 'aguardando_pagamento', 'unpaid', 'open', 'active', 'authorized', 'analysis', 'in_analysis'].includes(s)) return 'pending';
  if (['expired', 'expirado', 'expirada', 'canceled', 'cancelled', 'cancelado', 'cancelada', 'timeout'].includes(s)) return 'expired';
  if (['refunded', 'chargedback', 'chargeback', 'estornado', 'estornada', 'reembolsado', 'med_accepted', 'reversed', 'devolvido'].includes(s)) return 'refunded';
  if (['failed', 'refused', 'rejected', 'error', 'falhou', 'recusado', 'recusada', 'denied', 'declined'].includes(s)) return 'failed';
  return s || 'pending';
}

/* ---------- HTTP com timeout e erro legível ---------- */
async function http(url, { method = 'GET', headers = {}, body, timeout = 20000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, {
      method,
      headers: Object.assign({ Accept: 'application/json' }, body ? { 'Content-Type': 'application/json' } : {}, headers),
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const txt = await r.text();
    let data = {};
    try { data = txt ? JSON.parse(txt) : {}; } catch (_) { data = { raw: txt.slice(0, 500) }; }
    if (!r.ok) {
      const msg = (data && (data.message || data.error || data.msg || data.detail)) || `HTTP ${r.status}`;
      const e = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)); e.status = r.status; e.payload = data;
      throw e;
    }
    return data;
  } catch (e) {
    if (e.name === 'AbortError') { const t2 = new Error('Gateway demorou demais para responder.'); t2.status = 504; throw t2; }
    throw e;
  } finally { clearTimeout(t); }
}

/* ---------- pega o primeiro campo existente (gateways usam nomes diferentes) ---------- */
function pick(obj, paths) {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}
const toReais = (v, centavos) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return undefined;
  return centavos ? n / 100 : n;
};

function normalizar(gwId, d, { centavos = false } = {}) {
  const st = normStatus(pick(d, ['status', 'data.status', 'transaction.status', 'payment.status']));
  const paidAt = pick(d, ['paidAt', 'paid_at', 'approvedAt', 'approved_at', 'data.paidAt']) || (st === 'paid' ? pick(d, ['updatedAt', 'updated_at']) : null);
  return {
    gateway: gwId,
    id: String(pick(d, ['id', 'data.id', 'transaction.id', 'transactionId', 'txid']) || ''),
    status: st,
    amount: toReais(pick(d, ['amount', 'data.amount', 'value', 'total', 'transaction.amount']), centavos),
    pixCode: pick(d, ['pixCode', 'pix.qrcode', 'pix.qrCode', 'pix.copyPaste', 'pix.copy_paste', 'pix.brCode', 'pix.emv', 'pix.code', 'qrcode', 'qrCode', 'pix_code', 'copyPaste', 'copy_paste', 'brCode', 'brcode', 'emv', 'data.pix.qrcode', 'data.pixCode', 'data.qrcode']),
    pixQrCode: pick(d, ['pixQrCode', 'pix.qrcodeImage', 'pix.qrcode_image', 'pix.qrCodeBase64', 'pix.base64', 'pix.image', 'qrCodeBase64', 'qrcode_base64', 'base64QrCode', 'qrCodeImage', 'data.pix.qrcodeImage', 'data.pixQrCode']),
    transactionId: pick(d, ['transactionId', 'transaction_id', 'endToEndId', 'end_to_end_id', 'e2eId']),
    externalId: pick(d, ['externalId', 'external_id', 'externalRef', 'external_ref', 'reference', 'metadata.externalId']),
    description: pick(d, ['description', 'items.0.title', 'items.0.description']) || '',
    fee: toReais(pick(d, ['fee', 'fees', 'data.fee']), centavos) || 0,
    netAmount: toReais(pick(d, ['netAmount', 'net_amount', 'liquid', 'data.netAmount']), centavos) || 0,
    createdAt: pick(d, ['createdAt', 'created_at', 'data.createdAt']),
    paidAt: paidAt || null,
    updatedAt: pick(d, ['updatedAt', 'updated_at']),
    raw: d
  };
}

/* =============================================================================
   1) PixNerva — integração completa (a que a loja já usava)
   ============================================================================= */
const nerva = {
  id: 'nerva', nome: 'PixNerva', site: 'https://pixnerva.com.br',
  nota: 'Integração completa: cobrança, webhook assinado (HMAC), reconciliação, saldo e saques.',
  campos: [
    { key: 'apiKey',        label: 'API Key',        secreto: true, obrigatorio: true, placeholder: 'sk_live_…' },
    { key: 'webhookSecret', label: 'Webhook secret', secreto: true, placeholder: 'whsec_… (confirma o pagamento)' },
    { key: 'baseUrl',       label: 'URL da API',     placeholder: 'https://pixnerva.com.br/api' }
  ],
  webhookPath: '/webhooks/nerva',
  base: cfg => String(cfg.baseUrl || process.env.NERVA_BASE_URL || 'https://pixnerva.com.br/api').replace(/\/+$/, ''),
  pronto: cfg => !!(cfg.apiKey || '').trim(),
  async req(cfg, path, { method = 'GET', body, idempotencyKey } = {}) {
    const key = (cfg.apiKey || '').trim();
    if (!key) { const e = new Error('Pagamento indisponível: falta a chave da Nerva no servidor.'); e.status = 503; throw e; }
    const headers = { 'x-api-key': key };
    if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
    try { return await http(`${nerva.base(cfg)}${path}`, { method, headers, body }); }
    catch (e) { if (!/^HTTP \d+$/.test(e.message) === false) e.message = e.message.replace(/^HTTP/, 'Nerva'); throw e; }
  },
  async criarCobranca(cfg, p) {
    const payload = {
      amount: p.amount,
      description: p.description,
      expirationInSeconds: p.expiresInSeconds || 86400,
      externalId: p.externalId,
      customer: {
        document: p.customer.document,
        name: p.customer.name || undefined,
        email: p.customer.email || undefined,
        phone: onlyDigits(p.customer.phone) || undefined
      },
      items: (p.items || []).map(i => ({ description: i.description, quantity: i.quantity || 1, unitPrice: i.unitPrice, tangible: true })),
      tracking: p.tracking || undefined
    };
    if (p.postbackUrl) payload.postbackUrl = p.postbackUrl;
    const sale = await nerva.req(cfg, '/sales', { method: 'POST', body: payload, idempotencyKey: p.externalId });
    return normalizar('nerva', sale);
  },
  async consultar(cfg, id) {
    return normalizar('nerva', await nerva.req(cfg, `/sales/${encodeURIComponent(id)}`));
  },
  async listar(cfg, page = 1) {
    const d = await nerva.req(cfg, `/sales?limit=50&page=${page}`);
    const arr = Array.isArray(d) ? d : (d && d.data);
    return Array.isArray(arr) ? arr.filter(s => s && s.id).map(s => normalizar('nerva', s)) : [];
  },
  webhook: {
    verificar(cfg, req) {
      const secret = (cfg.webhookSecret || '').trim();
      if (!secret) return false;
      const timestamp = req.headers['x-pixnerva-timestamp'];
      const signature = req.headers['x-pixnerva-signature'];
      if (!timestamp || !signature) return false;
      if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;      // replay: 5 min
      const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${req.rawBody}`).digest('hex');
      const a = Buffer.from(String(signature)), b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },
    interpretar(body) {
      const { event, data } = body || {};
      const id = data && data.id;
      const map = {
        'sale.paid': 'paid', 'sale.expired': 'expired', 'sale.failed': 'failed',
        'sale.refunded': 'refunded', 'sale.med_accepted': 'refunded'
      };
      return { evento: map[event] || 'info', tipo: event, id, amount: data && data.amount, status: data && normStatus(data.status), dados: data || {} };
    }
  },
  /* saldo em CENTAVOS na Nerva */
  async saldo(cfg) {
    const r = await nerva.req(cfg, '/withdrawals/balance');
    const d = (r && r.data) || {};
    return { disponivel: Number(d.available || 0) / 100, retido: Number(d.withheld || 0) / 100, bruto: d };
  },
  async saques(cfg, q) { return nerva.req(cfg, `/withdrawals/my-withdrawals?${q}`); },
  async sacar(cfg, body, idempotencyKey) { return nerva.req(cfg, '/withdrawals', { method: 'POST', body, idempotencyKey }); },
  async testar(cfg) { const s = await nerva.saldo(cfg); return { ok: true, detalhe: `saldo disponível R$ ${s.disponivel.toFixed(2)}` }; }
};

/* =============================================================================
   2) Gateways de checkout "padrão de mercado" (Zenixpay, FlevoPay, InvictusPay)

   Os três seguem o formato mais comum entre gateways brasileiros de oferta:
   Basic auth com chave secreta, POST /transactions (valor em centavos,
   paymentMethod "pix"), GET /transactions/:id e webhook com { type, data }.
   As URLs e nomes de campo abaixo são o padrão desse formato — quando a
   documentação oficial de cada um chegar, é só ajustar AQUI (um lugar só)
   e a URL da API pelo painel. Por segurança, um webhook desses gateways
   NUNCA marca a venda como paga sozinho: o servidor reconsulta a API
   (consultar) antes de confirmar.
   ============================================================================= */
function gatewayPadrao({ id, nome, site, baseUrl, nota }) {
  const gw = {
    id, nome, site, nota: nota || 'Formato padrão de gateways de checkout. Confira a URL da API na documentação do gateway.',
    campos: [
      { key: 'secretKey',     label: 'Chave secreta (Secret Key)', secreto: true, obrigatorio: true, placeholder: 'sk_… / chave secreta' },
      { key: 'publicKey',     label: 'Chave pública (Public Key)', placeholder: 'pk_… (se o gateway usar)' },
      { key: 'webhookSecret', label: 'Token do webhook',           secreto: true, placeholder: 'opcional — se o gateway assinar o webhook' },
      { key: 'baseUrl',       label: 'URL da API',                 placeholder: baseUrl, obrigatorio: true }
    ],
    webhookPath: `/webhooks/${id}`,
    centavos: true,
    base: cfg => String(cfg.baseUrl || baseUrl).replace(/\/+$/, ''),
    pronto: cfg => !!(cfg.secretKey || '').trim() && !!gw.base(cfg),
    auth(cfg) {
      const sk = (cfg.secretKey || '').trim(), pk = (cfg.publicKey || '').trim();
      const basic = Buffer.from(pk ? `${pk}:${sk}` : `${sk}:x`).toString('base64');
      return { Authorization: `Basic ${basic}`, 'x-api-key': sk, 'api-key': sk };
    },
    async req(cfg, path, opts = {}) {
      if (!gw.pronto(cfg)) { const e = new Error(`Pagamento indisponível: ${nome} sem chave cadastrada.`); e.status = 503; throw e; }
      return http(`${gw.base(cfg)}${path}`, Object.assign({}, opts, { headers: Object.assign(gw.auth(cfg), opts.headers || {}) }));
    },
    async criarCobranca(cfg, p) {
      const doc = onlyDigits(p.customer.document);
      const cents = Math.round(p.amount * 100);
      const payload = {
        amount: cents,
        paymentMethod: 'pix',
        pix: { expiresInDays: Math.max(1, Math.ceil((p.expiresInSeconds || 86400) / 86400)) },
        externalRef: p.externalId,
        postbackUrl: p.postbackUrl || undefined,
        items: (p.items || [{ description: p.description, quantity: 1, unitPrice: p.amount }]).map(i => ({
          title: i.description, unitPrice: Math.round(Number(i.unitPrice) * 100), quantity: i.quantity || 1, tangible: true
        })),
        customer: {
          name: p.customer.name || 'Cliente',
          email: p.customer.email || undefined,
          phone: onlyDigits(p.customer.phone) || undefined,
          document: { number: doc, type: doc.length > 11 ? 'cnpj' : 'cpf' }
        },
        metadata: { externalId: p.externalId, description: p.description }
      };
      const d = await gw.req(cfg, '/transactions', { method: 'POST', body: payload });
      const v = normalizar(id, d, { centavos: true });
      if (!v.id) { const e = new Error(`${nome}: resposta sem id de transação`); e.payload = d; throw e; }
      if (!v.pixCode) { const e = new Error(`${nome}: resposta sem código Pix (confira a documentação/URL da API)`); e.payload = d; throw e; }
      v.externalId = v.externalId || p.externalId;
      return v;
    },
    async consultar(cfg, tid) {
      return normalizar(id, await gw.req(cfg, `/transactions/${encodeURIComponent(tid)}`), { centavos: true });
    },
    webhook: {
      /* sem assinatura padronizada: se houver token cadastrado, exige que venha
         em um cabeçalho ou na query (?token=); sem token, devolve 'sem' e o
         servidor confirma o status reconsultando a API */
      verificar(cfg, req) {
        const tok = (cfg.webhookSecret || '').trim();
        if (!tok) return 'sem';
        const cand = [req.headers['x-webhook-token'], req.headers['x-webhook-secret'], req.headers['x-signature'], req.headers['x-hub-signature'],
                      req.headers['authorization'], req.query && req.query.token, req.body && req.body.token].filter(Boolean).map(String);
        return cand.some(c => c === tok || c === `Bearer ${tok}` || c === `Basic ${tok}`);
      },
      interpretar(body) {
        const data = (body && (body.data || body.transaction || body.payment)) || body || {};
        const status = normStatus(pick(data, ['status']) || pick(body || {}, ['status', 'event', 'type']));
        return { evento: ['paid', 'expired', 'failed', 'refunded'].includes(status) ? status : 'info', tipo: body && (body.type || body.event) || status,
                 id: pick(data, ['id', 'transactionId', 'transaction_id']), amount: toReais(pick(data, ['amount']), true), status, dados: data };
      }
    },
    async testar(cfg) {
      /* consulta uma transação que não existe: 404 = credencial aceita; 401/403 = chave errada */
      try { await gw.req(cfg, '/transactions/teste-conexao'); return { ok: true, detalhe: 'credencial aceita' }; }
      catch (e) {
        if (e.status === 404 || e.status === 400 || e.status === 422) return { ok: true, detalhe: `credencial aceita (HTTP ${e.status} ao consultar transação inexistente)` };
        if (e.status === 401 || e.status === 403) return { ok: false, detalhe: 'chave recusada (401/403). Confira a Secret Key.' };
        return { ok: false, detalhe: e.message };
      }
    }
  };
  return gw;
}

const ADAPTADORES = {
  nerva,
  zenixpay:    gatewayPadrao({ id: 'zenixpay',    nome: 'Zenixpay',    site: 'https://zenixpay.com.br',    baseUrl: 'https://api.zenixpay.com.br/v1' }),
  flevopay:    gatewayPadrao({ id: 'flevopay',    nome: 'FlevoPay',    site: 'https://flevopay.com.br',    baseUrl: 'https://api.flevopay.com.br/v1' }),
  invictuspay: gatewayPadrao({ id: 'invictuspay', nome: 'InvictusPay', site: 'https://invictuspay.com.br', baseUrl: 'https://api.invictuspay.app.br/v1' })
};
const ORDEM = ['nerva', 'zenixpay', 'flevopay', 'invictuspay'];

/* ---------- acesso ---------- */
function porId(id) { return ADAPTADORES[String(id || '').toLowerCase()] || null; }
function ativoId() { const id = String(settings.get().gatewayAtivo || 'nerva').toLowerCase(); return ADAPTADORES[id] ? id : 'nerva'; }
function ativo() { const id = ativoId(); return { adapter: ADAPTADORES[id], cfg: settings.gatewayConfig(id) }; }
/* adaptador da venda: o gateway em que ela nasceu (troca de gateway não perde as pendentes) */
function deVenda(venda) {
  const id = venda && venda.gateway && ADAPTADORES[venda.gateway] ? venda.gateway : ativoId();
  return { adapter: ADAPTADORES[id], cfg: settings.gatewayConfig(id) };
}

function mask(v) { v = String(v || ''); return !v ? '' : v.length <= 4 ? '••••' : '••••••••' + v.slice(-4); }
function vista(publicUrl) {
  const at = ativoId();
  return ORDEM.map(id => {
    const a = ADAPTADORES[id], cfg = settings.gatewayConfig(id);
    return {
      id, nome: a.nome, site: a.site, nota: a.nota,
      ativo: id === at, pronto: a.pronto(cfg),
      webhookUrl: (publicUrl ? publicUrl.replace(/\/+$/, '') : '') + a.webhookPath,
      recursos: { saldo: !!a.saldo, saques: !!a.saques, listar: !!a.listar },
      campos: a.campos.map(c => Object.assign({}, c, c.secreto
        ? { set: !!(cfg[c.key] || '').trim(), mask: mask(cfg[c.key]) }
        : { valor: cfg[c.key] || '' }))
    };
  });
}

/* ---------- rotas do painel ---------- */
function mount(app, auth, publicUrl) {
  app.get('/api/admin/gateways', auth, (_req, res) => res.json({ ativo: ativoId(), gateways: vista(publicUrl) }));

  app.post('/api/admin/gateways/ativar', auth, (req, res) => {
    const id = String((req.body || {}).id || '').toLowerCase();
    const a = porId(id);
    if (!a) return res.status(400).json({ error: 'Gateway desconhecido' });
    const cfg = settings.gatewayConfig(id);
    if (!a.pronto(cfg)) return res.status(400).json({ error: `${a.nome} ainda não tem as credenciais cadastradas. Salve a chave primeiro.` });
    settings.setGatewayAtivo(id);
    try { require('./admin').logEvent('gateway_trocado', { gateway: id }); } catch (_) {}
    console.log(`[gateways] ativo agora: ${a.nome}`);
    res.json({ ok: true, ativo: id, gateways: vista(publicUrl) });
  });

  app.post('/api/admin/gateways/:id/config', auth, (req, res) => {
    const a = porId(req.params.id);
    if (!a) return res.status(400).json({ error: 'Gateway desconhecido' });
    settings.saveGateway(a.id, req.body || {}, a.campos);
    res.json({ ok: true, gateways: vista(publicUrl) });
  });

  app.post('/api/admin/gateways/:id/testar', auth, async (req, res) => {
    const a = porId(req.params.id);
    if (!a) return res.status(400).json({ error: 'Gateway desconhecido' });
    const cfg = settings.gatewayConfig(a.id);
    if (!a.pronto(cfg)) return res.json({ ok: false, detalhe: 'sem credenciais cadastradas' });
    try { res.json(await a.testar(cfg)); }
    catch (e) { res.json({ ok: false, detalhe: e.message }); }
  });
}

module.exports = { ADAPTADORES, ORDEM, porId, ativo, ativoId, deVenda, vista, mount, normStatus, normalizar, http };
