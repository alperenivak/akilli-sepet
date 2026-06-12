# =====================================================
# Akilli Sepet - tek komutla gelistirme ortami
# Kullanim (proje kokunden):
#   .\scripts\start-dev.ps1
# =====================================================

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host ""
Write-Host "=== Akilli Sepet - Gelistirme Ortami ===" -ForegroundColor Cyan
Write-Host "Proje: $Root"
Write-Host ""

# ---- 1. Ortam dosyalari ----
$backendEnv = Join-Path $Root "backend\.env"
$adminEnvFile = Join-Path $Root "admin-panel\.env.local"
$mobileEnvFile = Join-Path $Root "mobile\.env"

if (-not (Test-Path $backendEnv)) {
  Write-Host "[1/6] backend\.env olusturuluyor..." -ForegroundColor Yellow
  Copy-Item (Join-Path $Root ".env.example") $backendEnv
  (Get-Content $backendEnv) -replace '^PORT=3000', 'PORT=3001' | Set-Content $backendEnv
} else {
  Write-Host "[1/6] backend\.env mevcut" -ForegroundColor DarkGray
}

if (-not (Test-Path $adminEnvFile)) {
  Write-Host "      admin-panel\.env.local olusturuluyor..." -ForegroundColor Yellow
  $adminEnvContent = "NEXT_PUBLIC_API_URL=/api`nBACKEND_URL=http://localhost:3001"
  Set-Content -Path $adminEnvFile -Value $adminEnvContent -Encoding UTF8
}

# Mobil API: PC yerel IP (telefon ayni Wi-Fi)
$lanIp = (
  Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object {
    $_.PrefixOrigin -ne 'WellKnown' -and
    $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)'
  } |
  Select-Object -First 1 -ExpandProperty IPAddress
)
if (-not $lanIp) { $lanIp = "localhost" }

$mobileEnvContent = "EXPO_PUBLIC_API_URL=http://${lanIp}:3001/api"
Set-Content -Path $mobileEnvFile -Value $mobileEnvContent -Encoding UTF8
Write-Host "      Mobil API: http://${lanIp}:3001/api" -ForegroundColor DarkGray

# ---- 2. Docker altyapi ----
Write-Host '[2/6] Docker baslatiliyor: PostgreSQL, Redis, MinIO...' -ForegroundColor Yellow
docker compose up -d
if ($LASTEXITCODE -ne 0) {
  docker-compose up -d
  if ($LASTEXITCODE -ne 0) { throw "Docker baslatilamadi. Docker Desktop acik mi?" }
}

Write-Host "      PostgreSQL hazir olana kadar bekleniyor..." -ForegroundColor DarkGray
$ready = $false
for ($i = 1; $i -le 30; $i++) {
  docker exec marketapp_postgres pg_isready -U postgres 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw "PostgreSQL 60 saniye icinde hazir olmadi." }

# ---- 3. Bagimliliklar ----
Write-Host "[3/6] npm paketleri kontrol ediliyor..." -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $Root "node_modules"))) { npm install }
if (-not (Test-Path (Join-Path $Root "backend\node_modules"))) { npm install --prefix backend }
if (-not (Test-Path (Join-Path $Root "admin-panel\node_modules"))) { npm install --prefix admin-panel }
if (-not (Test-Path (Join-Path $Root "mobile\node_modules"))) { npm install --prefix mobile }

# ---- 4. Veritabani ----
Write-Host "[4/6] Veritabani migration + seed..." -ForegroundColor Yellow
Push-Location (Join-Path $Root "backend")
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Prisma migrate basarisiz." }
npx prisma generate
if ($LASTEXITCODE -ne 0) { Pop-Location; throw "Prisma generate basarisiz." }
npx prisma db seed
Pop-Location

# ---- 5. Servisleri ayri pencerelerde baslat ----
Write-Host '[5/6] Backend, Admin ve Mobil baslatiliyor - 3 ayri pencere...' -ForegroundColor Yellow

$backendDir = Join-Path $Root "backend"
$adminDir = Join-Path $Root "admin-panel"
$mobileDir = Join-Path $Root "mobile"

$backendCmd = "Set-Location '$backendDir'; Write-Host 'Backend API : http://localhost:3001/api' -ForegroundColor Green; Write-Host 'Swagger     : http://localhost:3001/api/docs' -ForegroundColor Green; npm run start:dev"
$adminCmd = "Set-Location '$adminDir'; Write-Host 'Admin Panel : http://localhost:3000' -ForegroundColor Green; npm run dev"
$mobileCmd = "Set-Location '$mobileDir'; Write-Host 'Mobil Expo - QR kodu Expo Go ile okuyun' -ForegroundColor Green; Write-Host 'API: http://${lanIp}:3001/api' -ForegroundColor Green; npx expo start --clear"

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", $adminCmd
Start-Sleep -Seconds 1
Start-Process powershell -ArgumentList "-NoExit", "-Command", $mobileCmd

# ---- 6. Ozet ----
Write-Host ""
Write-Host "[6/6] Tamamlandi!" -ForegroundColor Green
Write-Host ""
Write-Host "  Backend API    http://localhost:3001/api" -ForegroundColor White
Write-Host "  Swagger        http://localhost:3001/api/docs" -ForegroundColor White
Write-Host "  Admin Panel    http://localhost:3000" -ForegroundColor White
Write-Host "  Mobil API      http://${lanIp}:3001/api" -ForegroundColor White
Write-Host ""
Write-Host "  Admin giris    admin@marketapp.com / Admin123!" -ForegroundColor DarkGray
Write-Host "  Mobil giris    kullanici@marketapp.com / User123!" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  3 ayri PowerShell penceresi acildi." -ForegroundColor Yellow
Write-Host "  Tunnel modu: mobil pencerede Ctrl+C, sonra npx expo start --tunnel --clear" -ForegroundColor DarkGray
Write-Host ""
