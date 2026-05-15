import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsCccd } from '../../common/decorators/is-cccd.decorator';
import { IsMst } from '../../common/decorators/is-mst.decorator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsCccd()
  cccd?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{10,11}$/, {
    message: 'Phone must have 10 or 11 digits',
  })
  phone?: string;

  @IsOptional()
  @IsMst()
  mst?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  companyName?: string;
}
