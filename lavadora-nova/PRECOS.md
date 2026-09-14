# Como alterar preços

Todos os preços saem de **um arquivo só**: `precos.js`, na raiz do projeto.

```bash
# 1. abra e edite a tabela no topo
nano precos.js

# 2. aplique
node precos.js
```

Ele atualiza os quatro arquivos onde os preços aparecem — `index.html`,
`app.js`, `nerva/content.js` e `nerva/pages.js` — e regenera as 13
páginas de produto. São 56 substituições.

## A tabela

```js
const PRECOS = {
  principal: { de: 416.30, por: 323.91, parcelas: 12, parcelaValor: 29.99,
               parcelado: 359.90 },

  'snow-foam-500ml': { de: 59.90, por: 39.90 },
  // ... um por produto, a chave é o slug da página /p/<slug>/

  ofertaSaida: { por: 279.90 },
};
```

- **de** — o preço riscado
- **por** — o que o cliente paga no Pix
- **parcelado** — preço em "outros meios", na segunda opção da buybox
- **parcelaValor** — o valor de cada parcela (o parcelado tem preço próprio,
  não é o à vista dividido)

O **selo de desconto é calculado sozinho**. Não existe campo `off`: mudar o
preço e esquecer de ajustar o "30% OFF" era o erro mais fácil de cometer.

## O que ele valida antes de gravar

- `por` menor que `de` — senão o desconto seria negativo
- nenhum preço abaixo de R$ 1,00, que a Nerva recusa
- oferta de saída menor que o preço principal, senão não é oferta

## Alternativa sem código

Com o servidor rodando, o painel `/admin/editor` altera preços pela tela,
em Produto → preço e em Produtos relacionados. O que é salvo lá vai para
`nerva/data/offer.json` e **sobrescreve** o conteúdo dos arquivos.

Os dois caminhos convivem: o `precos.js` mexe no conteúdo embutido (o que
aparece antes da hidratação e quando o backend está fora), o editor mexe no
publicado. Se você usa o editor, rode o `precos.js` também — senão a página
pisca com o preço antigo antes de corrigir.
