# Rastreamento TikTok

Pixel ID: `DAJVT3RC77UES9752NLG` (definido em `TTK_CONFIG`, no `index.html`;
o painel `/admin` pode trocar sem mexer no código — o servidor injeta o ID
atual em `window.__PIXELS__`).

## Velocidade: o pixel sai antes do conteúdo

A base do pixel (Meta e TikTok), a detecção de canal e a ponte `TTK_CONFIG`
ficam no **`<head>`**, antes de todo o HTML. Antes ficavam no fim do `<body>`,
depois de ~170 KB de página: o `events.js` só começava a baixar quando a
página inteira já tinha descido. Um `<link rel="preconnect">` abre a conexão
com `analytics.tiktok.com` enquanto o HTML ainda está sendo lido.

A ordem na chegada é fixa, de propósito:

```
ttq.identify({ external_id, email?, phone_number? })   ← antes de tudo
ttq.page()                                             ← Pageview já com identidade
ttq.track('ViewContent', ...)                          ← imediato, sem esperar o app.js
```

O `ViewContent` disparava dentro do `app.js`, que é carregado **depois** do
fetch do `offer.json` — no 4G, 1 a 3 s depois da chegada. Agora sai do
`<head>`, junto com o Pageview. Para reportar o produto certo sem esperar o
`offer.json`, o servidor injeta `window.__TTK_PRODUTO__` (SKU, nome e preço
atuais — o preço editado no painel, ou o produto de `/p/<slug>`); as páginas
estáticas de `p/` já nascem com o `TTK_CONFIG` reescrito pelo
`gerar-paginas.js`. O `app.js` confere `window.__ttkViewContent` e não repete
o evento. Dentro do editor (`?editor`) o disparo imediato não acontece.

No servidor, um evento que entra na fila sai para a Events API em ~30 ms
(`teste_tracking.js` mede: ~70 ms do POST do navegador até o TikTok), em vez
de esperar o tick de 2 s — que continua existindo só para as retentativas.

## Eventos disparados

| Evento | Quando | Dados |
|---|---|---|
| `Pageview` | toda visita | — |
| `ViewContent` | abre a loja ou uma página `/p/` | contents, value, currency |
| `Search` | busca no topo | query |
| `AddToWishlist` | clica no coração | value |
| `AddToCart` | adiciona ao carrinho (página ou card) | contents, value, quantity |
| `InitiateCheckout` | sai do order bump para o checkout | contents, value |
| `Lead` (antes `SubmitForm`) | preenche o endereço | value, contents, description |
| `AddPaymentInfo` | conclui a etapa de pagamento | contents, value |
| `PlaceAnOrder` | Pix gerado | contents, value, order_id |
| `Purchase` (antes `CompletePayment`) | pagamento confirmado | contents, value, order_id |

`Search` vai sem `value` e sem `contents` de propósito: não é evento de
produto, e mandar valor nele inflaria o relatório de receita.

**Nomes de 2025.** O TikTok renomeou `CompletePayment` → `Purchase` e
`SubmitForm` → `Lead` (os antigos seguem aceitos e convertidos, mas pixel novo
deve usar os novos). `ClickButton` e `PlaceAnOrder` foram descontinuados, com
suporte até 2027: `ClickButton` foi removido daqui (não alimenta otimização);
`PlaceAnOrder` fica, porque "Pix gerado" e "Pix pago" são momentos
diferentes e o TikTok só recomenda `Purchase` sozinho quando são o mesmo.

## O valor acompanha o pedido

Do `InitiateCheckout` em diante, o `value` é o **total do pedido** —
produto + order bump + seguro + frete — e não o preço unitário. Num pedido
de R$ 112,71 com um bump, o TikTok recebia R$ 76,91 e aprendia um ticket
menor que o real.

```
ViewContent       R$  76,91   (só o produto)
InitiateCheckout  R$  96,81   (produto + bump escolhido)
Lead        R$ 112,71   (+ seguro)
AddPaymentInfo    R$ 112,71
PlaceAnOrder      R$ 112,71
Purchase   R$ 112,71
```

## Advanced matching

| Sinal | Pixel (navegador) | Events API (servidor) |
|---|---|---|
| `external_id` | `ttq.identify` no page load, id persistente por navegador | SHA-256 |
| e-mail | minúsculo, sem espaços, no `identify` ao preencher o formulário | SHA-256 |
| telefone | **E.164** (`+5511988887777`) no `identify` | SHA-256 do E.164 |
| `ttclid` | — | da URL do anúncio, guardado 90 dias (cookie + localStorage) |
| `_ttp` | cookie do próprio pixel | repassado |
| IP + user-agent | — | preenchidos pelo servidor |

O telefone **precisa** do `+55`: o pixel hasheia o texto exatamente como
chega, e só dígitos geram um hash que o TikTok nunca casa com a base dele — o
telefone contava zero no EMQ. A ponte normaliza antes de enviar (`e164()`),
inclusive o que já estava guardado de visitas anteriores.

## Itens por SKU no servidor

O navegador manda `ttkContents` (os mesmos `contents` do pixel) no
`/api/pix/create`. O servidor guarda no contexto da venda e usa no
`PlaceAnOrder` e no `Purchase` da Events API. Antes o evento do
servidor ia com um item genérico só, e não casava com o catálogo quando o
pedido tinha order bump ou mais de um produto.

`Search` e `ClickButton` também levam `query`/`description` na Events API —
igual ao pixel, para o evento deduplicado não perder o contexto. E o
`event_time` é o instante real do clique no navegador (a fila offline pode
reenviar um evento na visita seguinte); timestamp no futuro ou com mais de
7 dias é corrigido para "agora", que é o que o TikTok aceita.

## Auditoria contra a documentação do TikTok

Conferido item a item com as regras do Pixel, do Advanced Matching e da
Events API v1.3 (eventos padrão e parâmetros, hashing, dedup, `event_time`):

| Regra do TikTok | Situação |
|---|---|
| `event_id` no pixel (`ttq.track(ev, props, {event_id})`) e na API, iguais | ok |
| `event_time` em segundos (Unix), evento até 7 dias no passado, nunca no futuro | ok — o servidor corrige o que sair disso |
| `email` minúsculo e sem espaços, `phone` em E.164, `external_id` — todos SHA-256 na API | ok |
| `ttclid` da URL, `_ttp` do cookie, `ip` e `user_agent` reais | ok — `ip` agora lê `cf-connecting-ip`/`x-real-ip` atrás de proxy |
| `value` = total do pedido; `price` = preço **unitário** de cada item | **corrigido** — `price` era total ÷ quantidade (incluía bump, seguro e frete) |
| `content_id` = `sku_id` do catálogo; `content_type` = `product` | ok |
| `contents` com os itens reais em InitiateCheckout, Lead, AddPaymentInfo, PlaceAnOrder, Purchase | **corrigido** — os três primeiros iam só com o produto da página |
| `Purchase` do navegador com os itens do carrinho | **corrigido** — o carrinho era limpo antes de montar o evento; ia um item genérico com preço errado |
| `Search`/`ClickButton` sem `value`/`contents` (não são eventos de produto) | **corrigido no servidor** — o pixel já estava certo, a API recebia valor e inflava a receita |
| `identify` antes do `page`/`track` | ok |
| Lote com um evento inválido (código 4xxxx) | **corrigido** — o TikTok recusa o lote inteiro; agora cada evento é reenviado sozinho e só o inválido é descartado |
| `_ttp` presente no ViewContent server-side | **corrigido** — o cookie ainda não existia quando o ViewContent saía do `<head>`; o envio ao servidor espera até 2 s por ele |
| Presell (`anti.html`) no mesmo pixel e mesma pessoa | **corrigido** — usa o pixel novo, `identify` com o mesmo `external_id` da loja e manda a presença para este servidor (apontava para dois hosts antigos de outra oferta) |
| `limited_data_use` | não se aplica (só para CCPA/EUA) |

### Conferido contra a especificação oficial da Events API 2.0 (Web) e "About Parameters"

| Campo | Onde | Situação |
|---|---|---|
| `page.url` (obrigatório) | API | sempre presente; sem a URL da venda vai a URL da loja |
| `content_ids` (obrigatório para Video Shopping Ads) | pixel e API | lista dos SKUs do evento |
| `num_items` (API) / `quantity` (pixel) | ambos | total de itens |
| `search_string` (a API não aceita `query`) | pixel e API | pixel manda os dois nomes; API só `search_string` |
| `description` | ambos | nome do produto quando não houver outra |
| `customer_type` (`new`/`returning`) | ambos | `returning` depois da primeira compra paga neste navegador |
| `contents[].brand`, `contents[].content_category` | ambos | marca real de cada produto; sem marca conhecida, sem o campo |
| `user.locale` (BCP 47) | API | idioma do navegador, fallback `Accept-Language` |
| objeto `ad` (`utm_source/medium/campaign`, `campaign_id`, `ad_id`, `creative_id`) | API | dos parâmetros da URL do anúncio; macro não substituída é ignorada |
| `event_time` | API | segundos UTC; compra usa o `paidAt` da Nerva |
| lote ≤ 1000 e envio em tempo real | API | envio imediato, lote só para reenvio |

## Compra (Purchase): caminho e latência medida

```
Nerva confirma o Pix
  └─ webhook /webhooks/nerva ........ ~1 s depois (medido no servidor em produção)
       └─ firePaid → Events API ....... 6 ms (teste_tracking.js)
            └─ depois: push no celular, painel (SSE), sales.json
```

- O evento de compra sai **antes** de gravar em disco, notificar ou atualizar
  o painel, e sem esperar os 30 ms de junção de lote (`enqueue(..., {imediato})`).
- `event_time` é a hora em que a Nerva confirmou (`paidAt`), não a hora em que
  o servidor ficou sabendo — é o instante que o TikTok usa para atribuir.
- Sem webhook, o vigia detecta em até 3 s; o comprador com a aba aberta vê o
  pago em até 2 s e o pixel dispara com o mesmo `event_id` (deduplicado).

**Onde o TikTok mostra atraso, e não é do site:** o painel de eventos e o
Ads Manager processam com **até 2 horas** de defasagem. A aba **Testar
eventos** do Events Manager é em tempo real — é lá que se confere a chegada.

## Deduplicação, na prática

| Evento | event_id do navegador | event_id do servidor |
|---|---|---|
| `PlaceAnOrder` | `pao-<txid>` | `pao-<sale.id>` |
| `Purchase` | `purchaseEventId` da resposta | o mesmo `eventId` |

Os dois lados usam a mesma chave, então o TikTok reconhece um evento só.
Se o `purchaseEventId` não vier, o navegador **não** dispara — o evento do
servidor vira a fonte única, para a venda não contar duas vezes.

## Deduplicação com a Events API

Todo evento leva um `event_id`. O mesmo id é enviado pelo servidor
(`nerva/tracking.js`) na Events API. O TikTok reconhece os dois como um
só — a compra não conta em dobro quando o pixel do navegador e o
server-side disparam juntos.

`Purchase` e `PlaceAnOrder` também saem do servidor, então a venda
é registrada mesmo se o comprador fechar o navegador antes de pagar ou se
um bloqueador impedir o pixel.

## Recorte por canal

`TTK_CONFIG.somenteCanal` (padrão `false`):

- **false** — dispara sempre. O TikTok só atribui a venda quando encontra o
  `ttclid` ou o cookie da sessão, então evento de tráfego alheio não vira
  conversão falsa. Em troca, alimenta os públicos de remarketing e dá
  volume para o algoritmo aprender.
- **true** — só dispara no canal que trouxe a visita, conforme
  `window._CHANNEL`. Use se roda Meta e TikTok em paralelo e quer os
  relatórios estritamente separados.

`_CHANNEL` é detectado no `index.html`, nesta ordem: `?channel=tiktok` →
`ttclid` na URL → `utm_source` → click id guardado no localStorage → e, sem
nenhum sinal, assume `tiktok`, porque esta oferta roda no TikTok Ads e o
`ttclid` costuma se perder em navegador interno de app.

## Events API (server-side)

Opcional, mas recomendado. No `nerva/.env`:

```
TIKTOK_PIXEL_ID=DAJVT3RC77UES9752NLG
TIKTOK_ACCESS_TOKEN=cole_o_token_do_events_manager
TIKTOK_TEST_EVENT_CODE=   # só durante a validação; depois apague
```

Sem o token, só o pixel do navegador funciona — e o servidor avisa no log
ao subir.

**Não ligue** `NERVA_SEND_TRACKING=1`. Isso faria a Nerva disparar um
segundo `Purchase`, contando a compra duas vezes.

## Teste

| Arquivo | O que cobre |
|---|---|
| `teste_tiktok.py` | navegador real: pixel no `<head>`, identify → page → ViewContent sem o `app.js`, E.164, cada etapa do funil, páginas `/p/` com o SKU certo, recorte por canal |
| `teste_funil.py` | navegador real + servidor falso: do `?ttclid=` ao `Purchase`, mesmo `event_id` no pixel e no servidor, `ttkContents`, telefone E.164 ao servidor |
| `teste_tracking.js` | servidor + Events API falsa: produto injetado no HTML (home e `/p/`), latência de entrega, `event_time`, dedup, `PlaceAnOrder`/`Purchase` com itens, e-mail/telefone hasheados |
| `teste_nerva.js` | gateway Pix (cobrança, webhook, saldo, saque) |

```bash
pip install playwright && playwright install chromium   # uma vez
python3 teste_tiktok.py
python3 teste_funil.py
node teste_tracking.js
node teste_nerva.js
```

Os testes fixam `TIKTOK_ACCESS_TOKEN` vazio (ou apontam para uma API falsa):
nenhum deles manda evento ao pixel de verdade, mesmo com o `.env` preenchido.

## Depois de subir

1. Confira no Events Manager → **Testar eventos** com um
   `TIKTOK_TEST_EVENT_CODE` (ou pelo painel), navegue e compre.
2. Veja `GET /api/admin/tracking?token=SEU_TOKEN`: `saude: ok`, `fila: 0`.
3. **Apague o código de teste** antes de rodar a campanha.
4. Cadastre o webhook da Nerva (`https://SEU_DOMINIO/webhooks/nerva`): sem ele
   o `Purchase` só sai enquanto a aba está aberta.
