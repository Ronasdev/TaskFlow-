import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { Env } from '../config/env';
import { AuthService, ClientMeta, Session } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { OriginGuard } from './guards/origin.guard';
import { REFRESH_COOKIE, refreshCookieOptions } from './refresh-cookie';

const MINUTE = 60_000;

/**
 * Limite d'une route d'auth, évaluée à chaque requête. THROTTLE_AUTH_MULTIPLIER est validé au
 * démarrage (config/env.ts) et vaut 1 par défaut.
 */
const authLimit = (base: number) => () => base * (Number(process.env.THROTTLE_AUTH_MULTIPLIER) || 1);

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Public()
  @Throttle({ default: { limit: authLimit(3), ttl: MINUTE } })
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.register(dto, clientMeta(req)));
  }

  @Public()
  @Throttle({ default: { limit: authLimit(5), ttl: MINUTE } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.respond(res, await this.auth.login(dto, clientMeta(req)));
  }

  @Public()
  @UseGuards(OriginGuard)
  @Throttle({ default: { limit: authLimit(30), ttl: MINUTE } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      return this.respond(res, await this.auth.refresh(readCookie(req), clientMeta(req)));
    } catch (error) {
      this.clearCookie(res);
      throw error;
    }
  }

  @Public()
  @UseGuards(OriginGuard)
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readCookie(req));
    this.clearCookie(res);
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(204)
  async logoutAll(@CurrentUser('id') userId: string, @Res({ passthrough: true }) res: Response) {
    await this.auth.logoutAll(userId);
    this.clearCookie(res);
  }

  private respond(res: Response, session: Session) {
    res.cookie(REFRESH_COOKIE, session.refreshToken, this.cookieOptions());
    return { accessToken: session.accessToken, user: session.user };
  }

  private clearCookie(res: Response) {
    const { maxAge: _maxAge, ...options } = this.cookieOptions();
    res.clearCookie(REFRESH_COOKIE, options);
  }

  private cookieOptions() {
    return refreshCookieOptions(
      this.config.get('COOKIE_SECURE', { infer: true }),
      this.config.get('REFRESH_TOKEN_TTL_DAYS', { infer: true }),
    );
  }
}

function readCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clientMeta(req: Request): ClientMeta {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}
