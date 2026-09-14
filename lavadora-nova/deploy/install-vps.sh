#!/usr/bin/env bash
# =============================================================================
#  Instala a loja numa VPS Ubuntu 22.04/24.04 (Debian 12 também funciona).
#  Roda como root, UMA vez:
#
#     curl -fsSL https://raw.githubusercontent.com/Wallace546745/lavadora-nova/claude/beautiful-turing-ihd5e3/deploy/install-vps.sh -o install-vps.sh
#     sudo bash install-vps.sh loja.seudominio.com.br
#
#  O que faz: Node 22 + Nginx + Certbot, usuário "loja", clona o repositório em
#  /var/www/lavadora, instala dependências, cria o nerva/.env (se não existir),
#  registra o serviço systemd, configura o Nginx e emite o certificado HTTPS.
#  Pode rodar de novo sem estragar nada (é idempotente).
# =============================================================================
set -euo pipefail

DOMINIO="${1:-}"
REPO="${REPO:-https://github.com/Wallace546745/lavadora-nova.git}"
BRANCH="${BRANCH:-claude/beautiful-turing-ihd5e3}"
DIR=/var/www/lavadora
EMAIL_CERT="${EMAIL_CERT:-}"          # opcional: e-mail para avisos do certificado
GITHUB_TOKEN="${GITHUB_TOKEN:-}"      # so se o repositorio for privado (token com leitura)
# Segredos podem vir na PROPRIA linha do comando (vao direto para o nerva/.env):
#   NERVA_API_KEY=sk_live_... NERVA_WEBHOOK_SECRET=whsec_... TIKTOK_PIXEL_ID=... TIKTOK_ACCESS_TOKEN=... \
#   sudo -E bash install-vps.sh loja.exemplo.com.br
SEGREDOS=(NERVA_API_KEY NERVA_WEBHOOK_SECRET TIKTOK_PIXEL_ID TIKTOK_ACCESS_TOKEN ADMIN_TOKEN)

if [[ -z "$DOMINIO" ]]; then
  echo "uso: sudo bash install-vps.sh SEU_DOMINIO   (ex.: loja.exemplo.com.br)"; exit 1
fi
if [[ $EUID -ne 0 ]]; then echo "rode como root (sudo)"; exit 1; fi
# Sem dominio ainda? Passe o IP publico: sobe em HTTP, sem certificado, e o
# PUBLIC_URL fica vazio (a Nerva exige https no webhook; o vigia cobre o pagamento).
SO_IP=0; [[ "$DOMINIO" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && SO_IP=1

echo "==> 1/7 pacotes do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx ca-certificates >/dev/null

echo "==> 2/7 Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    node $(node -v)"

echo "==> 3/7 usuário e código"
id -u loja >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin loja
mkdir -p "$(dirname "$DIR")"
CLONE_URL="$REPO"
# O token NUNCA vai para a URL do remote (ficaria em .git/config, dentro da
# pasta servida pela web). Vai para um credential store fora do site, so
# legivel pelo usuario loja.
if [[ -n "$GITHUB_TOKEN" ]]; then
  echo "https://x-access-token:$GITHUB_TOKEN@github.com" > /home/loja/.git-credentials
  chown loja:loja /home/loja/.git-credentials && chmod 600 /home/loja/.git-credentials
  sudo -u loja git config --global credential.helper 'store --file /home/loja/.git-credentials'
  git config --global credential.helper 'store --file /home/loja/.git-credentials'
fi
if [[ "${SKIP_CLONE:-0}" == "1" && -f "$DIR/nerva/server.js" ]]; then
  echo "    codigo ja esta em $DIR (SKIP_CLONE=1)"; chown -R loja:loja "$DIR"
elif [[ -d "$DIR/.git" ]]; then
  sudo -u loja git -C "$DIR" remote set-url origin "$CLONE_URL"
  sudo -u loja git -C "$DIR" fetch -q origin "$BRANCH" && sudo -u loja git -C "$DIR" checkout -q -B "$BRANCH" "origin/$BRANCH"
else
  git clone -q --branch "$BRANCH" "$CLONE_URL" "$DIR"
  chown -R loja:loja "$DIR"
fi
sudo -u loja bash -c "cd '$DIR/nerva' && npm ci --omit=dev --no-audit --no-fund --silent"
sudo -u loja mkdir -p "$DIR/nerva/data"

echo "==> 4/7 nerva/.env"
if [[ ! -f "$DIR/nerva/.env" ]]; then
  sudo -u loja cp "$DIR/nerva/.env.example" "$DIR/nerva/.env"
  sudo -u loja sed -i \
    -e "s#^PUBLIC_URL=.*#PUBLIC_URL=$([[ $SO_IP == 1 ]] || echo https://$DOMINIO)#" \
    -e "s#^ALLOWED_ORIGIN=.*#ALLOWED_ORIGIN=$([[ $SO_IP == 1 ]] && echo '*' || echo https://$DOMINIO)#" \
    -e "s#^ADMIN_TOKEN=.*#ADMIN_TOKEN=$(head -c 24 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)#" \
    "$DIR/nerva/.env"
  chmod 600 "$DIR/nerva/.env"
  ENV_NOVO=1
else
  ENV_NOVO=0
fi
# rodou de novo, agora com dominio: atualiza as URLs no .env existente
if [[ "$ENV_NOVO" == "0" && $SO_IP == 0 ]]; then
  sudo -u loja sed -i -e "s#^PUBLIC_URL=.*#PUBLIC_URL=https://$DOMINIO#" -e "s#^ALLOWED_ORIGIN=.*#ALLOWED_ORIGIN=https://$DOMINIO#" "$DIR/nerva/.env"
fi
# segredos passados no comando entram no .env (sobrescrevem a linha existente)
for v in "${SEGREDOS[@]}"; do
  val="${!v:-}"
  [[ -z "$val" ]] && continue
  if grep -q "^$v=" "$DIR/nerva/.env"; then
    sudo -u loja sed -i "s#^$v=.*#$v=$val#" "$DIR/nerva/.env"
  else
    echo "$v=$val" | sudo -u loja tee -a "$DIR/nerva/.env" >/dev/null
  fi
done
FALTA=""
for v in NERVA_API_KEY NERVA_WEBHOOK_SECRET; do
  grep -qE "^$v=.+" "$DIR/nerva/.env" && ! grep -qE "^$v=(sk_live_sua_chave_aqui|whsec_seu_secret_aqui)$" "$DIR/nerva/.env" || FALTA="$FALTA $v"
done

echo "==> 5/7 serviço systemd"
cp "$DIR/deploy/lavadora.service" /etc/systemd/system/lavadora.service
systemctl daemon-reload
systemctl enable -q lavadora

echo "==> 6/7 nginx"
sed "s/SEU_DOMINIO/$DOMINIO/g" "$DIR/deploy/nginx.conf" > /etc/nginx/sites-available/lavadora
ln -sf /etc/nginx/sites-available/lavadora /etc/nginx/sites-enabled/lavadora
rm -f /etc/nginx/sites-enabled/default
nginx -t -q && systemctl reload nginx

echo "==> 7/7 HTTPS (Let's Encrypt)"
if [[ $SO_IP == 1 ]]; then
  echo "    sem dominio: HTTP por enquanto. Com o dominio apontado, rode de novo: bash install-vps.sh SEU_DOMINIO"
elif [[ ! -d "/etc/letsencrypt/live/$DOMINIO" ]]; then
  if [[ -n "$EMAIL_CERT" ]]; then
    certbot --nginx -d "$DOMINIO" -d "www.$DOMINIO" --non-interactive --agree-tos -m "$EMAIL_CERT" --redirect || echo "    (certbot falhou: o DNS de $DOMINIO e www.$DOMINIO já aponta para esta VPS? rode depois: certbot --nginx -d $DOMINIO -d www.$DOMINIO)"
  else
    certbot --nginx -d "$DOMINIO" -d "www.$DOMINIO" --non-interactive --agree-tos --register-unsafely-without-email --redirect || echo "    (certbot falhou: o DNS de $DOMINIO e www.$DOMINIO já aponta para esta VPS? rode depois: certbot --nginx -d $DOMINIO -d www.$DOMINIO)"
  fi
fi

echo
if [[ -n "$FALTA" ]]; then
  echo "#############################################################"
  echo "  FALTA PREENCHER no nerva/.env:$FALTA"
  echo "     sudo nano $DIR/nerva/.env"
  echo "  Depois:  sudo systemctl restart lavadora"
  echo "#############################################################"
else
  systemctl restart lavadora
fi
echo "  Token do painel (ADMIN_TOKEN): $(grep '^ADMIN_TOKEN=' "$DIR/nerva/.env" | cut -d= -f2)"
sleep 2
systemctl --no-pager --lines=5 status lavadora || true
echo
ESQ=https; [[ $SO_IP == 1 ]] && ESQ=http
echo "Loja:    $ESQ://$DOMINIO/"
echo "Painel:  $ESQ://$DOMINIO/admin"
[[ $SO_IP == 1 ]] || echo "Webhook: https://$DOMINIO/webhooks/nerva   (cadastre no painel da Nerva)"
echo "Logs:    journalctl -u lavadora -f"
