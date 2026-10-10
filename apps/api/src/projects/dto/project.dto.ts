import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { IsOptionalNonNull } from '../../common/decorators/optional.decorator';
import { Trim } from '../../common/utils/strings';

export class CreateProjectDto {
  @Trim()
  @IsString()
  @Length(1, 100, { message: 'Le nom doit contenir entre 1 et 100 caractères' })
  name!: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}

export class UpdateProjectDto {
  @IsOptionalNonNull()
  @Trim()
  @IsString()
  @Length(1, 100, { message: 'Le nom doit contenir entre 1 et 100 caractères' })
  name?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(2000)
  description?: string | null;
}
