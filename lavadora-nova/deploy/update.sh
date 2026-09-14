#!/usr/bin/env bash
# Atualiza a loja na VPS com o que está no GitHub e reinicia o serviço.
#   sudo bash /var/www/bicicleta/lavadora-nova/deploy/update.sh
set -euo pipefail
CLONE=/var/www/bicicleta
DIR=$CLONE/lavadora-nova
BRANCH="${BRANCH:-claude/optimistic-pascal-q6f5t4}"
sudo -u loja git -C "$CLONE" fetch -q origin "$BRANCH"
sudo -u loja git -C "$CLONE" reset -q --hard "origin/$BRANCH"
sudo -u loja bash -c "cd '$DIR/nerva' && npm ci --omit=dev --no-audit --no-fund --silent"
# regera as páginas com o domínio do .env (metas absolutas)
DOM=$(grep '^PUBLIC_URL=' "$DIR/nerva/.env" | cut -d= -f2)
[[ -n "$DOM" ]] && sudo -u loja bash -c "cd '$DIR' && SITE_URL=$DOM node gerar-paginas.js >/dev/null"
systemctl restart lavadora
sleep 2
systemctl --no-pager --lines=3 status lavadora
curl -fsS http://127.0.0.1:3000/health && echo "  <- servidor respondendo"
