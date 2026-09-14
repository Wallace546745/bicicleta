# Como copiar as imagens do seu anúncio

Não é possível baixar as imagens do Mercado Livre por meio automatizado —
o site bloqueia isso no `robots.txt`. Mas dá para pegar todas de uma vez.

## Jeito rápido: pelo console do navegador

1. Abra o seu anúncio no Chrome:
   https://produto.mercadolivre.com.br/MLB-5117688186-lavadora-de-alta-presso-lav1300-libras-vonder-1300lbf-_JM

2. **Clique em cada miniatura da galeria** antes de continuar. O Mercado
   Livre só carrega a imagem em alta quando você passa por ela.

3. Pressione `F12`, abra a aba **Console** e cole:

```js
copy([...new Set([...document.querySelectorAll('img')]
  .map(i => i.src)
  .filter(u => /http2\.mlstatic\.com\/D_/.test(u))
  .map(u => u.replace(/-[A-Z]{1,2}\.webp$/, '-F.webp'))
)].join('\n'));
console.log('URLs copiadas para a área de transferência');
```

4. As URLs vão para a área de transferência. Cole aqui no chat.

## Jeito manual

Botão direito em cada foto → **Copiar endereço da imagem**. Ou
**Salvar imagem como** e me enviar os arquivos — funciona igual.

## O que ainda falta no site

- **Galeria do produto**: hoje só a foto de capa, e ela vem do CDN do
  Mercado Livre. Se o CDN bloquear hotlink, cai no placeholder local.
- **Order bump** (`img/placeholder/ac1..ac3.svg`): kit bico turbo,
  mangueira de reposição e kit escova. São itens do funil, definidos por
  você — não existem como anúncio separado, então precisam de foto própria.

## Onde trocar depois

| O quê | Arquivo |
|---|---|
| Galeria do produto | `app.js` → `GAL_127V` · `nerva/content.js` → `fotos` |
| Order bump | `nerva/content.js` → `orderBump.itens[].img` · `index.html` |
| Brindes da oferta de saída | `nerva/content.js` → `ofertaSaida` · `app.js` → `GIFT_ITEM` / `BACK_FLIP` |

Depois de trocar, rode `node gerar-paginas.js`.
