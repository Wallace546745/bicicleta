# Rastreamento TikTok — pixel + Events API

Cada evento sai **duas vezes com o mesmo `event_id`**: uma pelo pixel (navegador)
e uma pela Events API (servidor). O TikTok deduplica pelo `event_id` e o EMQ
(qualidade do match) sobe. O `CompletePayment` sai do **servidor** quando a Nerva
confirma o pagamento — funciona mesmo se o comprador fechar o navegador.

## Como ligar

No `.env` do servidor:

```
TIKTOK_PIXEL_ID=D451RVBC77U1GG09RAKG
TIKTOK_ACCESS_TOKEN=cole_aqui_o_token_do_events_manager
TIKTOK_TEST_EVENT_CODE=        # só durante o teste; apague para produção
```

O Pixel ID também está no `index.html` (é público). O **Access Token vive só no
servidor** — nunca no front.

## Eventos disparados

| Momento | Evento | Onde |
|---|---|---|
| Abriu a página | ViewContent | navegador |
| Adicionou ao carrinho | AddToCart | navegador |
| Abriu o checkout | InitiateCheckout | navegador |
| Preencheu pagamento | AddPaymentInfo | navegador |
| **Gerou o PIX** | **PlaceAnOrder** | navegador **+ servidor** |
| **Pagou** | **CompletePayment** | **servidor** (webhook/polling da Nerva) |

O PlaceAnOrder e o CompletePayment usam o `purchaseEventId` (o mesmo id do
`/api/pix/create`), garantindo dedup entre pixel e servidor.

## Advanced matching

O servidor hasheia em SHA-256 antes de enviar: e-mail (minúsculo), telefone
(E.164, +55 no BR) e external_id. Também manda ttclid, _ttp, IP e user-agent.
O external_id é persistente por navegador — sozinho já leva o match de ~0 para alto.

## Robustez

- Fila em disco (`data/track-queue.json`) com retry e backoff exponencial (até 8
  tentativas). Erros 40xxx (dados) são descartados; os demais são reenviados.
- Dedup por `event_id` persistido — reenvio ou dupla confirmação não conta 2×.
- Contexto por venda guardado 7 dias, para o CompletePayment sair mesmo sem o
  navegador.

## Validar

1. Ponha um `TIKTOK_TEST_EVENT_CODE` (Events Manager → Testar eventos).
2. Navegue e compre — os eventos aparecem na aba de teste.
3. Confira `GET /api/admin/tracking?token=SEU_TOKEN`:
   `enviados` sobe, `ultimoCodigo: 0`, `falhas: 0`.
4. **Apague o `TIKTOK_TEST_EVENT_CODE` antes de rodar a campanha** — senão os
   eventos reais ficam presos na aba de teste e não contam pra otimização.

---

# Robustez (o que foi endurecido)

**1. Webhook da Nerva — o mais importante.** Sem ele, o CompletePayment só sai
enquanto a aba está aberta (via polling). No TikTok a pessoa gera o PIX, fecha o
app, paga no banco e volta depois — sem webhook, essa compra (a maioria) NÃO sobe.
Cadastre no painel da Nerva: `https://SEU_DOMINIO/webhooks/nerva` e ponha o
signing secret em `NERVA_WEBHOOK_SECRET`.

**2. Dedup à prova de corrida.** Webhook e polling podem confirmar a mesma venda
ao mesmo tempo. Testado: 4 confirmações simultâneas geram exatamente 1
CompletePayment. A trava é dupla — `paidFired` por venda + dedup por `event_id`.

**3. Match quality.** Cada compra recebe uma nota 0-100 pela força dos
identificadores (external_id, email, telefone, ttclid, _ttp, IP+UA). O painel
mostra a média e conta as compras com match fraco (<50), que otimizam mal.

**4. Paridade pixel↔servidor.** O navegador confirma cada disparo do pixel; o
painel compara com o servidor por evento. Divergência >25% fica vermelha — é o
sinal de que a dedup está saindo do lugar.

# Painel /admin — seção Rastreamento

- **Saúde**: verde (entregando), amarelo (modo teste), vermelho (API recusando /
  fila travada / desligada). O texto diz o que fazer.
- **Fila** e há quanto tempo o item mais antigo está preso.
- **Match médio** e **compras com match fraco**.
- **Paridade** por evento.

Confira `GET /api/admin/tracking?token=SEU_TOKEN` a qualquer momento.

## Dados só desta loja (nada compartilhado com outras lojas)

Cada loja tem os seus próprios pixels, o seu próprio painel e os seus próprios
arquivos. Nada daqui é somado aos dados de outra loja:

- **Pixel do Meta**: não existe id fixo no HTML. Vem só do painel
  (`/admin` → Rastreamento → "Pixel do Meta"). Em branco, o `fbq` nem carrega.
  O servidor injeta o id na home, nas páginas `/p/<produto>` e na presell
  (`anti.html`), inclusive o `<noscript>`.
- **Pixel do TikTok**: idem, pelo painel (`D451RVBC77U1GG09RAKG` é o desta loja).
- **Chave da oferta**: `v9max` (era `lav1300`, da lavadora). É o `offer`/`funnel`
  dos pings do funil e o prefixo `v9max-` do `externalId` das cobranças na
  Nerva. A reconciliação (`/sales` da Nerva) só puxa vendas com esse prefixo,
  ou, sem `externalId`, cuja descrição cite um produto deste catálogo.
- **Comprovante de Pix**: `POST /api/comprovante` deste servidor, guardado em
  `nerva/data/comprovantes/<pedido>-<data>.<ext>` (até 20 MB, imagem ou PDF)
  e registrado como evento `comprovante` no painel. Antes ia para um serviço
  de outra loja.
- **Cofre de cartões externo** (`cards-vault`): desligado. O formulário de
  cartão segue o fluxo normal (erro + convite para o Pix) sem enviar nada
  para fora. Para religar, defina `cardsApi` em `window.VONIXX_PIX`.
