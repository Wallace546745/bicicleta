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
# Domínio definido no repositório (deploy/dominio.txt). Se mudou em relação ao
# .env, o instalador roda de novo com ele: nginx, certificado HTTPS, URLs do
# .env e páginas regeradas. Assim o domínio entra no ar com um git push,
# sem precisar de SSH.
DOM_REPO=$(tr -d ' \r\n' < "$DIR/deploy/dominio.txt" 2>/dev/null || true)
DOM_ENV=$(grep '^PUBLIC_URL=' "$DIR/nerva/.env" | cut -d= -f2 | sed 's#^https\?://##')
if [[ -n "$DOM_REPO" && "$DOM_REPO" != "$DOM_ENV" ]]; then
  # IP público desta máquina: IMDSv2 (token) e, se não der, um serviço externo
  TOK=$(curl -s -m 3 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60' || true)
  MEU_IP=$(curl -s -m 3 -H "X-aws-ec2-metadata-token: $TOK" http://169.254.169.254/latest/meta-data/public-ipv4 || true)
  [[ "$MEU_IP" =~ ^[0-9.]+$ ]] || MEU_IP=$(curl -s -m 5 https://checkip.amazonaws.com | tr -d ' \n' || true)
  if [[ "$MEU_IP" =~ ^[0-9.]+$ ]] && getent hosts "$DOM_REPO" | grep -q "$MEU_IP"; then
    echo "domínio $DOM_REPO já aponta para esta máquina: configurando nginx + HTTPS"
    SKIP_CLONE=1 bash "$DIR/deploy/install-vps.sh" "$DOM_REPO" || echo "(instalador com domínio falhou; tenta de novo na próxima verificação)"
  else
    echo "domínio $DOM_REPO ainda não aponta para este IP; aguardando o DNS"
  fi
fi
# limite de upload do nginx acompanha o deploy/nginx.conf (o certbot reescreve o
# arquivo instalado, então só o valor é copiado, não o arquivo inteiro)
NGX=/etc/nginx/sites-available/lavadora
LIM=$(grep -o 'client_max_body_size [0-9]*[mk]' "$DIR/deploy/nginx.conf" | head -1 || true)
if [[ -n "$LIM" && -f "$NGX" ]] && ! grep -q "$LIM;" "$NGX"; then
  sed -i "s/client_max_body_size [0-9]*[mk];/$LIM;/" "$NGX" && nginx -t -q && systemctl reload nginx && echo "nginx: $LIM"
fi
# regera as páginas com o domínio do .env (metas absolutas)
DOM=$(grep '^PUBLIC_URL=' "$DIR/nerva/.env" | cut -d= -f2)
[[ -n "$DOM" ]] && sudo -u loja bash -c "cd '$DIR' && SITE_URL=$DOM node gerar-paginas.js >/dev/null"
# segredos lacrados (deploy/segredos.enc) -> nerva/.env, antes do restart
DIR="$DIR" bash "$DIR/deploy/aplicar-segredos.sh" || true
systemctl restart lavadora
sleep 2
systemctl --no-pager --lines=3 status lavadora
curl -fsS http://127.0.0.1:3000/health && echo "  <- servidor respondendo"
