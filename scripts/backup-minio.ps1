# MinIO bucket yedekleme — Windows (mc client gerekir)
# Kurulum: https://min.io/docs/minio/linux/reference/minio-mc.html

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$outDir = Join-Path $PSScriptRoot "..\backups\minio"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$endpoint = $env:S3_ENDPOINT ?? "http://localhost:9000"
$bucket = $env:S3_BUCKET ?? "marketapp"
$access = $env:S3_ACCESS_KEY ?? "minioadmin"
$secret = $env:S3_SECRET_KEY ?? "dev_minio_change_me"

mc alias set marketapp-local $endpoint $access $secret 2>$null
mc mirror "marketapp-local/$bucket" (Join-Path $outDir $timestamp)

Write-Host "MinIO yedegi: $outDir\$timestamp"
