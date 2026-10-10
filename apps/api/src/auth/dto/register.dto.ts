import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { NormalizeEmail, Trim } from '../../common/utils/strings';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Email invalide' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `Le mot de passe doit contenir entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères`,
  })
  @Matches(/[A-Za-z]/, { message: 'Le mot de passe doit contenir au moins une lettre' })
  @Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  password!: string;

  @Trim()
  @IsString()
  @Length(1, 100, { message: 'Le nom doit contenir entre 1 et 100 caractères' })
  name!: string;
}
