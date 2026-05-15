import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRuleSetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}

export class UpdateRuleSetDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}

export class CreateRuleItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsNumber()
  @Min(-100)
  @Max(1000)
  percentageIncrease!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class UpdateRuleItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(-100)
  @Max(1000)
  percentageIncrease?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  sortOrder?: number;
}

export class ReorderRuleItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  itemIds!: string[];
}
