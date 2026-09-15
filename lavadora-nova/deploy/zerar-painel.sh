#!/usr/bin/env bash
# =============================================================================
#  Zera o painel (vendas, eventos, visitantes por dia, jornadas e a trava de
#  compras já disparadas) SEM apagar nada: os arquivos vão para
#  nerva/data/arquivo-<data>/. Configurações, oferta, páginas, uploads,
#  comprovantes e inscrições de push ficam como estão.
#
#  Disparo por git: mude o conteúdo de deploy/zerar-painel.txt (qualquer texto
#  novo, ex.: a data) e dê push. O update.sh chama este script antes de
#  reiniciar o serviço; ele só age quando o texto do arquivo é diferente do
#  último aplicado (nerva/data/.painel-zerado). Manual: sudo bash deploy/zerar-painel.sh --agora
# =============================================================================
set -euo pipefail
DIR="${DIR:-/var/www/bicicleta/lavadora-nova}"
DATA="$DIR/nerva/data"
MARCA="$DIR/deploy/zerar-painel.txt"
FEITO="$DATA/.painel-zerado"
if [[ "${1:-}" != "--agora" ]]; then
  [[ -f "$MARCA" ]] || exit 0
  PEDIDO=$(tr -d '\r' < "$MARCA")
  [[ -n "$PEDIDO" ]] || exit 0
  [[ -f "$FEITO" && "$(cat "$FEITO")" == "$PEDIDO" ]] && exit 0     # já aplicado
fi
mkdir -p "$DATA"
ARQ="$DATA/arquivo-$(date +%Y%m%d-%H%M%S)"
systemctl stop lavadora 2>/dev/null || true       # parado: o serviço grava a cada 5 s, senão reescrevia
mkdir -p "$ARQ"
n=0
for f in sales.json events.json daily.json jornadas.json paid-fired.json; do
  [[ -f "$DATA/$f" ]] && { mv "$DATA/$f" "$ARQ/"; n=$((n+1)); }
done
[[ "${1:-}" == "--agora" ]] || tr -d '\r' < "$MARCA" > "$FEITO"
if id loja >/dev/null 2>&1; then chown -R loja:loja "$DATA"; fi
echo "painel zerado: $n arquivo(s) guardado(s) em $ARQ"
