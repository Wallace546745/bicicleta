#!/usr/bin/env bash
# Atualiza a loja na VPS com o que está no GitHub e reinicia o serviço.
#   sudo bash /var/www/lavadora/deploy/update.sh
set -euo pipefail
DIR=/var/www/lavadora
BRANCH="${BRANCH:-claude/beautiful-turing-ihd5e3}"
sudo -u loja git -C "$DIR" fetch -q origin "$BRANCH"
sudo -u loja git -C "$DIR" reset -q --hard "origin/$BRANCH"
sudo -u loja bash -c "cd '$DIR/nerva' && npm ci --omit=dev --no-audit --no-fund --silent"
systemctl restart lavadora
sleep 2
systemctl --no-pager --lines=3 status lavadora
curl -fsS http://127.0.0.1:3000/health && echo "  <- servidor respondendo"
