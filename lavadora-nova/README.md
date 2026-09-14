# Loja — Ar Condicionado Portátil Hisense 12.000 Btus

Página de produto no layout do Mercado Livre, com checkout Pix próprio,
order bump, oferta de saída e painel administrativo.

**Produto:** Ar Condicionado Portátil Com Wi-fi Hisense 12.000 Btus Eletr (AP-12CWBRNPS01)

---

## Rodar

### Só o visual (sem checkout)

Qualquer servidor estático serve. No VS Code, botão direito no `index.html`
→ *Open with Live Server*.

Sem backend, as chamadas a `/api/...` falham e a loja usa o conteúdo embutido
no `index.html` — o visual fica idêntico. O Pix não gera cobrança e as
páginas `/p/<slug>` não abrem.

> Atenção: o `index.html` tem Meta Pixel e TikTok Pixel ativos. Testar assim
> gera eventos reais na conta de anúncios.

### Na VPS (produção)

Veja **[DEPLOY.md](DEPLOY.md)**: um comando instala Node, Nginx, HTTPS e o
serviço que mantém a loja no ar (`deploy/install-vps.sh`).

### Completo (checkout + painel)

```bash
cd nerva
npm install
cp .env.example .env      # preencha as credenciais
node server.js
```

| Rota            | O que é                                    |
|-----------------|--------------------------------------------|
| `/`             | a loja                                      |
| `/p/<slug>`     | páginas dos produtos relacionados           |
| `/admin`        | painel de vendas (Nerva)                    |
| `/admin/editor` | editor de conteúdo da oferta                |

Ambos os painéis pedem o `ADMIN_TOKEN` do `.env`.

---

## Estrutura

```
index.html            loja (HTML + conteúdo padrão embutido)
styles.css            estilos
app.js                galeria, carrosséis, carrinho, checkout, tracking
editor-mode.js        modo de edição visual (carregado só com ?editor)
anti.html             página de pré-venda

img/produto/          fotos do produto (7) — servidas localmente
img/placeholder/      SVGs cinza dos cards sem foto própria
img/meli/ img/pay/    selos e bandeiras

baixar-imagens.ps1    baixa as fotos que faltam e aponta para local (Windows)
baixar-imagens.sh     idem (macOS/Linux)

nerva/
  server.js           gateway Pix, webhooks, reconciliação de vendas
  content.js          conteúdo da oferta -> /api/offer.json
  pages.js            catálogo das páginas /p/<slug>
  tracking.js         eventos server-side
  admin.html/.js      painel de vendas
  editor.html         editor de conteúdo
  settings.js geo.js push.js ads.js
```

---

## Editar conteúdo

Preços, textos, fotos, opiniões e relacionados saem de `nerva/content.js`
(o `DEFAULT`) e podem ser alterados sem tocar em código pelo `/admin/editor`.
O que é salvo vai para `nerva/data/offer.json`, que sobrescreve o conteúdo
embutido no `index.html`.

Se mudar preços, mexa também em `preco.parcelaValor` — o parcelado tem preço
próprio e não é calculado a partir do valor à vista.

---

## Páginas dos produtos relacionados

Cada produto relacionado tem página própria em `p/<slug>/`, usando o mesmo
`index.html` da loja — mesmo layout, CSS, JS e responsividade — com o
conteúdo daquele produto já embutido. Funciona em qualquer host estático,
sem backend.

Depois de mudar preço, foto ou texto de um relacionado, regere:

```bash
node gerar-paginas.js
```

O script lê `nerva/pages.js` e reescreve as 7 pastas em `p/`.

Rotas:

```
/                                  produto principal
/p/capa-protecao/
/p/climatizador-ventisol-16l/
/p/micro-ventilador-ventisol/
/p/kit-higienizador-air-shield/
/p/tomada-inteligente-neo-avant/
/p/echo-dot-5/
/p/fire-tv-stick-4k-select/
```

Com o backend Node rodando, essas mesmas rotas são servidas dinamicamente
por `nerva/pages.js` e as pastas estáticas ficam como reserva.

**Oferta de saída:** a armadilha do botão "voltar" roda só na página
principal. Nas páginas de produto o voltar funciona normalmente — prender
o visitante ali quebraria a navegação entre produtos em vez de recuperar
uma venda.

---

## Nunca commitar

O `.gitignore` já bloqueia, mas vale saber o que está em jogo:

- `nerva/.env` — chave da Nerva, secret do webhook, token do admin, token do TikTok
- `nerva/data/` — **dados de clientes**: nome, CPF, e-mail, telefone, endereço, pedidos

Se algum deles for commitado por engano, não basta apagar no commit seguinte:
gire as credenciais e reescreva o histórico.

---

## Pendências

- 8 fotos de comentários ainda vêm do CDN — rode `baixar-imagens` para trazê-las
- Cards de relacionados (Haier, Midea, LG, TCL, Electrolux) usam placeholder;
  veja `img/placeholder/LEIA-ME.txt` para trocar
