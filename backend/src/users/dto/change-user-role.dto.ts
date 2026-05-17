import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ChangeUserRoleDto {
    @IsEnum(['ADMIN', 'CUSTOMER'] as const, {
        message: 'role must be ADMIN or CUSTOMER',
    })
    role!: 'ADMIN' | 'CUSTOMER';

    @IsOptional()
    @IsString()
    @MaxLength(500)
    reason?: string;
}