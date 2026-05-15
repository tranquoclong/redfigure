import {
    IsNumber,
    IsString,
    IsEnum,
    IsOptional,
    IsNotEmpty,
} from 'class-validator';

/**
 * DTO webhook body từ SePay sử dụng class-validator.
 * Tham khảo: https://docs.sepay.vn/tich-hop-webhooks.html
 */
export class WebhookPaymentBodyDTO {
    @IsNumber()
    @IsNotEmpty()
    id!: number; // ID giao dịch trên SePay

    @IsString()
    @IsNotEmpty()
    gateway!: string; // Brand name của ngân hàng (VD: "MB Bank")

    @IsString()
    @IsNotEmpty()
    transactionDate!: string; // Thời gian giao dịch

    @IsString()
    @IsOptional()
    accountNumber?: string | null; // Số tài khoản ngân hàng

    @IsString()
    @IsOptional()
    code?: string | null; // Mã code thanh toán (SePay tự nhận diện)

    @IsString()
    @IsOptional()
    content?: string | null; // Nội dung chuyển khoản

    @IsEnum(['in', 'out'])
    transferType!: 'in' | 'out'; // in = tiền vào, out = tiền ra

    @IsNumber()
    @IsNotEmpty()
    transferAmount!: number; // Số tiền giao dịch

    @IsNumber()
    @IsNotEmpty()
    accumulated!: number; // Số dư tài khoản (lũy kế)

    @IsString()
    @IsOptional()
    subAccount?: string | null; // Tài khoản ngân hàng phụ

    @IsString()
    @IsOptional()
    referenceCode?: string | null; // Mã tham chiếu tin nhắn sms

    @IsString()
    @IsNotEmpty()
    description!: string; // Toàn bộ nội dung tin nhắn sms
}
