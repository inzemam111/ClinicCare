import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface HttpRequest {
  id?: string;
  method?: string;
  url?: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<HttpRequest>();
    const response = context.getResponse();
    const prismaError =
      exception instanceof Prisma.PrismaClientKnownRequestError ? exception : undefined;
    const prismaStatus =
      prismaError?.code === 'P2002'
        ? HttpStatus.CONFLICT
        : prismaError?.code === 'P2034'
          ? HttpStatus.CONFLICT
          : prismaError?.code === 'P2003' || prismaError?.code === 'P2023'
            ? HttpStatus.BAD_REQUEST
            : prismaError?.code === 'P2025'
              ? HttpStatus.NOT_FOUND
              : undefined;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (prismaStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const responseBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : undefined;
    const prismaMessages: Record<string, string> = {
      P2002: 'A record with the same unique value already exists',
      P2003: 'The request references a missing or invalid record',
      P2023: 'The request contains an invalid identifier',
      P2025: 'Record not found',
      P2034: 'A concurrent update conflicted with this request; retry it',
    };
    const rawMessage =
      responseBody?.message ??
      (typeof exceptionResponse === 'string' ? exceptionResponse : undefined) ??
      (prismaError ? (prismaMessages[prismaError.code] ?? 'Database request failed') : undefined);
    const message = Array.isArray(rawMessage)
      ? rawMessage.join('; ')
      : (rawMessage ?? 'Internal server error');
    const errorCode =
      typeof responseBody?.error === 'string'
        ? responseBody.error.toUpperCase().replace(/\s+/g, '_')
        : `HTTP_${status}`;
    const details = responseBody?.details ?? responseBody?.data;

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        JSON.stringify({
          event: 'http_exception',
          requestId: request.id,
          method: request.method,
          status,
          error: exception instanceof Error ? exception.name : 'UnknownError',
        }),
      );
    }

    response.status(status).json({
      error: { code: errorCode, message, ...(details === undefined ? {} : { details }) },
      requestId: request.id,
    });
  }
}
