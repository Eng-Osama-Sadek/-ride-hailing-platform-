#!/bin/sh
# يعمل في كل مرة تبدأ فيها الحاوية (تطوير فقط)
set -e

# 1) إذا تغيّر package.json منذ بناء الصورة → ثبّت الحزم من جديد
HASH=$(md5sum package.json | cut -d' ' -f1)
if [ ! -f node_modules/.pkg.md5 ] || [ "$(cat node_modules/.pkg.md5)" != "$HASH" ]; then
  echo "📦 package.json changed -> npm install"
  npm install --no-audit --no-fund
  echo "$HASH" > node_modules/.pkg.md5
fi

# 2) Prisma Client
npx prisma generate

# 3) قاعدة البيانات: migrations إن وُجدت، وإلا db push (للإقلاع الأول فقط)
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  echo "🗄️  prisma migrate deploy"
  npx prisma migrate deploy
else
  echo "⚠️  لا توجد migrations بعد -> prisma db push (تطوير فقط)."
  echo "    بعد أول تشغيل ناجح نفّذ:  docker compose exec backend npm run db:baseline"
  npx prisma db push --skip-generate
fi

exec "$@"
