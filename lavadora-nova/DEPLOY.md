# Hospedar na VPS

Funciona em qualquer VPS Ubuntu 22.04/24.04 (Hostinger, Contabo, DigitalOcean,
Hetzner, Oracle…). 1 vCPU e 1 GB de RAM bastam. Tudo roda num único processo
Node atrás do Nginx com HTTPS.

## Antes de começar

1. **Domínio apontando para a VPS.** No DNS do domínio, crie um registro `A`
   (ex.: `loja` → IP da VPS). Espere resolver (`ping loja.seudominio.com.br`).
2. **Código no GitHub.** O instalador clona a branch padrão do repositório
   (`claude/beautiful-turing-ihd5e3`); outra branch: `BRANCH=nome` no comando.
   O repositório é **privado**, então a VPS precisa de um token de leitura:
   GitHub → Settings → Developer settings → Fine-grained tokens → só este
   repositório, permissão *Contents: Read-only*. (Ou torne o repositório
   público: ele não contém segredo nenhum.)
3. Tenha em mãos: chave da Nerva (`sk_live_…`), signing secret do webhook
   (`whsec_…`), Pixel ID e Access Token do TikTok.

## Instalar (uma vez, ~3 minutos)

Conectado na VPS por SSH, como root (ou com `sudo`):

```bash
export GITHUB_TOKEN=github_pat_...      # o token de leitura (só se o repositório for privado)
curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://raw.githubusercontent.com/Wallace546745/lavadora-nova/claude/beautiful-turing-ihd5e3/deploy/install-vps.sh -o install-vps.sh
sudo -E bash install-vps.sh loja.seudominio.com.br
```

Para não precisar editar arquivo depois, os segredos podem ir na própria
linha (ficam só no `nerva/.env` da VPS; nunca no git):

```bash
NERVA_API_KEY=sk_live_... NERVA_WEBHOOK_SECRET=whsec_... \
TIKTOK_PIXEL_ID=D451RVBC77U1GG09RAKG TIKTOK_ACCESS_TOKEN=... \
sudo -E bash install-vps.sh loja.seudominio.com.br
```

(`sudo -E` preserva as variáveis, inclusive o `GITHUB_TOKEN` exportado acima.)

O script instala Node 22, Nginx e Certbot; cria o usuário `loja`; clona o
repositório em `/var/www/lavadora`; instala as dependências; gera o
`nerva/.env` com `PUBLIC_URL`, `ALLOWED_ORIGIN` e um `ADMIN_TOKEN` aleatório;
registra o serviço `systemd`; configura o Nginx e emite o certificado HTTPS.

Ao terminar, ele pede para preencher o que só você tem:

```bash
sudo nano /var/www/lavadora/nerva/.env
```

```
NERVA_API_KEY=sk_live_...
NERVA_WEBHOOK_SECRET=whsec_...
TIKTOK_PIXEL_ID=D451RVBC77U1GG09RAKG
TIKTOK_ACCESS_TOKEN=cole_o_token_do_events_manager
```

Salve e suba:

```bash
sudo systemctl restart lavadora
```

## Depois de subir

| Onde | O quê |
|---|---|
| `https://SEU_DOMINIO/` | a loja |
| `https://SEU_DOMINIO/admin` | painel (o `ADMIN_TOKEN` está no `.env`) |
| Painel da Nerva → Webhooks | cadastre `https://SEU_DOMINIO/webhooks/nerva` com o mesmo signing secret |
| `https://SEU_DOMINIO/api/admin/tracking?token=SEU_TOKEN` | deve mostrar `ativo: true` e `saude: ok` |
| TikTok Events Manager → Testar eventos | navegue e compre; depois **apague** o `TIKTOK_TEST_EVENT_CODE` |

No iPhone, abra o painel no Safari → Compartilhar → **Adicionar à Tela de
Início** e, dentro do app, ative as notificações na aba Rastreamento. Sem
isso o iOS não entrega push.

## Atualizar

Sempre que houver código novo no GitHub:

```bash
sudo bash /var/www/lavadora/deploy/update.sh
```

## Comandos úteis

```bash
sudo systemctl status lavadora        # está no ar?
sudo journalctl -u lavadora -f        # log ao vivo (PAGO:, [tiktok], [vigia]…)
sudo systemctl restart lavadora       # depois de mudar o .env
sudo nginx -t && sudo systemctl reload nginx
sudo certbot renew --dry-run          # o certificado renova sozinho; isto só testa
```

## Backup

Os dados de vendas e clientes ficam em `/var/www/lavadora/nerva/data/`
(`sales.json`, `events.json`, contexto do tracking, inscrições de push,
configurações do painel). Copie essa pasta periodicamente:

```bash
sudo tar czf backup-loja-$(date +%F).tgz -C /var/www/lavadora/nerva data .env
```

## Se algo der errado

- **Certificado falhou** → o DNS ainda não apontava para a VPS. Depois que
  resolver: `sudo certbot --nginx -d SEU_DOMINIO`.
- **502 no navegador** → o Node caiu ou não subiu: `journalctl -u lavadora -n 50`.
  Quase sempre é `.env` incompleto (`FALTA NERVA_API_KEY`).
- **Painel diz "Events API desligada"** → falta `TIKTOK_ACCESS_TOKEN` no `.env`
  (ou cole pelo painel, aba Rastreamento).
- **Venda paga não aparece** → veja o log: o vigia consulta a Nerva a cada 3 s
  e escreve `PAGO (vigia):`; se a chave da Nerva estiver errada, aparece
  `[vigia] Nerva 401`.
- **Porta ocupada** → mude `PORT=` no `.env` e o `proxy_pass` em
  `/etc/nginx/sites-available/lavadora`.

---

# Loja na Vercel (opcional) + backend na VPS

A Vercel **não roda o backend** (é serverless: sem disco, sem processo
contínuo — perderia vendas, fila do TikTok, vigia, webhook e painel). Ela
serve bem a **loja estática**. O `vercel.json` encaminha `/api`, `/webhooks`,
`/admin` e `/nerva` para a VPS, então para o navegador fica tudo no mesmo
domínio e nada muda no código.

## Passo a passo

1. **Backend no ar na VPS** (seção acima), com um domínio próprio, ex.:
   `api.seudominio.com.br`.
2. No `vercel.json`, troque `BACKEND_DA_VPS` por esse domínio (7 linhas) e
   faça o commit.
3. Em [vercel.com/new](https://vercel.com/new) → **Continue with GitHub** →
   autorize o app da Vercel no seu GitHub (pode limitar só ao repositório
   `lavadora-nova`) → **Import**.
4. Na tela de configuração: *Framework Preset* = **Other**, *Root Directory*
   = `./`, sem build command, *Output Directory* vazio. **Deploy**.
5. Em *Settings → Git*, confira que a *Production Branch* é a branch do
   repositório (`claude/beautiful-turing-ihd5e3`, ou `main` se você fizer o
   merge). A partir daí cada push publica sozinho.
6. Em *Settings → Domains*, adicione o domínio da loja e aponte o DNS como a
   Vercel indicar.
7. No `nerva/.env` da VPS: `ALLOWED_ORIGIN=https://DOMINIO_DA_LOJA` (o domínio
   da Vercel) e `PUBLIC_URL=https://api.seudominio.com.br`. Reinicie.
8. No painel da Nerva, o webhook fica `https://api.seudominio.com.br/webhooks/nerva`
   (direto na VPS, sem passar pela Vercel).

## O que muda nesse arranjo

- O painel `/admin` abra pelo domínio da VPS (`https://api.…/admin`): o
  tempo real por SSE não passa bem por proxy de CDN.
- A loja na Vercel é o `index.html` estático: preço e SKU do ViewContent
  imediato vêm do próprio arquivo. Se mudar o preço no editor, rode
  `node gerar-paginas.js`, atualize o `TTK_CONFIG` do `index.html` e faça
  push — ou sirva a loja pela VPS mesmo, que injeta tudo sozinha.
- Se preferir simplicidade, **a VPS sozinha serve tudo** (loja + backend) e a
  Vercel não é necessária.
