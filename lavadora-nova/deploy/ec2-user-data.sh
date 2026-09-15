#!/bin/bash
# =============================================================================
#  User data da instância EC2 (Ubuntu 24.04). Cole este arquivo no campo
#  "User data" ao criar a instância no console da AWS, ou deixe que o
#  deploy/aws-setup.sh faça isso. Roda como root no primeiro boot e instala
#  a loja sozinho com o install-vps.sh do repositório.
#
#  Preencha as 3 linhas abaixo antes de usar:
# =============================================================================
DOMINIO="SEU_DOMINIO"                 # ex.: minhaloja.com  (o mesmo registrado no Route 53)
EMAIL_CERT="seu@email.com"            # avisos do certificado HTTPS (Let's Encrypt)
GITHUB_TOKEN=""                       # só se o repositório for privado (token com permissão de leitura)

# segredos do backend (podem ser colocados depois em /var/www/bicicleta/lavadora-nova/nerva/.env)
NERVA_API_KEY=""
NERVA_WEBHOOK_SECRET=""
ADMIN_TOKEN=""                        # senha do painel /admin (vazio = o instalador gera uma e imprime no log)
TIKTOK_PIXEL_ID="D451RVBC77U1GG09RAKG"
TIKTOK_ACCESS_TOKEN=""

# ----------------------------------------------------------------------------
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq && apt-get install -y -qq curl >/dev/null
RAW="https://raw.githubusercontent.com/Wallace546745/bicicleta/claude/optimistic-pascal-q6f5t4/lavadora-nova/deploy/install-vps.sh"
if [[ -n "$GITHUB_TOKEN" ]]; then
  curl -fsSL -H "Authorization: token $GITHUB_TOKEN" "$RAW" -o /root/install-vps.sh
else
  curl -fsSL "$RAW" -o /root/install-vps.sh
fi
# Sem DNS apontado ainda o certbot falha e o script avisa; basta rodar de novo
# (sudo bash /root/install-vps.sh SEU_DOMINIO) depois que o A record propagar.
export EMAIL_CERT GITHUB_TOKEN NERVA_API_KEY NERVA_WEBHOOK_SECRET ADMIN_TOKEN TIKTOK_PIXEL_ID TIKTOK_ACCESS_TOKEN
bash /root/install-vps.sh "$DOMINIO" > /var/log/instalacao-loja.log 2>&1 || true
