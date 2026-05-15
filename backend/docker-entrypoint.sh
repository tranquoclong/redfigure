#!/bin/sh
set -e

# Split migrator (owner, com ALTER) vs runtime (app_user, least-privilege).
# Fallback: sem DATABASE_URL_MIGRATOR, usa DATABASE_URL (compat com deploys
# anteriores ao PR de app_user).
MIGRATE_URL="${DATABASE_URL_MIGRATOR:-$DATABASE_URL}"

echo "Running Prisma migrations..."
# Chama prisma direto pelo binario (npm/npx foram removidos da imagem
# de producao para eliminar CVEs picomatch/brace-expansion)
DATABASE_URL="$MIGRATE_URL" ./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "Migrations applied. Starting application..."
# exec substitui o shell — runtime conecta com DATABASE_URL (app_user em
# prod pos-setup; owner em dev/CI/deploys legacy).
exec node dist/main.js
