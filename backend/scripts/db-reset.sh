#!/bin/sh
# يمسح قاعدة البيانات ويعيد بناءها ثم يدخل بيانات تجريبية. للتطوير فقط.
set -e
if [ "$NODE_ENV" = "production" ]; then
  echo "❌ Refusing to reset a production database."; exit 1
fi
if [ -d prisma/migrations ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
  npx prisma migrate reset --force --skip-seed
else
  npx prisma db push --force-reset --accept-data-loss
fi
npm run seed
