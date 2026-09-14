#!/usr/bin/env bash
# Baixa as imagens do produto e passa a servi-las localmente (macOS / Linux).
# Uso:  cd ml-main && bash baixar-imagens.sh
set -u
cd "$(dirname "$0")"
[ -f index.html ] || { echo "ERRO: rode de dentro da pasta ml-main."; exit 1; }

BASE='https://http2.mlstatic.com/'
# so as fotos do produto usam o prefixo D_NQ_NP_2X_; os logos dos
# parceiros do meli+ ficam noutro caminho do mesmo CDN e nao sao tocados
DEST='img/produto'
mkdir -p "$DEST"

IMGS=(
  D_NQ_NP_2X_930197-MLA82035524488_022025-O.webp
  D_NQ_NP_2X_756691-MLA93747492351_092025-O.webp
  D_NQ_NP_2X_925801-MLA76702175052_062024-O.webp
  D_NQ_NP_2X_602004-MLA98669639369_112025-O.webp
  D_NQ_NP_2X_847341-MLA93329099906_092025-O.webp
  D_NQ_NP_2X_741908-MLA93747453237_092025-O.webp
  D_NQ_NP_2X_869581-MLA98669451653_112025-O.webp
  D_NQ_NP_2X_944305-MLA98669451629_112025-O.webp
)


ok=0; falhou=()
echo; echo "Baixando ${#IMGS[@]} imagens para $DEST ..."; echo
for n in "${IMGS[@]}"; do
  if curl -fsSL -e 'https://www.mercadolivre.com.br/' -o "$DEST/$n" "$BASE$n"; then
    echo "  ok  $n"; ok=$((ok+1))
  else
    echo "  FALHOU  $n"; falhou+=("$n")
  fi
done
echo; echo "$ok de ${#IMGS[@]} baixadas."
[ ${#falhou[@]} -gt 0 ] && { echo "Salve manualmente em $DEST:"; printf '  %s\n' "${falhou[@]}"; }

echo; echo "Trocando as URLs por caminhos locais ..."; echo
for a in index.html app.js nerva/content.js nerva/pages.js; do
  [ -f "$a" ] || continue
  cp "$a" "$a.bak"
  q=$(grep -o "${BASE}D_NQ_NP_2X_" "$a" | wc -l | tr -d ' ')
  [ "$q" = "0" ] && { echo "  (nada a trocar em $a)"; continue; }
  perl -pi -e "s#\Qhttps://http2.mlstatic.com/D_NQ_NP_2X_\E#img/produto/D_NQ_NP_2X_#g" "$a"
  echo "  ok  $a  ($q URLs)"
done
echo; echo "Pronto. Recarregue a pagina no Live Server (Ctrl+Shift+R)."
