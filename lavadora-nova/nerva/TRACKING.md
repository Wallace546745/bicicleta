# Rastreamento TikTok — pixel + Events API

Cada evento sai **duas vezes com o mesmo `event_id`**: uma pelo pixel (navegador)
e uma pela Events API (servidor). O TikTok deduplica pelo `event_id` e o EMQ
(qualidade do match) sobe. O `CompletePayment` sai do **servidor** quando a Nerva
confirma o pagamento — funciona mesmo se o comprador fechar o navegador.

## Como ligar

No `.env` do servidor:

```
TIKTOK_PIXEL_ID=DAJVT3RC77UES9752NLG
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
