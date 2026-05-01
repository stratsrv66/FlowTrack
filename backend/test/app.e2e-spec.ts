import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('FlowTrack E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accessToken: string;
  let projectId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    prisma = app.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await prisma.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
    await app.close();
  });

  describe('Auth', () => {
    it('POST /api/v1/auth/register → 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'e2e@test.com',
          username: 'e2euser',
          displayName: 'E2E User',
          password: 'Test@1234',
        })
        .expect(201);

      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('POST /api/v1/auth/login → 200', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'e2e@test.com', password: 'Test@1234' })
        .expect(200);

      accessToken = res.body.data.accessToken;
      expect(accessToken).toBeDefined();
    });

    it('GET /api/v1/auth/me → 200', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe('e2e@test.com');
    });

    it('GET /api/v1/auth/me → 401 without token', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });

  describe('Projects', () => {
    it('POST /api/v1/projects → creates project', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'E2E Project', key: 'E2E', description: 'End-to-end test project' })
        .expect(201);

      projectId = res.body.data.id;
      expect(res.body.data.key).toBe('E2E');
    });

    it('GET /api/v1/projects → lists projects', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('GET /api/v1/projects/:id → returns project', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.id).toBe(projectId);
    });
  });
});
