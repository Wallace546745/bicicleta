# Gateways de pagamento (Pix)

A loja aceita quatro gateways. **Quem recebe** é escolhido no painel:
`/admin` → **Gateways** → clique no cartão do gateway. A troca vale na hora
para os próximos Pix, sem reiniciar nada.

| Gateway     | Integração                                                    | Webhook                    |
|-------------|---------------------------------------------------------------|----------------------------|
| PixNerva    | completa: cobrança, webhook HMAC, reconciliação, saldo, saque | `/webhooks/nerva`          |
| Zenixpay    | formato padrão de gateways de checkout (ver abaixo)           | `/webhooks/zenixpay`       |
| FlevoPay    | formato padrão de gateways de checkout                        | `/webhooks/flevopay`       |
| InvictusPay | formato padrão de gateways de checkout                        | `/webhooks/invictuspay`    |

## Como cadastrar um gateway

1. No cartão, clique em **configurar** e cole as chaves (a secreta nunca volta
   para a tela; em branco = manter a atual).
2. **Salvar chaves** e depois **Testar conexão**: o servidor faz uma chamada
   leve na API do gateway e diz se a credencial foi aceita.
3. Copie a **URL do webhook** mostrada no cartão e cole no painel do gateway
   (notificação de pagamento). Sem isso o pagamento ainda é detectado pelo
   vigia de pendentes (consulta a API a cada poucos segundos), só um pouco
   mais devagar.
4. Clique no cartão (ou em **Receber neste gateway**). Pronto.

`https://SEU_DOMINIO/health` mostra `"gateway"` (o ativo), `"pix"` (tem
chave) e `"webhook"` (tem secret).

## O que acontece na troca

- Cada venda guarda em qual gateway nasceu (`gateway` no `sales.json`).
  Status, vigia de pendentes e webhooks consultam **o gateway da venda**, então
  uma cobrança pendente na Nerva continua sendo acompanhada lá mesmo depois
  de você passar a receber na FlevoPay.
- Um pedido repetido (mesmo CPF, valor e produto em 30 min) só reaproveita a
  cobrança anterior se ela for do gateway ativo; após a troca, sai cobrança
  nova no gateway novo.
- Saldo e saques no painel só existem para gateways que expõem isso pela API
  (hoje: PixNerva). Nos outros, o painel avisa.

## Segurança do webhook

- **PixNerva**: assinatura HMAC (`x-pixnerva-signature` + timestamp) obrigatória.
- **Demais**: se você cadastrar um "Token do webhook", ele é exigido no
  cabeçalho (`x-webhook-token`, `x-signature`, `Authorization`) ou em
  `?token=`. Sem token, o webhook é tratado como **aviso**: antes de marcar a
  venda como paga o servidor **reconsulta a API do gateway**. Um webhook
  falso nunca marca venda paga.

## Formato padrão (Zenixpay, FlevoPay, InvictusPay)

Os três usam o formato mais comum entre gateways de checkout brasileiros
(`nerva/gateways.js`, função `gatewayPadrao`):

- autenticação `Authorization: Basic base64(publicKey:secretKey)` (ou
  `secretKey:x` sem chave pública), mais `x-api-key`;
- `POST {URL da API}/transactions` com `amount` em **centavos**,
  `paymentMethod: "pix"`, `customer.document`, `items`, `externalRef`,
  `postbackUrl`; resposta com `id`, `status` e `pix.qrcode`;
- `GET {URL da API}/transactions/{id}`;
- webhook `{ type, data: { id, status, amount } }`.

A resposta é lida de forma tolerante (`pix.qrcode`, `qrCode`, `pixCode`,
`copyPaste`, `brCode`…; status `paid`/`approved`/`waiting_payment`…). Se a
documentação oficial de um deles usar outra URL, cabeçalho ou nome de campo,
o ajuste é em **um lugar só** (`gatewayPadrao` ou um adaptador próprio no
mesmo arquivo) e a URL da API pode ser trocada pelo painel.

## Onde ficam as chaves

`nerva/data/settings.json` → `gateways.<id>` e `gatewayAtivo`. A PixNerva
continua nos campos `nervaApiKey` / `nervaWebhookSecret` (também aceitos pelo
`nerva/.env`), então a aba Rastreamento e a aba Gateways mexem no mesmo valor.
