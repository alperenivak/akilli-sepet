#!/usr/bin/env bash
# PostgreSQL geri yukleme
# Kullanim: ./scripts/restore-postgres.sh backups/postgres_20260101_120000.sql.gz
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Kullanim: $0 <backup.sql.gz>"
  exit 1
fi

BACKUP="$1"
CONTAINER="marketapp_postgres"
docker ps -q -f "name=$CONTAINER" >/dev/null 2>&1 || CONTAINER="marketapp_postgres_prod"

echo "DIKKAT: marketapp veritabani uzerine yazilacak!"
read -r -p "Devam? (yes/no): " CONFIRM
[ "$CONFIRM" = "yes" ] || exit 0

gunzip -c "$BACKUP" | docker exec -i "$CONTAINER" psql -U postgres -d marketapp
echo "Geri yukleme tamamlandi."
