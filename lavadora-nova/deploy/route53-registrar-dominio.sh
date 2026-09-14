#!/usr/bin/env bash
# =============================================================================
#  Registra (compra) um domínio no Route 53 pela AWS CLI.
#
#     cp deploy/contato-dominio.example.json deploy/contato-dominio.json
#     nano deploy/contato-dominio.json      # seus dados (exigidos pelo ICANN)
#     bash deploy/route53-registrar-dominio.sh minhaloja.com
#
#  ATENÇÃO
#   - É uma COMPRA: cobra na hora, no cartão da conta AWS, e não tem estorno.
#     .com ~US$ 14/ano, .shop ~US$ 40/ano, .store ~US$ 55/ano (a CLI mostra
#     o preço antes de confirmar).
#   - O Route 53 NÃO registra .com.br (isso é só no registro.br). Para .com.br
#     registre lá e aponte os nameservers para a hosted zone criada na AWS.
#   - A AWS manda um e-mail de verificação para o contato: confirme em até
#     15 dias, senão o domínio é suspenso.
#   - O registro leva de minutos a algumas horas; a hosted zone é criada
#     automaticamente e o aws-setup.sh usa ela.
# =============================================================================
set -euo pipefail
DOMINIO="${1:-}"
[[ -z "$DOMINIO" ]] && { echo "uso: bash deploy/route53-registrar-dominio.sh minhaloja.com"; exit 1; }
AQUI="$(cd "$(dirname "$0")" && pwd)"
CONTATO="$AQUI/contato-dominio.json"
[[ -f "$CONTATO" ]] || { echo "crie $CONTATO a partir de contato-dominio.example.json"; exit 1; }
export AWS_DEFAULT_REGION=us-east-1        # o serviço de domínios só existe nesta região

echo "==> disponibilidade de $DOMINIO"
DISP=$(aws route53domains check-domain-availability --domain-name "$DOMINIO" --query Availability --output text)
echo "    $DISP"
[[ "$DISP" == "AVAILABLE" ]] || { echo "domínio indisponível. Tente outro nome ou outra terminação."; exit 1; }

TLD="${DOMINIO##*.}"
PRECO=$(aws route53domains list-prices --tld "$TLD" --query 'Prices[0].RegistrationPrice.Price' --output text 2>/dev/null || echo "?")
echo "==> preço do registro (.$TLD): US$ $PRECO por ano"
read -r -p "Confirma a compra de $DOMINIO por US\$ $PRECO/ano? (digite SIM) " OK
[[ "$OK" == "SIM" ]] || { echo "cancelado"; exit 1; }

OP=$(aws route53domains register-domain \
  --domain-name "$DOMINIO" --duration-in-years 1 --auto-renew \
  --admin-contact "file://$CONTATO" --registrant-contact "file://$CONTATO" --tech-contact "file://$CONTATO" \
  --privacy-protect-admin-contact --privacy-protect-registrant-contact --privacy-protect-tech-contact \
  --query OperationId --output text)
echo "==> pedido enviado (operação $OP). Acompanhe:"
echo "    aws route53domains get-operation-detail --operation-id $OP --region us-east-1"
echo "    Confirme o e-mail de verificação da AWS. Quando o status for SUCCESSFUL, rode: bash deploy/aws-setup.sh $DOMINIO seu@email.com"
