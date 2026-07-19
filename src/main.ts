import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import * as express from "express";
import { join } from "path";
import { json, urlencoded } from "express";
import { HttpAdapterHost } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ServiceAppModule } from "./service-app.module";

async function bootstrap() {
  const app = await NestFactory.create(ServiceAppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const origins = (config.get<string>("CORS_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Allow Capacitor mobile apps by default
  origins.push("http://localhost", "capacitor://localhost", "https://localhost");


  app.enableCors({
    origin: origins.length > 0 ? origins : (process.env.NODE_ENV === 'production' ? false : true),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-tenant-id", "x-branch-id", "x-branch-scope"]
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));
  app.use('/uploads/hris', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const token = req.headers.authorization?.split(' ')[1] || req.query.token;
    if (!token) {
      res.status(401).json({ message: 'Unauthorized access to sensitive files' });
      return;
    }
    try {
      const jwt = require('jsonwebtoken');
      const secret = config.get('JWT_SECRET');
      if (!secret && process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET is missing in production environment');
      }
      jwt.verify(token, secret || 'fallback_secret');
      next();
    } catch (err) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
  });

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix("api");
  const httpAdapter = app.get(HttpAdapterHost);
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  app.useGlobalInterceptors(new TransformInterceptor());


  await app.listen(Number(config.get("PORT") ?? 4000));
}

bootstrap();
