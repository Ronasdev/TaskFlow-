import { IsOptional, IsString, Length } from 'class-validator';
import { Trim } from '../../common/utils/strings';

export class UpdateProfileDto {
  @IsOptional()
  @Trim()
  @IsString()
  @Length(1, 100, { message: 'Le nom doit contenir entre 1 et 100 caractères' })
  name?: string;
}
