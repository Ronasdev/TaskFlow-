import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

export const NOT_FOUND_MESSAGE = 'Ressource introuvable';
export const ASSIGNEE_NOT_MEMBER_MESSAGE = 'La personne assignée doit être membre du projet';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: unknown;
  requestId?: string;
}

/**
 * Point unique de traduction des erreurs en réponses HTTP.
 * - Tous les 404 ont exactement le même corps : une ressource inaccessible est indiscernable
 *   d'une ressource inexistante (SECURITY.md §4).
 * - Les erreurs Prisma connues sont traduites (P2025 → 404, P2002 → 409, FK assignee → 422).
 * - Toute autre erreur répond 500 générique ; le détail ne part que dans les logs.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { statusCode, message } = this.resolve(exception);
    if (statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const body: ErrorBody = {
      statusCode,
      error: httpErrorName(statusCode),
      message,
      requestId: typeof request.id === 'string' ? request.id : undefined,
    };
    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): { statusCode: number; message: unknown } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      if (statusCode === HttpStatus.NOT_FOUND) {
        return { statusCode, message: NOT_FOUND_MESSAGE };
      }
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload as { message: unknown }).message
          : payload;
      return { statusCode, message };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2025':
          return { statusCode: HttpStatus.NOT_FOUND, message: NOT_FOUND_MESSAGE };
        case 'P2002':
          return { statusCode: HttpStatus.CONFLICT, message: 'Cette ressource existe déjà' };
        case 'P2003':
          // Selon la version de Prisma : meta.constraint ou meta.field_name
          if (
            /tasks_assignee_fkey/.test(
              `${exception.meta?.constraint} ${exception.meta?.field_name}`,
            )
          ) {
            return {
              statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
              message: ASSIGNEE_NOT_MEMBER_MESSAGE,
            };
          }
          break;
      }
    }

    return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Erreur interne du serveur' };
  }
}

function httpErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    404: 'Not Found',
    409: 'Conflict',
    413: 'Payload Too Large',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };
  return names[statusCode] ?? 'Error';
}
