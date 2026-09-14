# ============================================================
#  Baixa as imagens do produto e passa a servi-las localmente.
#
#  COMO USAR (Windows):
#    1. Coloque este arquivo na pasta ml-main (junto do index.html)
#    2. Clique com o botao direito nele -> "Executar com o PowerShell"
#       (ou, no terminal:  powershell -ExecutionPolicy Bypass -File .\baixar-imagens.ps1)
#
#  O que ele faz:
#    - cria a pasta img/produto
#    - baixa as 17 imagens do CDN
#    - troca as URLs por caminhos locais em index.html, app.js,
#      nerva/content.js e nerva/pages.js
#    - guarda uma copia .bak de cada arquivo antes de alterar
# ============================================================

$ErrorActionPreference = 'Stop'
$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $raiz

if (-not (Test-Path 'index.html')) {
  Write-Host "ERRO: rode este script de dentro da pasta ml-main (a que tem o index.html)." -ForegroundColor Red
  Read-Host "Enter para sair"; exit 1
}

$BASE = 'https://http2.mlstatic.com/'
# so as fotos do produto tem esse prefixo; os logos dos parceiros do
# meli+ ficam noutro caminho do mesmo CDN e nao podem ser tocados
$PREFIXO = 'https://http2.mlstatic.com/D_NQ_NP_2X_'
$DEST = 'img/produto'
New-Item -ItemType Directory -Force -Path $DEST | Out-Null

$imagens = @(
  # so as 8 fotos dos comentarios
  'D_NQ_NP_2X_930197-MLA82035524488_022025-O.webp',
  'D_NQ_NP_2X_756691-MLA93747492351_092025-O.webp',
  'D_NQ_NP_2X_925801-MLA76702175052_062024-O.webp',
  'D_NQ_NP_2X_602004-MLA98669639369_112025-O.webp',
  'D_NQ_NP_2X_847341-MLA93329099906_092025-O.webp',
  'D_NQ_NP_2X_741908-MLA93747453237_092025-O.webp',
  'D_NQ_NP_2X_869581-MLA98669451653_112025-O.webp',
  'D_NQ_NP_2X_944305-MLA98669451629_112025-O.webp'
)
  'D_NQ_NP_2X_711674-MLA99585997938_122025-F.webp',
  'D_NQ_NP_2X_830864-MLA99585879384_122025-F.webp',
  'D_NQ_NP_2X_651026-MLA99585879390_122025-F.webp',
  'D_NQ_NP_2X_840031-MLA96401022237_102025-F.webp',
  'D_NQ_NP_2X_862209-MLA95957991086_102025-F.webp',
  'D_NQ_NP_2X_908724-MLA99585958824_122025-F.webp',
  'D_NQ_NP_2X_804150-MLA99585997958_122025-F.webp',
  'D_NQ_NP_2X_994088-MLA112582728805_062026-F.webp',
  'D_NQ_NP_2X_622383-MLA112582609345_062026-F.webp',
  # fotos dos comentarios (8)
  'D_NQ_NP_2X_930197-MLA82035524488_022025-O.webp',
  'D_NQ_NP_2X_756691-MLA93747492351_092025-O.webp',
  'D_NQ_NP_2X_925801-MLA76702175052_062024-O.webp',
  'D_NQ_NP_2X_602004-MLA98669639369_112025-O.webp',
  'D_NQ_NP_2X_847341-MLA93329099906_092025-O.webp',
  'D_NQ_NP_2X_741908-MLA93747453237_092025-O.webp',
  'D_NQ_NP_2X_869581-MLA98669451653_112025-O.webp',
  'D_NQ_NP_2X_944305-MLA98669451629_112025-O.webp'
)

Write-Host "`nBaixando $($imagens.Count) imagens para $DEST ...`n" -ForegroundColor Cyan
$ok = 0; $falhou = @()
foreach ($nome in $imagens) {
  $destino = Join-Path $DEST $nome
  try {
    # o Referer do proprio CDN evita bloqueio de hotlink
    Invoke-WebRequest -Uri ($BASE + $nome) -OutFile $destino -UseBasicParsing `
      -Headers @{ 'Referer' = 'https://www.mercadolivre.com.br/' } -TimeoutSec 40
    $kb = [math]::Round((Get-Item $destino).Length / 1KB)
    Write-Host ("  ok  {0}  ({1} KB)" -f $nome, $kb) -ForegroundColor Green
    $ok++
  } catch {
    Write-Host ("  FALHOU  {0}" -f $nome) -ForegroundColor Red
    $falhou += $nome
  }
}

Write-Host "`n$ok de $($imagens.Count) baixadas." -ForegroundColor Cyan
if ($falhou.Count -gt 0) {
  Write-Host "Nao consegui baixar:`n  $($falhou -join "`n  ")" -ForegroundColor Yellow
  Write-Host "Salve essas manualmente em $DEST antes de continuar." -ForegroundColor Yellow
  $r = Read-Host "`nTrocar os caminhos mesmo assim? (s/N)"
  if ($r -ne 's') { Read-Host "Enter para sair"; exit }
}

$arquivos = @('index.html', 'app.js', 'nerva/content.js', 'nerva/pages.js')
Write-Host "`nTrocando as URLs por caminhos locais ...`n" -ForegroundColor Cyan
foreach ($a in $arquivos) {
  if (-not (Test-Path $a)) { Write-Host "  (pulei $a - nao encontrado)" -ForegroundColor DarkGray; continue }
  Copy-Item $a "$a.bak" -Force
  $txt = Get-Content $a -Raw -Encoding UTF8
  $antes = ([regex]::Matches($txt, [regex]::Escape($PREFIXO))).Count
  if ($antes -eq 0) { Write-Host "  (nada a trocar em $a)" -ForegroundColor DarkGray; continue }
  $txt = $txt.Replace($PREFIXO, 'img/produto/D_NQ_NP_2X_')
  [System.IO.File]::WriteAllText((Join-Path $raiz $a), $txt, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ("  ok  {0}  ({1} URLs)" -f $a, $antes) -ForegroundColor Green
}

Write-Host "`nPronto. Recarregue a pagina no Live Server (Ctrl+F5)." -ForegroundColor Cyan
Write-Host "Para desfazer, renomeie os arquivos .bak de volta.`n" -ForegroundColor DarkGray
Read-Host "Enter para sair"
