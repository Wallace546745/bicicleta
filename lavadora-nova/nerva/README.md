# Nerva — gateway único da oferta Ar-Condicionado Portátil Hisense

Adaptador entre o checkout (front estático) e a API da Nerva (`https://pixnerva.com.br/api`).

## Por que existe um backend

A doc da Nerva é explícita: **a API Key nunca pode ir para o frontend**. A chave
`sk_live_` cria cobranças, consulta saldo e **solicita saques** — exposta no
`app.js`, qualquer pessoa esvaziaria a conta. Por isso o front continua chamando
o mesmo contrato de antes e este servidor fala com a Nerva.

## Subir

```bash
cd nerva
npm install
cp .env.example .env    # preencha as chaves
npm start
```

Variáveis (`.env`):

| Variável | Onde pegar |
|---|---|
| `NERVA_API_KEY` | Painel Nerva → Integrações → API Keys |
| `NERVA_WEBHOOK_SECRET` | Painel Nerva → Webhooks (signing secret) |
| `PUBLIC_URL` | URL https pública deste servidor |
| `ALLOWED_ORIGIN` | Domínio da loja (CORS) |

Depois, no `index.html`, aponte `window.VONIXX_PIX.api` para a `PUBLIC_URL`.

## Rotas

| Rota | Faz |
|---|---|
| `POST /api/pix/create` | → Nerva `POST /sales`. Devolve `txid`, `qrCode`, `base64QrCode`, `purchaseEventId` |
| `GET /api/pix/status/:id` | → Nerva `GET /sales/:id`. Status em MAIÚSCULO (`PAID`) |
| `POST /webhooks/nerva` | Recebe `sale.paid` etc. com HMAC verificado |
| `GET /health` | Checagem |

## O que já está implementado

- **Idempotência** — `idempotency-key` = `externalId`. Retentativa após timeout
  não gera segunda cobrança (testado).
- **HMAC-SHA256** no webhook, sobre o corpo **cru**, com janela de 5 min contra
  replay. Assinatura forjada e timestamp velho retornam 401 (testado).
- **Tracking server-side** — UTMs, `fbclid`, `ttclid`, `fbp`, `fbc`, IP e
  User-Agent vão no objeto `tracking` do `POST /sales`, com `eventId` único para
  deduplicar pixel + CAPI. A Nerva dispara Meta CAPI / TikTok Events API quando a
  venda é paga.
- **MED passivo** — o handler apenas registra `sale.med_created`, não abre disputa.

## Taxas (medidas na conta real, não na doc)

A doc pública mostra `6,99% + R$ 1,99`, mas a conta está com taxa bem menor:
cobrança de R$ 1,00 → `fee` R$ 0,10 → `netAmount` R$ 0,90 (**10%**).
Confirme a taxa da sua conta no painel antes de calcular margem.

`withheld` retornou 0 no teste — a retenção de 5%/30 dias descrita na doc
aparentemente não está ativa nesta conta.

## Divergências entre a doc e a API real

Testado em produção em 03/09/2026:

1. **Valor mínimo**: a doc diz R$ 0,01; a API retorna
   `400 Valor mínimo da venda é R$ 1.00`. O adaptador já valida em R$ 1,00.
2. **Taxa**: doc `6,99% + R$ 1,99`; conta real cobrou 10% sem parcela fixa.

Como o produto principal está a R$ 67,43 e o combo a R$ 59,90, o mínimo de
R$ 1,00 não atrapalha — mas atrapalharia um order bump de centavos.

## Pendências antes de produção

1. `sales` está em memória (`Map`). Em produção use Redis/DB, senão o
   `purchaseEventId` se perde a cada restart.
2. Ative o **Webhook de Cashout** (URL própria, secret próprio) se for usar
   `POST /cashout`.
3. O `offer`/`funnel` `"jbl"` continua apontando para a config antiga do servidor
   de tracking — renomeie se for separar as ofertas.

## Colocar a chave no servidor (não no repositório)

Na VPS, dentro de `nerva/`:

```bash
cp .env.example .env
nano .env          # cole a NERVA_API_KEY e o NERVA_WEBHOOK_SECRET
echo ".env" >> .gitignore
```

Se o host tiver painel de variáveis de ambiente (Render, Railway, Coolify),
prefira cadastrar por lá — assim nem existe arquivo com segredo no disco.

Validação rápida de que a chave está ativa:

```bash
curl -s https://pixnerva.com.br/api/withdrawals/balance \
  -H "x-api-key: $NERVA_API_KEY"
```

---

# Painel admin

Acesse `https://SEU_DOMINIO/admin` e entre com o `ADMIN_TOKEN` do `.env`.
Atualiza sozinho a cada 5s.

## Como o painel é organizado

Duas zonas, separadas de propósito — o que muda a cada segundo não fica
misturado com o acumulado do período:

**Agora** — só tempo real: quantas pessoas na oferta, em qual tela cada uma
está, de qual campanha vieram e há quanto tempo. Responde "está entrando gente?".

**Resultado** — o dinheiro da janela escolhida (1h/24h/7d/hoje): recebido,
líquido, pagamentos, valor em aberto, conversão e ticket, mais o gráfico
hora a hora. Responde "está entrando dinheiro?".

**Onde o funil perde** — quantas sessões chegaram em cada etapa, quantas
saíram entre uma e outra, com a **maior perda em pessoas** destacada em
vermelho. Responde "onde conserto primeiro?".

**De onde vem** — receita paga por campanha, para cortar criativo ruim.

**Vendas** — a lista das últimas movimentações.

## O que mostra

**KPIs** — faturamento pago (bruto e líquido), PIX pagos/gerados, conversão
PIX, conversão visita→pago, valor aguardando pagamento e ticket médio.

**Onde as pessoas estão agora** — quantas sessões vivas em cada tela: página do
produto, carrinho, order bump, seguro, cada etapa do checkout, oferta de saída,
PIX gerado e pagou. É a resposta para "quantas pessoas em cada página".

**Funil** — de todas as sessões da janela, quantas alcançaram cada etapa e o %
em relação ao topo. É aqui que se vê onde o tráfego morre.

**Dispositivos online**, **receita por campanha** (UTM), **gráfico de 24h**
(gerados vs pagos por hora), **vendas recentes** e **lista de quem está online**
com origem e tempo de sessão.

Filtros de janela: 1h · 24h · 7d · Hoje.

## Como a presença funciona

O site pinga `POST /api/funnel/ping` a cada 20s com `sid` (sessionStorage),
`stage` e UTMs. Sessão conta como online se pingou nos últimos 45s. Ao trocar de
aba ou fechar, manda `bye` via `sendBeacon` e sai da contagem na hora.

Os estágios são marcados no `app.js` via `window.ttkPresence.etapa(...)` —
já ligados em: carrinho, order bump, seguro, cada passo do checkout,
oferta de saída, PIX gerado e pagamento confirmado.

## Origem dos dados de venda

- `POST /api/pix/create` grava a venda como `pending`
- Webhook `sale.paid` marca como paga (com HMAC verificado)
- O polling do checkout também confirma — rede de segurança se o webhook falhar

Gravado em `data/sales.json` (sobrevive a restart). Para volume alto, migre
para Postgres — o formato já está normalizado.

## Privacidade

CPF **não** é gravado no painel: o adaptador manda para a Nerva e descarta.
Só ficam nome, valor, status, UTMs e IDs de reconciliação.

## Checklist para rodar no TikTok Ads

1. `ADMIN_TOKEN` forte no `.env` (o painel expõe faturamento).
2. Publique o site com `?utm_source=tiktok&utm_campaign=NOME` nos links do anúncio
   — sem UTM o agrupamento por campanha fica em "(direto)".
3. Cadastre `https://SEU_DOMINIO/webhooks/nerva` no painel da Nerva.
4. Ponha o `/admin` atrás de HTTPS.

## Tempo real: da confirmação do Pix ao painel

Uma venda paga chega ao painel e ao celular por três caminhos, o que vier
primeiro. O `firePaid` deduplica, então cada venda notifica uma vez só.

| Caminho | Quando entra | Latência |
|---|---|---|
| **Webhook da Nerva** (`/webhooks/nerva`) | se `PUBLIC_URL` estiver cadastrado | imediata |
| **Vigia de pendentes** (`vigiarPendentes`, `server.js`) | sempre — o servidor consulta cada cobrança pendente na Nerva por conta própria: a cada 3 s nos primeiros 15 min, 30 s até 2 h, 5 min até expirar (24 h) | ≤ 3 s |
| Polling do comprador (`/api/pix/status`, a cada 2 s) | enquanto a aba está aberta; responde do registro local se já estiver pago | ≤ 2 s |
| Reconciliação (`reconcileFromNerva`) | a cada 2 min, para vendas que este servidor nunca viu (disco efêmero) | ≤ 2 min |

O painel (`admin.html`) fica ligado ao servidor por **SSE**
(`/api/admin/monitor/stream`): `pix` (cobrança gerada) e `venda` (pagamento
confirmado) recarregam a tela na hora, e `online` atualiza a presença. Os
polls de 5–20 s continuam só como rede de segurança se a conexão cair. A
notificação push (`push.js`) sai no mesmo instante do `firePaid`.

`teste_tracking.js` (seção 7) prova o vigia: cobrança criada, paga só na
Nerva falsa, e o `CompletePayment` + painel atualizados em menos de 1 s.
