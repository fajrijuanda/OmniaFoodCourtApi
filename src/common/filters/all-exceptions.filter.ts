import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const reqId = (req as any)['reqId'] || 'unknown';

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      error: {
        code: httpStatus,
        message: exception instanceof HttpException ? exception.getResponse() : 'Internal server error',
        reqId,
        timestamp: new Date().toISOString(),
      }
    };

    if (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(`[${reqId}] Unhandled Exception:`, exception);
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
