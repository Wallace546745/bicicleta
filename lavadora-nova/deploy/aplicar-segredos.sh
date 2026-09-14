#!/usr/bin/env bash
# =============================================================================
#  Segredos "lacrados": deploy/segredos.enc é um texto KEY=VALOR criptografado
#  (AES-256, senha = ADMIN_TOKEN do nerva/.env desta VPS). O update.sh chama
#  este script a cada atualização: abre o arquivo com o token local e grava
#  as variáveis no nerva/.env. Assim um segredo (chave da Nerva, token do
#  TikTok…) chega à VPS por git push, sem SSH e sem ficar legível no GitHub.
#
#  Gerar (no seu computador, com o token do painel):
#     printf 'NERVA_API_KEY=sk_live_...\nNERVA_WEBHOOK_SECRET=whsec_...\n' \
#       | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -a -pass pass:SEU_ADMIN_TOKEN \
#       > deploy/segredos.enc
#  Só quem tem o ADMIN_TOKEN abre o arquivo; quem tem o token já manda no painel.
# =============================================================================
set -euo pipefail
DIR="${DIR:-/var/www/bicicleta/lavadora-nova}"
ENC="$DIR/deploy/segredos.enc"
ENVF="$DIR/nerva/.env"
MARCA="$DIR/nerva/data/.segredos-aplicados"
[[ -f "$ENC" && -f "$ENVF" ]] || exit 0
TOK=$(grep '^ADMIN_TOKEN=' "$ENVF" | head -1 | cut -d= -f2- | tr -d '"'"'"' \r')
[[ -n "$TOK" ]] || { echo "segredos: sem ADMIN_TOKEN no .env"; exit 0; }
HASH=$(sha256sum "$ENC" | cut -c1-16)
[[ -f "$MARCA" && "$(cat "$MARCA")" == "$HASH" ]] && exit 0     # já aplicado
if ! TXT=$(openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -a -in "$ENC" -pass "pass:$TOK" 2>/dev/null); then
  echo "segredos.enc: não abriu com o ADMIN_TOKEN desta VPS (foi gerado com outro token?)"; exit 0
fi
n=0
while IFS= read -r linha; do
  linha="${linha%$'\r'}"
  [[ "$linha" =~ ^([A-Z_][A-Z0-9_]*)=(.*)$ ]] || continue
  k="${BASH_REMATCH[1]}"; v="${BASH_REMATCH[2]}"
  v_esc=$(printf '%s' "$v" | sed 's/[&|\\]/\\&/g')
  if grep -q "^$k=" "$ENVF"; then sed -i "s|^$k=.*|$k=$v_esc|" "$ENVF"; else printf '%s=%s\n' "$k" "$v" >> "$ENVF"; fi
  echo "segredos: aplicado $k"; n=$((n+1))
done <<< "$TXT"
if id loja >/dev/null 2>&1; then chown loja:loja "$ENVF"; fi
chmod 600 "$ENVF"
mkdir -p "$(dirname "$MARCA")"; echo "$HASH" > "$MARCA"
if id loja >/dev/null 2>&1; then chown -R loja:loja "$(dirname "$MARCA")"; fi
echo "segredos: $n variável(is) gravada(s) no nerva/.env"
