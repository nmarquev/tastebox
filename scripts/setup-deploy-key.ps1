param(
  [string]$HostName = "vps1.beweb.com.ar",
  [string]$UserName = "tastebox",
  [int]$Port = 22,
  [string]$KeyPath = "$env:USERPROFILE\.ssh\tastebox_deploy_ed25519"
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "No se encontro '$Name'. Instala OpenSSH Client en Windows."
  }
}

Require-Command "ssh"
Require-Command "ssh-keygen"

$sshDir = Split-Path -Parent $KeyPath
New-Item -ItemType Directory -Force -Path $sshDir | Out-Null

if (-not (Test-Path $KeyPath)) {
  Write-Host "Creando llave SSH local para deploy..."
  & ssh-keygen -t ed25519 -a 100 -f $KeyPath -C "tastebox-deploy@$env:COMPUTERNAME" -N '""'
}

$publicKeyPath = "$KeyPath.pub"
if (-not (Test-Path $publicKeyPath)) {
  throw "No se encontro la llave publica: $publicKeyPath"
}

Write-Host ""
Write-Host "Se va a instalar la llave publica en $UserName@$HostName."
Write-Host "Cuando Windows lo pida, ingresa la contrasena del usuario del servidor."
Write-Host ""

$publicKey = Get-Content $publicKeyPath -Raw
$remoteCommand = @'
umask 077
mkdir -p ~/.ssh
touch ~/.ssh/authorized_keys
tmp="$(mktemp)"
cat > "$tmp"
cat "$tmp" >> ~/.ssh/authorized_keys
awk '!seen[$0]++' ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.new
mv ~/.ssh/authorized_keys.new ~/.ssh/authorized_keys
rm -f "$tmp"
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
'@

$publicKey | & ssh -p $Port "$UserName@$HostName" $remoteCommand
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo instalar la llave SSH en el servidor."
}

Write-Host ""
Write-Host "Llave instalada. Probando conexion sin contrasena..."
& ssh -i $KeyPath -p $Port -o IdentitiesOnly=yes "$UserName@$HostName" "echo OK"
if ($LASTEXITCODE -ne 0) {
  throw "La llave se instalo, pero la prueba de conexion fallo."
}

Write-Host ""
Write-Host "Setup listo. Para publicar TasteBox ejecuta:"
Write-Host "npm run deploy:prod"
