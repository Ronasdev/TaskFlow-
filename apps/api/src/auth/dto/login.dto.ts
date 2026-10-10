import { IsEmail, IsString, Length, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/utils/strings';
import { PASSWORD_MAX } from './register.dto';

export class LoginDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Email invalide' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(1, PASSWORD_MAX)
  password!: string;
}
