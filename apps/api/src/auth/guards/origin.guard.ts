import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { Env } from '../../config/env';

/**
 * Protection CSRF des routes authentifiées par cookie (refresh, logout) :
 * un en-tête Origin présent doit appartenir à la liste CORS_ORIGINS (SECURITY.md §2.4).
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const origin = context.switchToHttp().getRequest<Request>().headers.origin;
    if (origin && !this.config.get('CORS_ORIGINS', { infer: true }).includes(origin)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
