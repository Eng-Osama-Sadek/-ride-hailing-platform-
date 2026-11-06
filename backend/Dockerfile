# ---- Development image (hot reload). صورة الإنتاج تُضاف في المرحلة 2 ----
FROM node:22-bookworm-slim

# openssl: مطلوب لـ Prisma | curl: لـ healthcheck
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund \
 && md5sum package.json | cut -d' ' -f1 > node_modules/.pkg.md5

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN chmod +x ./docker-entrypoint.dev.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.dev.sh"]
CMD ["npm", "run", "start:dev"]
