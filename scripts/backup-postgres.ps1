# PostgreSQL yedekleme — Windows
# Kullanim: .\scripts\backup-postgres.ps1

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $PSScriptRoot "..\backups"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$container = "marketapp_postgres"
if (-not (docker ps -q -f "name=$container")) {
    $container = "marketapp_postgres_prod"
}

$file = Join-Path $outDir "postgres_$timestamp.sql.gz"
Write-Host "Yedek aliniyor: $file"

docker exec $container pg_dump -U postgres marketapp | gzip > $file

Write-Host "Tamamlandi: $file"
