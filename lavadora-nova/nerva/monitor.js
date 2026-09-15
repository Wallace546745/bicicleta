/* ============================================================
   monitor.js — camada de monitoramento da operação.

   Estende o admin.js sem alterá-lo: reaproveita as sessões, as
   vendas e os eventos que já existem, e acrescenta o que faltava
   para o painel:

     • jornada por visitante (timeline)
     • funil com taxa de conversão e período
     • ranking de produtos
     • estatísticas dos eventos do TikTok
     • tempo real por SSE (Server-Sent Events)

   Nada aqui inventa número: tudo sai de sessions, salesDb e da
   fila do tracking.js.
   ============================================================ */
'use strict';
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const JORNADA_DB = path.join(DATA_DIR, 'jornadas.json');

try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (_) {}
const ler = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (_) { return fb; } };

/* jornadas: sid -> { sid, first, last, passos: [{ t, etapa, extra }], ... }
   Mantidas em memória e gravadas em disco a cada 3s (mesma estratégia do
   admin.js). Só as últimas 500 sessões — o painel é operacional, não é
   arquivo histórico. */
let jornadas = ler(JORNADA_DB, {});
let sujo = false;
const persistir = () => { sujo = true; };
setInterval(() => {
  if (!sujo) return;
  sujo = false;
  try { fs.writeFileSync(JORNADA_DB, JSON.stringify(jornadas)); }
  catch (e) { console.error('[monitor] persist:', e.message); }
}, 3000);

const LIMITE_JORNADAS = 500;
function podar() {
  const ids = Object.keys(jornadas);
  if (ids.length <= LIMITE_JORNADAS) return;
  ids.sort((a, b) => (jornadas[a].last || 0) - (jornadas[b].last || 0))
     .slice(0, ids.length - LIMITE_JORNADAS)
     .forEach(id => { delete jornadas[id]; });
}

/* ---------------- SSE: tempo real ---------------- */
const inscritos = new Set();

function emitir(tipo, dados) {
  const linha = `event: ${tipo}\ndata: ${JSON.stringify(dados || {})}\n\n`;
  inscritos.forEach(res => { try { res.write(linha); } catch (_) { inscritos.delete(res); } });
}

/* ---------------- registro da jornada ---------------- */
function passo(sid, etapa, extra) {
  if (!sid) return;
  const agora = Date.now();
  let j = jornadas[sid];
  if (!j) {
    j = jornadas[sid] = { sid, first: agora, last: agora, passos: [] };
    podar();
  }
  j.last = agora;
  const ultimo = j.passos[j.passos.length - 1];
  // etapa repetida em sequência não vira passo novo (o heartbeat repete a cada 15s)
  if (ultimo && ultimo.etapa === etapa && !extra) { persistir(); return; }
  j.passos.push(Object.assign({ t: agora, etapa }, extra || {}));
  if (j.passos.length > 60) j.passos = j.passos.slice(-60);
  persistir();
  emitir('passo', { sid, etapa, t: agora });
}

/* dados do visitante que só aparecem depois (geo, utm, device) */
function enriquecer(sid, dados) {
  if (!sid) return;
  const j = jornadas[sid] || (jornadas[sid] = { sid, first: Date.now(), last: Date.now(), passos: [] });
  Object.assign(j, dados || {});
  persistir();
}

/* ---------------- períodos ---------------- */
const MS_DIA = 24 * 3600e3;
function intervalo(q) {
  const agora = Date.now();
  const r = String((q && q.range) || 'hoje');
  // dia começa às 00:00 no fuso de São Paulo
  const inicioDoDia = ts => {
    const d = new Date(ts - 3 * 3600e3);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime() + 3 * 3600e3;
  };
  if (r === 'personalizado' && q.de && q.ate) {
    const de = Date.parse(q.de), ate = Date.parse(q.ate);
    if (Number.isFinite(de) && Number.isFinite(ate)) return { de, ate: ate + MS_DIA, rotulo: 'Personalizado' };
  }
  if (r === 'ontem')  return { de: inicioDoDia(agora) - MS_DIA, ate: inicioDoDia(agora), rotulo: 'Ontem' };
  if (r === '7d')     return { de: agora - 7 * MS_DIA,  ate: agora, rotulo: 'Últimos 7 dias' };
  if (r === '30d')    return { de: agora - 30 * MS_DIA, ate: agora, rotulo: 'Últimos 30 dias' };
  if (r === 'tudo')   return { de: 0, ate: agora, rotulo: 'Todo o período' };
  return { de: inicioDoDia(agora), ate: agora, rotulo: 'Hoje' };
}

/* ---------------- funil ---------------- */
const ETAPAS_PRODUTO  = new Set(['page_view']);
const ETAPAS_CHECKOUT = new Set(['carrinho', 'order_bump', 'seguro', 'checkout_addr',
                                 'checkout_dados', 'checkout_pgto', 'checkout_review']);

function funil(api, per) {
  const { sessions, salesDb } = api;
  const dentro = t => t >= per.de && t <= per.ate;

  // visitantes e etapas vêm das jornadas (têm carimbo de tempo por passo)
  let visitantes = 0, viuProduto = 0, iniciouCheckout = 0;
  Object.values(jornadas).forEach(j => {
    if (!dentro(j.first)) return;
    visitantes++;
    const etapas = new Set(j.passos.map(p => p.etapa));
    if ([...etapas].some(e => ETAPAS_PRODUTO.has(e)))  viuProduto++;
    if ([...etapas].some(e => ETAPAS_CHECKOUT.has(e))) iniciouCheckout++;
  });

  // Pix vem das vendas reais, não da navegação
  const vendas = Object.values(salesDb || {}).filter(v => dentro(Date.parse(v.createdAt) || 0));
  const pixGerado = vendas.length;
  const pagas = vendas.filter(v => String(v.status).toLowerCase() === 'paid');
  const pixPago = pagas.length;

  const taxa = (a, b) => (b > 0 ? +(a / b * 100).toFixed(1) : 0);
  const passos = [
    { chave: 'visitantes',  rotulo: 'Visitantes',          n: visitantes },
    { chave: 'produto',     rotulo: 'Viram o produto',     n: viuProduto },
    { chave: 'checkout',    rotulo: 'Iniciaram checkout',  n: iniciouCheckout },
    { chave: 'pix_gerado',  rotulo: 'Geraram Pix',         n: pixGerado },
    { chave: 'pix_pago',    rotulo: 'Pix pago',            n: pixPago }
  ];
  passos.forEach((p, i) => {
    p.doTopo   = taxa(p.n, passos[0].n);
    p.doAnterior = i === 0 ? 100 : taxa(p.n, passos[i - 1].n);
  });

  const faturamento = pagas.reduce((s, v) => s + Number(v.amount || 0), 0);
  return {
    periodo: per.rotulo, de: per.de, ate: per.ate,
    passos,
    resumo: {
      faturamento,
      ticketMedio: pixPago ? +(faturamento / pixPago).toFixed(2) : 0,
      taxaAprovacao: taxa(pixPago, pixGerado),
      pixPendente:  vendas.filter(v => String(v.status).toLowerCase() === 'pending').length,
      pixExpirado:  vendas.filter(v => ['expired', 'failed'].includes(String(v.status).toLowerCase())).length,
      valorGerado:  vendas.reduce((s, v) => s + Number(v.amount || 0), 0)
    }
  };
}

/* ---------------- ranking de produtos ---------------- */
function produtos(api, per) {
  const dentro = t => t >= per.de && t <= per.ate;
  const mapa = new Map();
  Object.values(api.salesDb || {}).forEach(v => {
    if (!dentro(Date.parse(v.createdAt) || 0)) return;
    const nome = (v.description || 'Sem descrição').trim();
    const p = mapa.get(nome) || { produto: nome, pixGerado: 0, vendas: 0, faturamento: 0 };
    p.pixGerado++;
    if (String(v.status).toLowerCase() === 'paid') { p.vendas++; p.faturamento += Number(v.amount || 0); }
    mapa.set(nome, p);
  });
  return [...mapa.values()].map(p => Object.assign(p, {
    ticketMedio: p.vendas ? +(p.faturamento / p.vendas).toFixed(2) : 0,
    taxaAprovacao: p.pixGerado ? +(p.vendas / p.pixGerado * 100).toFixed(1) : 0
  })).sort((a, b) => b.faturamento - a.faturamento || b.vendas - a.vendas);
}

/* ---------------- eventos do TikTok ---------------- */
function tiktok(api, per) {
  const st = (api.tracking && api.tracking.estatisticas) ? api.tracking.estatisticas() : null;
  if (!st) return { ligado: false, motivo: 'tracking.js indisponível', eventos: [], compra: null };

  const linhas = new Map();
  const linha = ev => {
    if (!linhas.has(ev)) linhas.set(ev, { evento: ev, pixel: 0, servidor: 0, erro: 0, pendente: 0 });
    return linhas.get(ev);
  };
  // pixel do navegador x Events API — o counters ja separa os dois
  Object.entries(st.porEvento).forEach(([ev, c]) => {
    const l = linha(ev);
    l.pixel = c.pixel || 0;
    l.servidor = c.servidor || 0;
  });
  // fila: tries > 0 significa que ja falhou pelo menos uma vez
  st.fila.forEach(q => {
    const l = linha(q.event);
    if (q.tries > 0) l.erro++; else l.pendente++;
    if (q.atrasadoMin > 10) l.atrasoMin = Math.max(l.atrasoMin || 0, q.atrasadoMin);
  });

  const lista = [...linhas.values()]
    .map(l => Object.assign(l, {
      // divergencia grande entre pixel e servidor costuma ser bloqueador
      // de anuncio no navegador ou token da Events API sem permissao
      paridade: (l.pixel + l.servidor) ? Math.round(Math.min(l.pixel, l.servidor) / Math.max(l.pixel, l.servidor, 1) * 100) : 0
    }))
    .sort((a, b) => (b.pixel + b.servidor) - (a.pixel + a.servidor));

  const compra = lista.find(l => l.evento === 'Purchase') || lista.find(l => l.evento === 'CompletePayment') || null;
  return {
    ligado: st.ligado, motivo: st.motivo,
    eventos: lista,
    compra,
    // resposta direta a "o Purchase esta disparando?"
    compraOk: !!(compra && (compra.pixel > 0 || compra.servidor > 0)),
    filaPresa: st.fila.filter(q => q.atrasadoMin > 10).length
  };
}

/* ---------------- visitante ---------------- */
function visitante(api, sid) {
  const j = jornadas[sid];
  if (!j) return null;
  const s = api.sessions.get(sid) || {};
  const vendas = Object.values(api.salesDb || {}).filter(v => v.sid === sid);
  return {
    sid,
    primeiroAcesso: j.first, ultimoSinal: j.last,
    online: !!(s.last && Date.now() - s.last < 30000),
    device: j.device || s.device || '', ua: s.ua || '',
    pais: j.pais || '', estado: j.estado || '', cidade: j.cidade || '',
    origem: j.origem || (s.utm && s.utm.utmSource) || '', ref: s.ref || '',
    utm: Object.assign({}, s.utm, j.utm),
    ttclid: j.ttclid || '',
    landing: j.landing || '',
    passos: j.passos,
    vendas: vendas.map(v => ({ id: v.id, status: v.status, amount: v.amount, createdAt: v.createdAt, paidAt: v.paidAt }))
  };
}

function listaVisitantes(api, per, filtros = {}) {
  const dentro = t => t >= per.de && t <= per.ate;
  const f = (v, campo) => !filtros[campo] || String(v || '').toLowerCase().includes(String(filtros[campo]).toLowerCase());
  return Object.values(jornadas)
    .filter(j => dentro(j.first))
    .filter(j => f(j.cidade, 'cidade') && f(j.estado, 'estado') && f(j.device, 'device')
              && f((j.utm && j.utm.utmSource) || j.origem, 'origem'))
    .sort((a, b) => b.last - a.last)
    .slice(0, 200)
    .map(j => {
      const s = api.sessions.get(j.sid) || {};
      return {
        sid: j.sid, first: j.first, last: j.last,
        online: !!(s.last && Date.now() - s.last < 30000),
        etapa: (j.passos[j.passos.length - 1] || {}).etapa || '',
        passos: j.passos.length,
        cidade: j.cidade || '', estado: j.estado || '', pais: j.pais || '',
        device: j.device || s.device || '',
        origem: j.origem || (s.utm && s.utm.utmSource) || '',
        ttclid: j.ttclid ? j.ttclid.slice(0, 12) + '…' : ''
      };
    });
}

/* ---------------- rotas ---------------- */
function mount(app, auth, api) {
  const comPeriodo = fn => (req, res) => {
    try { res.json(fn(api, intervalo(req.query), req.query)); }
    catch (e) { console.error('[monitor]', e.message); res.status(500).json({ error: e.message }); }
  };

  app.get('/api/admin/monitor/funil',     auth, comPeriodo(funil));
  app.get('/api/admin/monitor/produtos',  auth, comPeriodo((a, p) => ({ periodo: p.rotulo, lista: produtos(a, p) })));
  app.get('/api/admin/monitor/tiktok',    auth, comPeriodo(tiktok));
  app.get('/api/admin/monitor/visitantes', auth, comPeriodo((a, p, q) => ({ lista: listaVisitantes(a, p, q) })));

  app.get('/api/admin/monitor/visitante/:sid', auth, (req, res) => {
    const v = visitante(api, req.params.sid);
    if (!v) return res.status(404).json({ error: 'Visitante não encontrado' });
    res.json(v);
  });

  /* SSE: o navegador abre uma conexão e o servidor empurra os eventos.
     Escolhido em vez de WebSocket porque o tráfego é só de ida (servidor
     -> painel), atravessa proxy e CDN sem configuração extra e reconecta
     sozinho no navegador. */
  app.get('/api/admin/monitor/stream', auth, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'          // nginx não pode bufferizar SSE
    });
    res.write('retry: 3000\n\n');
    inscritos.add(res);

    const agora = () => {
      try { res.write(`event: online\ndata: ${JSON.stringify(api.online())}\n\n`); } catch (_) {}
    };
    agora();
    const t1 = setInterval(agora, 4000);                       // presença (rede de segurança; a mudança é empurrada na hora)
    const t2 = setInterval(() => { try { res.write(': ping\n\n'); } catch (_) {} }, 25000);  // mantém viva

    req.on('close', () => { clearInterval(t1); clearInterval(t2); inscritos.delete(res); });
  });

  app.get('/api/admin/monitor', auth, (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(__dirname, 'monitor.html'));
  });
}

module.exports = { mount, passo, enriquecer, emitir, jornadas, intervalo };
