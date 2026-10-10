import { Param, ParseUUIDPipe } from '@nestjs/common';

/** Paramètre de route UUID : un identifiant mal formé répond 400 sans rien révéler. */
export const UuidParam = (name: string) => Param(name, new ParseUUIDPipe());
