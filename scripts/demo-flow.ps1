# Akıllı Sepet — hızlı demo API akışı (PowerShell)
# Kullanım: .\scripts\demo-flow.ps1

$BaseUrl = if ($env:API_URL) { $env:API_URL } else { "http://localhost:3001/api" }

Write-Host "=== Akıllı Sepet Demo ===" -ForegroundColor Cyan
Write-Host "API: $BaseUrl"

Write-Host "`n1. Ürün listesi..." -ForegroundColor Yellow
$products = Invoke-RestMethod -Uri "$BaseUrl/products?limit=3&isActive=true" -Method Get
$items = $products.data.items
if (-not $items) { $items = $products.items }
$items | ForEach-Object { Write-Host "  - $($_.name)" }
$firstId = $items[0].id

Write-Host "`n2. Ürün detayı ($firstId)..." -ForegroundColor Yellow
$detail = Invoke-RestMethod -Uri "$BaseUrl/products/$firstId" -Method Get
$d = if ($detail.data) { $detail.data } else { $detail }
Write-Host "  $($d.name) — $($d.prices.Count) fiyat kaydı"

Write-Host "`n3. Giriş (demo kullanıcı)..." -ForegroundColor Yellow
$loginBody = @{ email = "kullanici@marketapp.com"; password = "User123!" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
$token = if ($login.data.accessToken) { $login.data.accessToken } else { $login.accessToken }
Write-Host "  Token alındı"

Write-Host "`n4. Sepet..." -ForegroundColor Yellow
$headers = @{ Authorization = "Bearer $token" }
$cart = Invoke-RestMethod -Uri "$BaseUrl/carts" -Method Get -Headers $headers
$c = if ($cart.data) { $cart.data } else { $cart }
Write-Host "  Sepette $($c.items.Count) ürün"

Write-Host "`nDemo tamamlandı." -ForegroundColor Green
