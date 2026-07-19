import type { Request } from "express";

export type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

export function getRequestMeta(request: Request): RequestMeta {
  return {
    ip: String(request.headers["x-forwarded-for"] ?? request.ip ?? "").split(",")[0].trim(),
    userAgent: String(request.headers["user-agent"] ?? "")
  };
}
