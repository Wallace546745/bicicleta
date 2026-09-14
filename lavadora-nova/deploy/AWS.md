# Loja na AWS: domínio + servidor em 3 comandos

Tudo roda na **sua** conta AWS, do seu computador, com a AWS CLI logada
(`aws configure`, usuário IAM com permissão de EC2, Route 53 e Route 53 Domains).

## 1. Comprar o domínio (Route 53)

```bash
cp deploy/contato-dominio.example.json deploy/contato-dominio.json
nano deploy/contato-dominio.json           # seus dados: o ICANN exige nome, endereço, telefone e e-mail
bash deploy/route53-registrar-dominio.sh minhaloja.com
```

O script mostra se o nome está livre e o preço, e só compra depois que você
digitar `SIM`. Cobra no cartão da conta AWS e não tem estorno.

- `.com` custa cerca de US$ 14 por ano. `.shop` e `.store` custam mais.
- O Route 53 **não** registra `.com.br`. Para isso use o registro.br e aponte
  os nameservers para a zona criada na AWS.
- A AWS manda um e-mail de verificação. Confirme em até 15 dias.
- A hosted zone é criada sozinha junto com o registro (US$ 0,50 por mês).

Se preferir o console: Route 53 → Registered domains → Register domain.

## 2. Subir o servidor (EC2) e apontar o domínio

```bash
NERVA_API_KEY=sk_live_... NERVA_WEBHOOK_SECRET=whsec_... TIKTOK_ACCESS_TOKEN=... \
bash deploy/aws-setup.sh minhaloja.com seu@email.com
```

Cria em São Paulo (`sa-east-1`): chave SSH, security group (22, 80, 443),
instância `t3.small` Ubuntu 24.04 (cerca de US$ 17 por mês), IP fixo e os
registros `A` de `minhaloja.com` e `www.minhaloja.com`. A instância instala a
loja sozinha no primeiro boot, com o `install-vps.sh`, e emite o certificado
HTTPS pelo Let's Encrypt.

Os segredos passados na linha de comando vão direto para o `nerva/.env` da
VPS. Se não passar, edite depois:

```bash
ssh -i ~/.ssh/loja-v9max.pem ubuntu@IP
sudo nano /var/www/bicicleta/lavadora-nova/nerva/.env
sudo systemctl restart lavadora
```

Repositório privado: exporte `GITHUB_TOKEN=ghp_...` (token com leitura) antes
de rodar o `aws-setup.sh`.

## 3. Conferir

| O quê | Onde |
|---|---|
| Loja | `https://minhaloja.com` |
| Painel | `https://minhaloja.com/admin` (token: `ADMIN_TOKEN` do `.env`; o instalador imprime) |
| Saúde | `https://minhaloja.com/health` |
| Log da instalação | `sudo tail -f /var/log/instalacao-loja.log` |
| Log do serviço | `sudo journalctl -u lavadora -f` |

Se o HTTPS falhou porque o DNS ainda não tinha propagado, rode na VPS:
`sudo bash /root/install-vps.sh minhaloja.com`.

## Atualizar a loja depois

```bash
sudo bash /var/www/bicicleta/lavadora-nova/deploy/update.sh
```

Puxa o branch do GitHub, regera as páginas com o domínio (metas absolutas
para Facebook e Google) e reinicia o serviço.

## Sem AWS CLI

Console da AWS, na mesma ordem: Route 53 → Register domain; EC2 → Launch
instance (Ubuntu 24.04, `t3.small`, portas 22/80/443, cole o conteúdo de
`deploy/ec2-user-data.sh` com as 3 primeiras linhas preenchidas no campo
*User data*); EC2 → Elastic IPs → Allocate e Associate; Route 53 → Hosted zone
do domínio → registro `A` para o domínio e para `www` com o IP.
