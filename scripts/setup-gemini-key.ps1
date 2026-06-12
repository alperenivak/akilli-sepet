# =====================================================
# Ücretsiz Gemini API key kurulumu (ChatGPT tarzı AI)
# https://aistudio.google.com/app/apikey — kredi kartı gerekmez
# =====================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$envFile = Join-Path $root 'backend\.env'

Write-Host ''
Write-Host '=== Akilli Sepet — Ucretsiz Gemini AI Kurulumu ===' -ForegroundColor Cyan
Write-Host ''
Write-Host '1) Tarayicida acilacak: Google AI Studio'
Write-Host '2) "Create API key" ile ucretsiz key olusturun'
Write-Host '3) Key''i asagiya yapistirin'
Write-Host ''

Start-Process 'https://aistudio.google.com/app/apikey'

$key = Read-Host 'Gemini API Key (AIza...)'
$key = $key.Trim()

if (-not $key -or $key.Length -lt 20) {
  Write-Host 'Gecersiz key. Islem iptal.' -ForegroundColor Red
  exit 1
}

if (-not $key.StartsWith('AIza') -and -not $key.StartsWith('AQ.')) {
  Write-Host 'UYARI: Beklenen format AIza... veya AQ.... (Google AI Studio / Cloud API key)' -ForegroundColor Yellow
  Write-Host 'Devam etmek icin Enter, iptal icin Ctrl+C.'
  Read-Host 'Enter'
}

if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $root '.env.example') $envFile
  (Get-Content $envFile) -replace 'PORT=3000', 'PORT=3001' | Set-Content $envFile
}

$content = Get-Content $envFile -Raw

if ($content -match '(?m)^GEMINI_API_KEY=.*$') {
  $content = $content -replace '(?m)^GEMINI_API_KEY=.*$', "GEMINI_API_KEY=$key"
} else {
  $content += "`nGEMINI_API_KEY=$key`n"
}

if ($content -notmatch 'AI_PREFERRED_PROVIDER') {
  $content += "AI_PREFERRED_PROVIDER=gemini`nGEMINI_MODEL=gemini-2.5-flash`n"
}

Set-Content -Path $envFile -Value $content.TrimEnd() -NoNewline
Add-Content -Path $envFile -Value "`n"

Write-Host ''
Write-Host 'GEMINI_API_KEY kaydedildi:' $envFile -ForegroundColor Green
Write-Host 'Backend''i yeniden baslatin: cd backend; npm run start:dev' -ForegroundColor Yellow
Write-Host 'Test: http://localhost:3001/api/ai/status' -ForegroundColor Gray
Write-Host ''
