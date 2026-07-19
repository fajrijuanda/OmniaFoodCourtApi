import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { ServiceAppModule } from "./service-app.module";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import express from "express";
import helmet from "helmet";
import type { Express } from "express";
import { join } from "path";
import { HttpAdapterHost } from "@nestjs/core";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { TransformInterceptor } from "./common/interceptors/transform.interceptor";

let cachedServer: Express;

async function bootstrap() {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(ServiceAppModule, new ExpressAdapter(expressApp), { bodyParser: false, logger: ["error", "warn"] });

    const config = app.get(ConfigService);
    const origins = (config.get<string>("CORS_ORIGINS") ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    origins.push("http://localhost", "capacitor://localhost", "https://localhost");

    app.enableCors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || origins.includes(requestOrigin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin tidak diizinkan oleh CORS."), false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "x-tenant-id", "x-branch-id", "x-branch-scope"]
    });

    app.use(helmet());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.setGlobalPrefix("api");
    const httpAdapter = app.get(HttpAdapterHost);
    app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
    app.useGlobalInterceptors(new TransformInterceptor());

    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

export default async (req: any, res: any) => {
  const server = await bootstrap();
  server(req, res);
};
