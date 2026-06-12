#!/usr/bin/env bash
# PostgreSQL yedekleme — Linux/macOS
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$OUT_DIR"

CONTAINER="marketapp_postgres"
docker ps -q -f "name=$CONTAINER" >/dev/null 2>&1 || CONTAINER="marketapp_postgres_prod"

FILE="$OUT_DIR/postgres_${TIMESTAMP}.sql.gz"
echo "Yedek aliniyor: $FILE"

docker exec "$CONTAINER" pg_dump -U postgres marketapp | gzip > "$FILE"
echo "Tamamlandi: $FILE"
