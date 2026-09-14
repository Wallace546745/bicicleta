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
if [[ -n "$REMOTO" && "$REMOTO" != "$LOCAL" ]]; then
  echo "novo commit em $BRANCH: ${LOCAL:0:7} -> ${REMOTO:0:7}; atualizando"
  bash "$DIR/deploy/update.sh"
  exit 0
fi
# sem commit novo: ainda assim, se o domínio do repositório ainda não está no
# .env (DNS estava propagando), tenta de novo configurá-lo
DOM_REPO=$(tr -d ' \r\n' < "$DIR/deploy/dominio.txt" 2>/dev/null || true)
DOM_ENV=$(grep '^PUBLIC_URL=' "$DIR/nerva/.env" | cut -d= -f2 | sed 's#^https\?://##')
[[ -n "$DOM_REPO" && "$DOM_REPO" != "$DOM_ENV" ]] && bash "$DIR/deploy/update.sh" || true
