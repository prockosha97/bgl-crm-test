#!/bin/sh
# This helper starts the local cloud-development workflow, never production.
set -eu
cd /workspace/bgl-crm-test
if [ ! -f .env ]; then
  echo 'Local .env missing. Configure development DATABASE_URL and SESSION_SECRET securely; see README.' >&2
  exit 1
fi
if [ ! -f .cache/postgres.env ]; then
  echo 'Local PostgreSQL configuration missing. Use your configured external DB and README startup steps.' >&2
  exit 1
fi
if docker inspect bgl-content-hub-db >/dev/null 2>&1; then
  docker start bgl-content-hub-db >/dev/null
else
  docker run -d --name bgl-content-hub-db --env-file .cache/postgres.env -p 127.0.0.1:5432:5432 -v bgl-content-hub-pg:/var/lib/postgresql/data postgres:16-bookworm >/dev/null
fi
attempt=0
until docker exec bgl-content-hub-db pg_isready -U bgl -d bgl >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then echo 'PostgreSQL readiness timed out' >&2; exit 1; fi
  sleep 1
done
npm run db:deploy
# Existing dev accounts and passwords are preserved; seed refuses NODE_ENV=production.
npm run db:seed
exec npm run start
