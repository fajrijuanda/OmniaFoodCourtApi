import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

export interface Response<T> {
  data: T;
  meta: {
    reqId: string;
    timestamp: string;
  };
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
    const req = context.switchToHttp().getRequest<Request>();
    const reqId = (req as any)['reqId'] || 'unknown';

    return next.handle().pipe(
      map(data => {
        // If the data already contains pagination 'data' and 'nextCursor', merge them.
        if (data && typeof data === 'object' && 'data' in data && 'nextCursor' in data) {
          return {
            ...data,
            meta: {
              reqId,
              timestamp: new Date().toISOString(),
              nextCursor: data.nextCursor
            }
          } as any;
        }

        return {
          data,
          meta: {
            reqId,
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
