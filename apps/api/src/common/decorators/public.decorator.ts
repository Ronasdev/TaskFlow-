import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Exempte une route du JwtAuthGuard global. Toute route est protégée par défaut. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
