import {
    IsString,
    IsNotEmpty,
    IsIn,
    Matches,
} from 'class-validator';

export class CreatePaymentDto {
    @IsString()
    @IsNotEmpty()
    @Matches(/^c[a-z0-9]{20,29}$/, { message: 'orderId must be a valid cuid' })
    orderId!: string;

    @IsString()
    @IsIn(['bank_transfer'])
    method!: string;
}