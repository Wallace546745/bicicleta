# Editor da oferta — /admin/editor

Muda tudo da loja sem tocar em código: título, preços, fotos, variantes,
descrição, características, avaliações, produtos relacionados, order bump e
oferta de saída.

## Como funciona

- Todo o conteúdo vive em `data/offer.json` (criado no 1º save; antes disso a
  loja usa o padrão embutido).
- A loja busca `/api/offer.json` ao carregar e se monta a partir dele.
- O editor mostra a **loja real ao vivo** num iframe. Passe o mouse em qualquer
  parte editável → aparece um contorno dourado e um lápis. Clique e edite no
  painel da direita.
- **Aplicar na prévia** mostra a mudança sem publicar. **Salvar e publicar**
  grava e a loja pública passa a usar na hora.

## Telas escondidas

Order bump e oferta de saída só aparecem quando o cliente age. Use os atalhos
no painel inicial do editor ("Oferta antes de finalizar", "Oferta de saída")
para abri-las dentro da prévia e editar.

## Imagens

Três formas, todas no mesmo seletor: enviar arquivo, colar um print (Ctrl+V),
ou colar um link `https://`. O que você envia fica em `data/uploads/` e reaparece
em "Já enviadas". Fotos do produto podem ser reordenadas (a 1ª é a principal).

## Segurança e recuperação

- Protegido pelo mesmo `ADMIN_TOKEN` do painel.
- Cada save guarda a versão anterior — botão **Desfazer último salvamento**.
- **Restaurar conteúdo original** volta tudo ao padrão de fábrica.

## Importante

- O preço "por" é o valor **realmente cobrado** no Pix — mudou aqui, mudou no
  checkout e no que sobe pro pixel.
- `data/` não vai pro Git (contém uploads e o offer.json). Faça backup dele junto
  com o resto dos dados do servidor.
