#!/usr/bin/env bash
# Auto-atualização: a cada 3 minutos (timer do systemd) compara o commit do
# branch no GitHub com o que está instalado e, se mudou, roda o update.sh.
# Assim um "git push" no branch publica na VPS sem SSH.
set -euo pipefail
CLONE=/var/www/bicicleta
DIR=$CLONE/lavadora-nova
BRANCH="${BRANCH:-claude/optimistic-pascal-q6f5t4}"
[[ -d "$CLONE/.git" ]] || exit 0
LOCAL=$(sudo -u loja git -C "$CLONE" rev-parse HEAD)
REMOTO=$(sudo -u loja git -C "$CLONE" ls-remote -q origin "refs/heads/$BRANCH" | cut -f1)
[[ -n "$REMOTO" && "$REMOTO" != "$LOCAL" ]] || exit 0
echo "novo commit em $BRANCH: ${LOCAL:0:7} -> ${REMOTO:0:7}; atualizando"
bash "$DIR/deploy/update.sh"
