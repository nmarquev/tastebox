param(
  [string]$HostName = "vps1.beweb.com.ar",
  [string]$UserName = "tastebox",
  [int]$Port = 22,
  [string]$SiteDir = "/home/tastebox/htdocs/tastebox.beweb.com.ar",
  [string]$Branch = "main",
  [string]$KeyPath = "$env:USERPROFILE\.ssh\tastebox_deploy_ed25519",
  [switch]$SkipPush,
  [switch]$Seed
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro '$Name'."
  }
}

Require-Command "git"
Require-Command "ssh"

if (-not (Test-Path $KeyPath)) {
  throw "No existe la llave SSH $KeyPath. Ejecuta primero: npm run deploy:setup-key"
}

$repoRoot = (& git rev-parse --show-toplevel).Trim()
Set-Location $repoRoot

$currentBranch = (& git branch --show-current).Trim()
if ($currentBranch -ne $Branch) {
  throw "Estas en la rama '$currentBranch'. Cambia a '$Branch' antes de publicar."
}

$status = (& git status --porcelain)
if ($status) {
  Write-Host "Hay cambios locales sin commitear:"
  Write-Host $status
  throw "Committea o descarta los cambios antes de publicar."
}

if (-not $SkipPush) {
  Write-Host "Actualizando referencias remotas..."
  & git fetch origin
  if ($LASTEXITCODE -ne 0) { throw "git fetch fallo." }

  Write-Host "Subiendo $Branch a GitHub..."
  & git push origin "$Branch"
  if ($LASTEXITCODE -ne 0) { throw "git push fallo." }
}

$seedPrefix = ""
if ($Seed) {
  $seedPrefix = "SEED=1 "
}

$remoteCommand = "cd '$SiteDir' && ${seedPrefix}bash deploy.sh"

Write-Host ""
Write-Host "Publicando TasteBox en el servidor..."
Write-Host "Host: $HostName"
Write-Host "Sitio: $SiteDir"
Write-Host ""

& ssh -i $KeyPath -p $Port -o IdentitiesOnly=yes "$UserName@$HostName" $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "El deploy remoto fallo."
}

Write-Host ""
Write-Host "Deploy completado."
Write-Host "URL: https://tastebox.beweb.com.ar"
