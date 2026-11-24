#!/usr/bin/env bash
# InsurTech Sales Coach — локал дээр ажиллуулах
set -e
cd "$(dirname "$0")"
if [ ! -f .env.local ]; then
  cp .env.example .env.local
  SECRET=$(openssl rand -base64 32)
  sed -i.bak "s|^AUTH_SECRET=.*|AUTH_SECRET=${SECRET}|" .env.local && rm -f .env.local.bak
  echo "✓ .env.local үүсгэлээ"
fi
[ -d node_modules ] || npm install
echo "▶ http://localhost:3100 нээгдэнэ"
npm run dev
