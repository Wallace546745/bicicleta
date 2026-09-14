#!/usr/bin/env bash
# =============================================================================
#  Sobe a loja na AWS do seu computador, com a AWS CLI já logada:
#
#     bash deploy/aws-setup.sh minhaloja.com seu@email.com
#
#  O que faz (região sa-east-1, São Paulo):
#    1. par de chaves SSH (salvo em ~/.ssh/loja-v9max.pem)
#    2. security group com portas 22, 80 e 443
#    3. instância EC2 t3.small Ubuntu 24.04 com o deploy/ec2-user-data.sh
#       (a loja instala sozinha no primeiro boot)
#    4. IP fixo (Elastic IP) associado à instância
#    5. registros A no Route 53 (dominio e www) apontando para o IP
#
#  Custos aproximados: t3.small ~US$ 17/mês + Elastic IP em uso (grátis
#  enquanto associado) + zona do Route 53 US$ 0,50/mês.
#
#  Pré-requisitos: aws cli v2 configurada (aws configure) com permissão de
#  EC2 e Route 53; o domínio já registrado no Route 53 (ver
#  route53-registrar-dominio.sh) ou uma hosted zone já criada para ele.
# =============================================================================
set -euo pipefail

DOMINIO="${1:-}"; EMAIL="${2:-}"
[[ -z "$DOMINIO" || -z "$EMAIL" ]] && { echo "uso: bash deploy/aws-setup.sh SEU_DOMINIO seu@email.com"; exit 1; }
REGIAO="${AWS_REGION:-sa-east-1}"
TIPO="${TIPO_INSTANCIA:-t3.small}"
NOME="loja-v9max"
export AWS_DEFAULT_REGION="$REGIAO"
AQUI="$(cd "$(dirname "$0")" && pwd)"

echo "==> 1/5 chave SSH"
if ! aws ec2 describe-key-pairs --key-names "$NOME" >/dev/null 2>&1; then
  aws ec2 create-key-pair --key-name "$NOME" --query KeyMaterial --output text > ~/.ssh/$NOME.pem
  chmod 600 ~/.ssh/$NOME.pem
  echo "    chave salva em ~/.ssh/$NOME.pem (guarde: é o acesso SSH)"
fi

echo "==> 2/5 security group"
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 describe-security-groups --filters Name=group-name,Values=$NOME Name=vpc-id,Values=$VPC --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null || true)
if [[ -z "$SG" || "$SG" == "None" ]]; then
  SG=$(aws ec2 create-security-group --group-name "$NOME" --description "Loja V9 Max: web + ssh" --vpc-id "$VPC" --query GroupId --output text)
  for p in 22 80 443; do aws ec2 authorize-security-group-ingress --group-id "$SG" --protocol tcp --port $p --cidr 0.0.0.0/0 >/dev/null; done
fi

echo "==> 3/5 instância EC2 ($TIPO, Ubuntu 24.04)"
AMI=$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
USERDATA=$(mktemp)
sed -e "s/^DOMINIO=\"SEU_DOMINIO\"/DOMINIO=\"$DOMINIO\"/" \
    -e "s/^EMAIL_CERT=\"seu@email.com\"/EMAIL_CERT=\"$EMAIL\"/" \
    -e "s/^GITHUB_TOKEN=\"\"/GITHUB_TOKEN=\"${GITHUB_TOKEN:-}\"/" \
    -e "s/^NERVA_API_KEY=\"\"/NERVA_API_KEY=\"${NERVA_API_KEY:-}\"/" \
    -e "s/^NERVA_WEBHOOK_SECRET=\"\"/NERVA_WEBHOOK_SECRET=\"${NERVA_WEBHOOK_SECRET:-}\"/" \
    -e "s/^ADMIN_TOKEN=\"\"/ADMIN_TOKEN=\"${ADMIN_TOKEN:-}\"/" \
    -e "s/^TIKTOK_ACCESS_TOKEN=\"\"/TIKTOK_ACCESS_TOKEN=\"${TIKTOK_ACCESS_TOKEN:-}\"/" \
    "$AQUI/ec2-user-data.sh" > "$USERDATA"
ID=$(aws ec2 describe-instances --filters Name=tag:Name,Values=$NOME Name=instance-state-name,Values=running,pending \
     --query 'Reservations[0].Instances[0].InstanceId' --output text 2>/dev/null || true)
if [[ -z "$ID" || "$ID" == "None" ]]; then
  ID=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$TIPO" --key-name "$NOME" --security-group-ids "$SG" \
       --user-data "file://$USERDATA" --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=20,VolumeType=gp3}' \
       --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NOME}]" \
       --query 'Instances[0].InstanceId' --output text)
  echo "    instância $ID criada; aguardando ficar pronta…"
  aws ec2 wait instance-running --instance-ids "$ID"
else
  echo "    instância $ID já existe"
fi
rm -f "$USERDATA"

echo "==> 4/5 IP fixo"
ALLOC=$(aws ec2 describe-addresses --filters Name=tag:Name,Values=$NOME --query 'Addresses[0].AllocationId' --output text 2>/dev/null || true)
if [[ -z "$ALLOC" || "$ALLOC" == "None" ]]; then
  ALLOC=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NOME}]" --query AllocationId --output text)
fi
aws ec2 associate-address --instance-id "$ID" --allocation-id "$ALLOC" >/dev/null
IP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].PublicIp' --output text)
echo "    IP: $IP"

echo "==> 5/5 DNS no Route 53"
ZONA=$(aws route53 list-hosted-zones-by-name --dns-name "$DOMINIO." --query "HostedZones[?Name=='$DOMINIO.'].Id" --output text | head -1)
if [[ -z "$ZONA" ]]; then
  echo "    não há hosted zone para $DOMINIO. Registre o domínio (route53-registrar-dominio.sh) ou crie a zona e rode de novo."
else
  cat > /tmp/dns-$NOME.json <<EOF
{ "Changes": [
  { "Action": "UPSERT", "ResourceRecordSet": { "Name": "$DOMINIO",     "Type": "A", "TTL": 300, "ResourceRecords": [{ "Value": "$IP" }] } },
  { "Action": "UPSERT", "ResourceRecordSet": { "Name": "www.$DOMINIO", "Type": "A", "TTL": 300, "ResourceRecords": [{ "Value": "$IP" }] } }
] }
EOF
  aws route53 change-resource-record-sets --hosted-zone-id "$ZONA" --change-batch file:///tmp/dns-$NOME.json >/dev/null
  echo "    $DOMINIO e www.$DOMINIO -> $IP"
fi

cat <<EOF

Pronto. A instância está instalando a loja (leva uns 3 minutos).
  acompanhar:  ssh -i ~/.ssh/$NOME.pem ubuntu@$IP 'sudo tail -f /var/log/instalacao-loja.log'
  se o HTTPS falhou porque o DNS ainda não propagou, rode na VPS:
               sudo bash /root/install-vps.sh $DOMINIO
  loja:        https://$DOMINIO        painel: https://$DOMINIO/admin
  segredos:    sudo nano /var/www/bicicleta/lavadora-nova/nerva/.env  (depois: sudo systemctl restart lavadora)
EOF
