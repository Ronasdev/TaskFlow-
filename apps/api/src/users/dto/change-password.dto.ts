import { IsString, Length, Matches } from 'class-validator';
import { PASSWORD_MAX, PASSWORD_MIN } from '../../auth/dto/register.dto';

export class ChangePasswordDto {
  @IsString()
  @Length(1, PASSWORD_MAX)
  currentPassword!: string;

  @IsString()
  @Length(PASSWORD_MIN, PASSWORD_MAX, {
    message: `Le mot de passe doit contenir entre ${PASSWORD_MIN} et ${PASSWORD_MAX} caractères`,
  })
  @Matches(/[A-Za-z]/, { message: 'Le mot de passe doit contenir au moins une lettre' })
  @Matches(/\d/, { message: 'Le mot de passe doit contenir au moins un chiffre' })
  newPassword!: string;
}
