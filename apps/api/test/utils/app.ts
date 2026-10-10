import { JwtService } from '@nestjs/jwt';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { Factory } from './factory';

export interface TestContext {
  app: NestExpressApplication;
  prisma: PrismaService;
  factory: Factory;
  /** Requêtes ayant répondu 403 : doit rester vide (« jamais 403 », SECURITY.md §4). */
  forbiddenResponses: string[];
  http: () => ReturnType<typeof request>;
}

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });

  const forbiddenResponses: string[] = [];
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (res.statusCode === 403) forbiddenResponses.push(`${req.method} ${req.originalUrl}`);
    });
    next();
  });

  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const jwt = app.get(JwtService, { strict: false });
  return {
    app,
    prisma,
    factory: new Factory(prisma, jwt),
    forbiddenResponses,
    http: () => request(app.getHttpServer()),
  };
}

export async function closeTestApp(ctx: TestContext | undefined): Promise<void> {
  if (!ctx) return;
  await ctx.app.close();
  expect(ctx.forbiddenResponses).toEqual([]);
}

/** Vide toutes les tables entre les tests. */
export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE notifications, refresh_tokens, tasks, project_members, projects, users RESTART IDENTITY CASCADE`;
}

/** Adresse IP fictive unique : chaque test d'auth a son propre compteur de limitation de débit. */
export const freshIp = () => `10.${rand()}.${rand()}.${rand()}`;
const rand = () => Math.floor(Math.random() * 254) + 1;

export const randomId = () => randomUUID();
