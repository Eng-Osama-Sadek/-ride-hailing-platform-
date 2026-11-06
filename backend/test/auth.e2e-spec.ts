/**
 * Auth E2E — needs the real PostgreSQL + Redis from docker compose:
 *   docker compose exec backend npm run test:e2e
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

const CODE = process.env.MOCK_OTP_CODE ?? '123456';
const randomPhone = () => `+2010${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public and healthy', async () => {
    const res = await http.get('/api/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up', redis: 'up' });
  });

  it('protects private routes by default (401 without a token)', async () => {
    await http.get('/api/v1/auth/me').expect(401);
  });

  it('rejects ADMIN as an OTP role (admins use email + password only)', async () => {
    await http.post('/api/v1/auth/otp/request').send({ phone: randomPhone(), role: 'ADMIN' }).expect(400);
  });

  it('rider flow: request OTP -> wrong code -> verify -> me -> refresh -> reuse detection', async () => {
    const phone = randomPhone();

    await http.post('/api/v1/auth/otp/request').send({ phone, role: 'RIDER' }).expect(200);

    await http.post('/api/v1/auth/otp/verify').send({ phone, role: 'RIDER', code: '000000' }).expect(401);

    const login = await http
      .post('/api/v1/auth/otp/verify')
      .send({ phone, role: 'RIDER', code: CODE })
      .expect(200);
    expect(login.body).toMatchObject({ isNewUser: true, user: { phone, role: 'RIDER', status: 'ACTIVE' } });
    const { accessToken, refreshToken } = login.body;

    const me = await http.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
    expect(me.body.phone).toBe(phone);

    // rotation
    const refreshed = await http.post('/api/v1/auth/refresh').send({ refreshToken }).expect(200);
    expect(refreshed.body.refreshToken).not.toBe(refreshToken);

    // replaying the OLD token => 401 and the whole family dies
    await http.post('/api/v1/auth/refresh').send({ refreshToken }).expect(401);
    await http.post('/api/v1/auth/refresh').send({ refreshToken: refreshed.body.refreshToken }).expect(401);
  });

  it('driver signs up as PENDING_KYC', async () => {
    const phone = randomPhone();
    await http.post('/api/v1/auth/otp/request').send({ phone, role: 'DRIVER' }).expect(200);
    const res = await http.post('/api/v1/auth/otp/verify').send({ phone, role: 'DRIVER', code: CODE }).expect(200);
    expect(res.body.user.status).toBe('PENDING_KYC');
  });

  it('logout revokes the session', async () => {
    const phone = randomPhone();
    await http.post('/api/v1/auth/otp/request').send({ phone, role: 'RIDER' }).expect(200);
    const { body } = await http.post('/api/v1/auth/otp/verify').send({ phone, role: 'RIDER', code: CODE }).expect(200);

    await http.post('/api/v1/auth/logout').send({ refreshToken: body.refreshToken }).expect(204);
    await http.post('/api/v1/auth/refresh').send({ refreshToken: body.refreshToken }).expect(401);
  });

  it('admin login rejects wrong credentials', async () => {
    await http
      .post('/api/v1/auth/admin/login')
      .send({ email: 'nobody@ridehailing.local', password: 'wrong-password' })
      .expect(401);
  });
});
