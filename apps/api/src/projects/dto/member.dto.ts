import { ProjectRole } from '@prisma/client';
import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { NormalizeEmail } from '../../common/utils/strings';

/** OWNER n'est jamais attribuable : il est unique et fixé à la création du projet (C3). */
export const ASSIGNABLE_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'] as const satisfies ProjectRole[];
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const roleMessage = `Le rôle doit être l'un de : ${ASSIGNABLE_ROLES.join(', ')}`;

export class AddMemberDto {
  @NormalizeEmail()
  @IsEmail({}, { message: 'Email invalide' })
  @MaxLength(254)
  email!: string;

  @IsIn(ASSIGNABLE_ROLES, { message: roleMessage })
  role!: AssignableRole;
}

export class UpdateMemberDto {
  @IsIn(ASSIGNABLE_ROLES, { message: roleMessage })
  role!: AssignableRole;
}
