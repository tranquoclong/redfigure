import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    Req,
    Res,
    UseGuards,
    Logger,
    UnauthorizedException,
    NotFoundException,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WebhookSignatureGuard } from '../common/guards/webhook-signature.guard';
import { WebhookSignature } from '../common/decorators/webhook-signature.decorator';
import { WebhookPaymentBodyDTO } from './dto/sepay-webhook.dto';

@Controller('api/v1/payments')
export class PaymentsController {
    private readonly logger = new Logger(PaymentsController.name);

    constructor(
        private readonly paymentsService: PaymentsService,
    ) { }

    // ─── Thông tin phương thức thanh toán ───────────────────────────────────
    // Trả về danh sách phương thức (enabled/disabled, thông tin QR bank).
    @Public()
    @Get('methods')
    async getMethods() {
        return { data: await this.paymentsService.getPaymentMethods() };
    }

    // ─── Tạo payment record (khởi tạo QR/bank info cho người dùng) ──────────
    @Post('create')
    @Throttle({ checkout: { limit: 3, ttl: 60000 } })
    async createPayment(@Body() dto: CreatePaymentDto, @Req() req: Request) {
        const start = Date.now();
        const reqUser = (req as any).user as
            | { id: string; role: string }
            | undefined;
        const userId = reqUser?.id;
        const ip = req.ip || (req.headers['x-forwarded-for'] as string);
        const userAgent = req.headers['user-agent'];

        if (!reqUser?.id || !reqUser?.role) {
            throw new UnauthorizedException('Authentication required');
        }

        try {
            const result = await this.paymentsService.createPayment(
                dto.orderId,
                dto.method,
                { id: reqUser.id, role: reqUser.role },
            );

            return { data: result };
        } catch (err) {
            throw err;
        }
    }

    // ─── SePay Webhook ───────────────────────────────────────────────────────
    // SePay gọi endpoint này khi có giao dịch chuyển khoản mới.
    // Xác thực qua API key trong header: Authorization: Apikey <key>
    // https://docs.sepay.vn/tich-hop-webhooks.html
    @Public()
    @UseGuards(WebhookSignatureGuard)
    @WebhookSignature('sepay')
    @Post('webhook/sepay')
    async sepayWebhook(@Body() body: WebhookPaymentBodyDTO) {
        const start = Date.now();
        try {
            const result = await this.paymentsService.processSepayWebhook(body);
            return result;
        } catch (err) {
            throw err;
        }
    }

    // ─── QR code PNG cho email ───────────────────────────────────────────────
    // @Public()
    // @Throttle({ short: { limit: 60, ttl: 60_000 } })
    // @Get(':orderId/pix-qr.png')
    // async getPixQrPng(
    //     @Param('orderId') orderId: string,
    //     @Res() res: Response,
    // ): Promise<void> {
    //     const result = await this.paymentsService.getPixQrPng(orderId);
    //     if (result.status === 'NOT_FOUND') {
    //         throw new NotFoundException('QR code not found');
    //     }
    //     res.setHeader('Content-Type', 'image/png');
    //     res.setHeader('Content-Length', String(result.png.length));
    //     res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');
    //     res.setHeader('X-Content-Type-Options', 'nosniff');
    //     res.send(result.png);
    // }

    // ─── Trạng thái payment ──────────────────────────────────────────────────
    @Get(':orderId/status')
    async getPaymentStatus(
        @Param('orderId') orderId: string,
        @CurrentUser() user: { id: string; role: string },
    ) {
        const result = await this.paymentsService.getPaymentStatus(orderId, user);
        this.logger.log(
            `Payment status check: order=${orderId} status=${result?.status ?? 'not_found'} method=${result?.method ?? '-'}`,
        );
        return { data: result };
    }

    // ─── Admin ───────────────────────────────────────────────────────────────
    @Roles('ADMIN')
    @Get(':orderId')
    async findByOrder(@Param('orderId') orderId: string) {
        return { data: await this.paymentsService.findByOrderId(orderId) };
    }
}