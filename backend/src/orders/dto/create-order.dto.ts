import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ArrayMaxSize,
  ValidateNested,
  IsNumber,
  IsInt,
  Min,
  Max,
  MaxLength,
  Length,
  Matches,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class OrderItemDto {

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  variationId?: string;

  @IsOptional()
  @IsString()
  scaleId?: string;

  @IsOptional()
  @IsString()
  quoteItemId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^c[a-z0-9]{20,29}$/, { message: 'Invalid freeGiftId' })
  freeGiftId?: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class ShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  recipient!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'postalCode must be exactly 8 digits' })
  postalCode!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  street!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  ward!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  district!: string;

  @IsString()
  @MaxLength(80)
  province!: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class CreateOrderDto {

  @IsArray()
  @ArrayMaxSize(50, { message: 'Maximum 50 distinct items per order' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  shipping?: number;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;

  @IsOptional()
  @IsString()
  shippingCarrier?: string;

  @IsOptional()
  @IsString()
  shippingServiceName?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  shippingServiceId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  shippingDeadlineDays?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  couponCodes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  estimatedDeliveryDate?: string;
}
