import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface RequestWithId {
  id?: string;
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  route?: { path?: string };
  originalUrl?: string;
}

interface ResponseWithHeaders {
  setHeader(name: string, value: string): void;
  statusCode: number;
  once(event: 'finish', listener: () => void): void;
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggingMiddleware.name);

  use(request: RequestWithId, response: ResponseWithHeaders, next: () => void): void {
    const requestIdHeader = request.headers['x-request-id'];
    const requestId =
      typeof requestIdHeader === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(requestIdHeader)
        ? requestIdHeader
        : randomUUID();
    const startedAt = Date.now();
    request.id = requestId;
    response.setHeader('x-request-id', requestId);
    response.once('finish', () => {
      this.logger.log(
        JSON.stringify({
          event: 'http_request',
          requestId,
          method: request.method,
          route: request.route?.path ?? request.originalUrl?.split('?')[0],
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        }),
      );
    });
    next();
  }
}
