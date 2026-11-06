# Ride Hailing Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql)](https://www.postgresql.org/)

A complete local-first ride-hailing platform for riders, drivers, and administrators. It includes a secure NestJS API, React admin dashboard, PostgreSQL/Prisma data layer, Redis caching, authentication, ride management, payments, driver records, audit logging, and Docker-based local infrastructure.

منصة متكاملة لحجز الرحلات للركاب والسائقين والإدارة، مبنية بنظام Local-First. تشمل واجهة API آمنة باستخدام NestJS، ولوحة إدارة React، وطبقة بيانات PostgreSQL/Prisma، وRedis، والمصادقة، وإدارة الرحلات والمدفوعات والسائقين وسجل التدقيق، مع بيئة Docker للتشغيل المحلي.

## Platform capabilities

- **Authentication:** OTP login for riders and drivers, admin email/password login, JWT access tokens, and refresh-token rotation.
- **Admin dashboard:** Live platform statistics, riders, drivers, rides, payments, system health, and transaction records.
- **Ride operations:** Ride lifecycle, statuses, driver assignment data, fares, and route information.
- **Driver management:** Online status, vehicle details, driver levels, documents, ratings, and location data.
- **Payments:** Transactions, wallet balances, commission, refunds, tips, and withdrawal records.
- **Security:** Role guards, default-deny authorization, throttling, audit logs, Helmet headers, and password hashing.
- **Infrastructure:** Docker Compose services for PostgreSQL, Redis, S3-compatible storage, MailHog, Adminer, API, and dashboard.

## Architecture

```text
ride-hailing/
├── backend/              NestJS 11 REST API and Prisma ORM
├── admin-dashboard/      React 19 and Vite admin dashboard
├── rider-app/            Rider application workspace
├── driver-app/           Driver application workspace
├── scripts/              Database initialization scripts
└── docker-compose.yml    Local infrastructure
```

## Quick start

### Prerequisites

- Docker Desktop with Docker Compose v2
- Node.js 22+
- Git

### Configure and run

```bash
cp .env.example .env
docker compose --profile admin up --build
```

Initialize and seed the local database:

```bash
docker compose exec backend npm run db:baseline
docker compose exec backend npm run seed
```

| Service | URL |
|---|---|
| Admin dashboard | http://localhost:5173 |
| REST API health | http://localhost:3000/api/v1/health |
| Swagger documentation | http://localhost:3000/docs |
| Database console | http://localhost:8080 |
| MailHog | http://localhost:8025 |
| Storage console | http://localhost:9001 |

### Development admin account

```text
Email: admin@ridehailing.local
Password: AdminLocal2026!
```

Change seeded credentials and all default secrets before any deployment.

## Useful commands

```bash
docker compose ps
docker compose logs -f backend
docker compose exec backend npm test
docker compose exec backend npm run test:e2e
docker compose exec backend npm run db:reset
docker compose down
```

## API authentication

```bash
# Request an OTP in mock development mode
curl -X POST http://localhost:3000/api/v1/auth/otp/request \
  -H "Content-Type: application/json" \
  -d '{"phone":"+201000000001","role":"RIDER"}'

# Verify OTP
curl -X POST http://localhost:3000/api/v1/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"+201000000001","role":"RIDER","code":"123456"}'
```

## Security notes

- Never commit `.env`, private keys, tokens, or production credentials.
- The development OTP mode is disabled automatically in production.
- Database and Redis ports should remain private in production.
- Use HTTPS, managed secrets, strong passwords, backups, and a reverse proxy for a public deployment.
- Commercial ride-hailing operations may require applicable licenses and regulatory approvals.

## Author

### Osama Sadek

**AI Maker & Mobile Architect**

- WhatsApp: [+20 106 813 4714](https://wa.me/201068134714)
- Email: [osamasadekadam321@gmail.com](mailto:osamasadekadam321@gmail.com)
- GitHub: [Eng-Osama-Sadek](https://github.com/Eng-Osama-Sadek)
- Portfolio: [osama-sadek-portfolio.vercel.app](https://osama-sadek-portfolio.vercel.app/)
- LinkedIn: [Osama Sadek](https://www.linkedin.com/in/osama-sadek-9a2951187)

## License

MIT License. See [LICENSE](LICENSE).
