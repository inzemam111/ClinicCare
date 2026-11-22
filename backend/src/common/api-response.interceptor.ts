import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value && typeof value === 'object' && 'data' in value) {
          return value;
        }
        if (
          value &&
          typeof value === 'object' &&
          'items' in value &&
          'total' in value &&
          'page' in value &&
          'pageSize' in value &&
          Array.isArray(value.items) &&
          typeof value.total === 'number' &&
          typeof value.page === 'number' &&
          typeof value.pageSize === 'number'
        ) {
          return {
            data: value.items,
            meta: {
              pagination: { total: value.total, page: value.page, pageSize: value.pageSize },
            },
          };
        }
        return { data: value ?? null };
      }),
    );
  }
}
