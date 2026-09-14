# Integração com a API Nerva (PIX)

Documentação oficial: https://app.pixnerva.com.br/docs
Base URL: `https://pixnerva.com.br/api`

## Como funciona

A API Key vive **só no servidor**, em variável de ambiente. O navegador
nunca a vê — ele fala com este backend, que fala com a Nerva.

```
navegador  ->  POST /api/pix/create        ->  Nerva POST /sales
navegador  ->  GET  /api/pix/status/:id    ->  Nerva GET  /sales/:id
Nerva      ->  POST /webhooks/nerva            (HMAC verificado)
painel     ->  GET  /api/admin/nerva/saldo  ->  Nerva GET  /withdrawals/balance
painel     ->  GET  /api/admin/nerva/saques ->  Nerva GET  /withdrawals/my-withdrawals
painel     ->  POST /api/admin/nerva/saques ->  Nerva POST /withdrawals
```

## Configuração

Rode o diagnóstico — ele cria o `.env`, confere cada variável e testa a
conexão real com a API:

```bash
cd nerva
node configurar.js
```

Ele aponta exatamente o que falta: chave não preenchida, `PUBLIC_URL`
em http ou localhost, token do painel fraco, `.env` fora do
`.gitignore`, chave recusada pela API. Quando tudo passa, mostra seu
saldo — prova de que a chave está funcionando.


No `.env` (copie de `.env.example`):

| Variável | Onde pegar |
|---|---|
| `NERVA_API_KEY` | painel Nerva → Integrações → API Keys (`sk_live_...`) |
| `NERVA_WEBHOOK_SECRET` | painel Nerva → Webhooks (signing secret) |
| `PUBLIC_URL` | URL **https** pública deste servidor |
| `ADMIN_TOKEN` | senha forte, protege o painel e as rotas de saque |

O `PUBLIC_URL` vira o `postbackUrl` de cada cobrança. A Naerva só aceita
`https://` — IPs privados e localhost são bloqueados. Em desenvolvimento,
use um túnel (ngrok, cloudflared) ou deixe vazio e cadastre a URL de
webhook direto no painel.

## Decisões da implementação

**Idempotência por pedido, não por navegador.** A chave é um hash de
CPF + valor + descrição, válida por 30 minutos enquanto a cobrança
estiver pendente. Clique repetido devolve o mesmo PIX; carrinho alterado
gera cobrança nova com o valor certo. Se a cobrança reaproveitada já foi
paga ou expirou, emite outra — o comprador nunca recebe um QR morto.

**Assinatura do webhook usa o corpo bruto.** A documentação sugere
`JSON.stringify(req.body)`, mas isso reserializa o JSON e pode diferir
byte a byte do que foi assinado (ordem de chaves, espaços, unicode).
Aqui o `express.json({ verify })` guarda o `rawBody` e o HMAC é
calculado sobre ele. Também há proteção de replay: rejeita timestamp
com mais de 5 minutos.

**Estorno marca a venda.** `sale.refunded` e `sale.med_accepted` mudam o
status para `refunded`. Sem isso, uma venda estornada seguiria contando
como paga no painel e inflaria o faturamento.

**Saldo convertido de centavos.** A Nerva devolve `available` e
`withheld` em centavos. As rotas do painel entregam em reais, com o
valor bruto junto em `bruto`, para não haver erro de escala de 100x.

**Saque valida antes de chamar a API:** mínimo de R$ 1,00, `pixKeyType`
entre cpf/cnpj/email/phone/random (normalizado para minúsculo) e chave
obrigatória. Manda `idempotency-key` para duplo clique não virar dois
saques.

**Tracking server-side é opcional.** O objeto `tracking` só é enviado à
Nerva se `NERVA_SEND_TRACKING=1`. Este projeto tem rastreamento próprio
em `tracking.js`; ligar os dois dispararia um segundo evento de compra.

## Taxas

`fee = (valor × 6,99%) + R$ 1,99` — R$ 100,00 rende R$ 91,02 líquidos.
5% do líquido fica retido por 30 dias.

## Conformidade com a documentação

`conformidade-nerva.py` confere a implementação contra cada item dos
docs — autenticação, campos do `POST /sales`, idempotência, tracking,
consulta, saldo, saques, webhook, eventos e erros. 60 checagens.

```bash
python3 conformidade-nerva.py
```

## Limites da API

| | |
|---|---|
| Valor por cobrança | R$ 1,00 a R$ 10.000,00 |
| Expiração do Pix | 300 a 86.400 segundos (padrão 24 h) |
| Taxa | 6,99% + R$ 1,99 por venda |
| Retenção | 5% do líquido, liberado em 30 dias |
| Saque mínimo | R$ 1,00 |

Os dois limites de valor são validados **antes** de chamar a API, para o
comprador ver uma mensagem que entende em vez de "erro ao gerar o Pix".

## Teste

`teste_nerva.js` sobe o servidor contra uma API Nerva simulada e cobre
criação de cobrança, validação de CPF, consulta de status, webhook
(assinatura válida, inválida e replay), estorno, saldo e saque.

```bash
npm install          # precisa do express de verdade
node teste_nerva.js  # 23 checagens
```
