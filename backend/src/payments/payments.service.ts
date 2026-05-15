import {
    Injectable,
    Inject,
    forwardRef,
    NotFoundException,
    ForbiddenException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { StockService } from '../stock/stock.service';
import { OrderExpirationService } from '../orders/order-expiration.service';
import { MetaCapiService } from './meta-capi.service';
import { SettingsService } from '../settings/settings.service';
import { CheckoutLogService } from './checkout-log.service';
import { EmailQueueService } from '../email/email-queue.service';
import { AffiliateCommissionService } from '../affiliates/affiliate-commission.service';
import { captureFailOpen } from '../observability/fail-open-capture';
import { RedisService } from '../redis/redis.service';
import { ProductsService } from '../products/products.service';
import { WebhookPaymentBodyDTO } from './dto/sepay-webhook.dto';

const PREFIX_PAYMENT_CODE = 'DH';
/** Phương thức thanh toán — chỉ hỗ trợ chuyển khoản ngân hàng qua SePay */
const PAYMENT_METHODS = [
    { id: 'bank_transfer', label: 'Chuyển khoản ngân hàng' },
    { id: 'cod', label: 'Thanh toán khi nhận hàng (COD)' },
] as const;

export type PaymentMethodSummary = {
    id: string;
    label: string;
    enabled: boolean;
    bankInfo?: {
        bankName?: string;
        accountNumber?: string;
        accountName?: string;
    };
};

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);

    constructor(
        private prisma: PrismaService,
        private stockService: StockService,
        @Inject(forwardRef(() => OrderExpirationService))
        private orderExpirationService: OrderExpirationService,
        private metaCapi: MetaCapiService,
        private settingsService: SettingsService,
        private checkoutLog: CheckoutLogService,
        private emailQueue: EmailQueueService,
        private affiliateCommissionService: AffiliateCommissionService,
        private redis: RedisService,
        private productsService: ProductsService,
    ) { }

    // ─── Email helpers ───────────────────────────────────────────────────────

    private async buildOrderEmailBase(orderId: string): Promise<{
        to: string;
        customerName: string;
        orderNumber: string;
        orderId: string;
        items: Array<{
            name: string;
            sku?: string;
            imageUrl?: string;
            variationLabel?: string;
            variationName?: string;
            scaleName?: string;
            scaleExtraPrice?: number;
            productionDays?: number;
            isFreeGift?: boolean;
            quantity: number;
            price: number;
        }>;
        summary: {
            subtotal: number;
            discount: number;
            couponLabels?: string;
            paymentDiscount: number;
            paymentMethod: string;
            shipping: number;
            shippingCarrier?: string;
            shippingServiceName?: string;
            shippingDeadlineDays?: number;
            estimatedDeliveryDate?: Date;
            total: number;
            trackingCode?: string;
            trackingUrl?: string;
        };
        total: number;
    } | null> {
        const order = (await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { email: true, name: true } },
                items: {
                    select: {
                        productId: true,
                        productName: true,
                        productSku: true,
                        productImage: true,
                        variationLabel: true,
                        variationName: true,
                        scaleName: true,
                        scalePercentage: true,
                        isFreeGift: true,
                        quantity: true,
                        price: true,
                        parentOrderItemId: true,
                    },
                },
                coupons: {
                    select: { coupon: { select: { code: true } } },
                },
            },
        } as any)) as any;
        const email = order?.user?.email ?? order?.customerEmail;
        if (!order || !email) return null;

        const productionDaysByIndex = await Promise.all(
            (order.items ?? []).map(
                async (i: { productId: string | null }): Promise<number> =>
                    i.productId
                        ? await this.productsService.resolveExtraDays(i.productId)
                        : 0,
            ),
        );

        type RawItem = {
            productId: string | null;
            productName: string | null;
            productSku: string | null;
            productImage: string | null;
            variationLabel: string | null;
            variationName: string | null;
            scaleName: string | null;
            scalePercentage: number | null;
            isFreeGift: boolean;
            quantity: number;
            price: number;
        };

        const items = (order.items ?? []).map((i: RawItem, idx: number) => {
            let scaleExtraPrice: number | undefined;
            if (i.scalePercentage && i.scalePercentage > 0) {
                const base = i.price / (1 + i.scalePercentage / 100);
                scaleExtraPrice = Math.round((i.price - base) * 100) / 100;
            }
            const days = productionDaysByIndex[idx];
            return {
                name: i.productName ?? 'Sản phẩm',
                sku: i.productSku ?? undefined,
                imageUrl: i.productImage ?? undefined,
                variationLabel: i.variationLabel ?? undefined,
                variationName: i.variationName ?? undefined,
                scaleName: i.scaleName ?? undefined,
                scaleExtraPrice,
                productionDays: days > 0 ? days : undefined,
                isFreeGift: i.isFreeGift,
                quantity: i.quantity,
                price: i.price,
            };
        });

        const couponLabels: string | undefined =
            (order.coupons?.length ?? 0) > 0
                ? order.coupons
                    .map(
                        (c: { coupon: { code: string } | null }) =>
                            c.coupon?.code ?? null,
                    )
                    .filter((s: string | null): s is string => !!s)
                    .join(', ') || undefined
                : undefined;

        const summary = {
            subtotal: order.subtotal,
            discount: order.discount,
            couponLabels,
            paymentDiscount: 0,
            paymentMethod: order.paymentMethod ?? 'bank_transfer',
            shipping: order.shipping,
            shippingCarrier: order.shippingCarrier ?? undefined,
            shippingServiceName: order.shippingServiceName ?? undefined,
            shippingDeadlineDays: order.shippingDeadlineDays ?? undefined,
            estimatedDeliveryDate: order.estimatedDeliveryDate ?? undefined,
            total: order.total,
            trackingCode: order.trackingCode ?? undefined,
            trackingUrl: order.trackingUrl ?? undefined,
        };

        return {
            to: email,
            customerName: order.customerName ?? order.user?.name ?? 'Khách hàng',
            orderNumber: order.number,
            orderId: order.id,
            items,
            summary,
            total: order.total,
        };
    }

    private fireAndForget(promise: Promise<unknown>, context: string): void {
        void promise.catch((err) => {
            this.logger.error(
                `Email dispatch failed (${context}): ${err instanceof Error ? err.message : String(err)}`,
            );
        });
    }

    private dispatchMetaPurchase(orderId: string): void {
        void this.metaCapi.sendPurchaseEvent(orderId).catch((err) => {
            this.logger.error(
                `Meta CAPI dispatch failed for order ${orderId}: ${err instanceof Error ? err.message : String(err)}`,
            );
        });
    }

    // ─── Payment methods ─────────────────────────────────────────────────────

    /**
     * Trả về danh sách phương thức thanh toán với thông tin ngân hàng SePay.
     */
    async getPaymentMethods(): Promise<PaymentMethodSummary[]> {
        const [bankEnabledRaw, codEnabledRaw, bankName, accountNumber, accountName] =
            await Promise.all([
                this.settingsService.get('payment_method_bank_transfer_enabled'),
                this.settingsService.get('payment_method_cod_enabled'),
                this.settingsService.get('sepay_bank_name'),
                this.settingsService.get('sepay_account_number'),
                this.settingsService.get('sepay_account_name'),
            ]);

        const bankEnabled =
            bankEnabledRaw === null ? true : bankEnabledRaw !== 'false';
        const codEnabled =
            codEnabledRaw === null ? true : codEnabledRaw !== 'false';

        return PAYMENT_METHODS.map((m) => {
            if (m.id === 'bank_transfer') {
                return {
                    id: m.id,
                    label: m.label,
                    enabled: bankEnabled,
                    bankInfo: {
                        bankName: bankName ?? undefined,
                        accountNumber: accountNumber ?? undefined,
                        accountName: accountName ?? undefined,
                    },
                };
            }
            return {
                id: m.id,
                label: m.label,
                enabled: codEnabled,
            };
        });
    }

    // ─── Create payment ──────────────────────────────────────────────────────

    /**
     * Tạo payment record PENDING cho đơn hàng.
     * Với SePay (chuyển khoản), không cần gọi external API —
     * chỉ tạo record local và trả về thông tin ngân hàng + nội dung chuyển khoản.
     */
    async createPayment(
        orderId: string,
        method: string,
        caller: { id: string; role: string },
    ) {
        // Mutex Redis — tránh double-create cho cùng orderId
        const lockKey = `payment:create:${orderId}`;
        const lockValue = randomUUID();
        const acquired = await this.redis.setNX(lockKey, lockValue, 60);
        if (!acquired) {
            throw new ConflictException(
                'Thanh toán đang được xử lý cho đơn hàng này. Vui lòng đợi.',
            );
        }
        try {
            return await this.createPaymentLocked(orderId, method, caller);
        } finally {
            await this.redis.releaseLock(lockKey, lockValue);
        }
    }

    private async createPaymentLocked(
        orderId: string,
        method: string,
        caller: { id: string; role: string },
    ) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { user: true },
        });

        if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

        // Kiểm tra ownership
        if (caller.role !== 'ADMIN' && caller.id !== order.userId) {
            throw new ForbiddenException(
                'Bạn không có quyền thanh toán đơn hàng này',
            );
        }

        this.logger.log(
            `createPayment START: order=${orderId} method=${method} total=${order.total}`,
        );

        // Kiểm tra payment đã tồn tại
        const existing = await this.prisma.payment.findFirst({
            where: { orderId, status: { in: ['PENDING', 'APPROVED'] } },
        });

        if (existing) {
            this.logger.log(
                `Reconciliation: found existing payment=${existing.id} status=${existing.status}`,
            );
            if (existing.status === 'APPROVED') {
                return existing;
            }
            // PENDING → trả về payment hiện tại kèm thông tin ngân hàng
            return this.attachBankInfo(existing);
        }

        // Tạo payment record mới
        const payment = await this.prisma.payment.create({
            data: {
                orderId,
                method,
                gateway: method === 'cod' ? 'cod' : 'sepay',
                amount: order.total,
                discount: 0,
                status: 'PENDING',
            },
        });

        this.logger.log(
            `Payment created: id=${payment.id} amount=${payment.amount} gateway=${payment.gateway}`,
        );

        // Gửi email hướng dẫn chuyển khoản
        // const base = await this.buildOrderEmailBase(orderId);
        // if (base) {
        //     this.fireAndForget(
        //         this.emailQueue.enqueuePixPending({
        //             ...base,
        //             pixQrBase64: '',
        //             pixCopyPaste: `${PREFIX_PAYMENT_CODE}${payment.id}`,
        //             expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        //             expirationMinutes: 1440,
        //         }),
        //         `bank-transfer-pending order=${orderId}`,
        //     );
        // }

        return this.attachBankInfo(payment);
    }

    /**
     * Đính kèm thông tin ngân hàng vào payment response.
     */
    private async attachBankInfo(payment: any) {
        if (payment.method === 'cod') {
            return {
                ...payment,
                message: 'Vui lòng chuẩn bị sẵn tiền mặt khi nhận hàng.',
            };
        }

        return {
            ...payment,
            qr: `https://qr.sepay.vn/img?acc=0010000000355&bank=Vietcombank&amount=${payment.amount}&des=${PREFIX_PAYMENT_CODE}${payment.id}`,
        };
    }

    // ─── SePay Webhook ───────────────────────────────────────────────────────

    /**
     * Xử lý webhook từ SePay khi có giao dịch chuyển khoản vào tài khoản.
     *
     * Flow:
     * 1. Bỏ qua nếu là tiền ra (transferType = 'out')
     * 2. Kiểm tra trùng lặp giao dịch qua SePay transaction ID (trong PaymentEvent)
     * 3. Tìm Payment từ prefix code trong nội dung giao dịch
     * 4. Kiểm tra số tiền khớp (tolerance 1 VND)
     * 5. Cập nhật Payment + Order trong DB transaction
     * 6. Chạy side effects: stock, expiration, email, affiliate, Meta CAPI
     *
     * @see https://docs.sepay.vn/tich-hop-webhooks.html
     */
    async processSepayWebhook(body: WebhookPaymentBodyDTO): Promise<{ message: string }> {
        this.logger.log(
            `processSepayWebhook: sepay_id=${body.id} amount=${body.transferAmount} type=${body.transferType} gateway=${body.gateway}`,
        );

        // Chỉ xử lý tiền vào
        if (body.transferType !== 'in') {
            this.logger.log(`SePay webhook skipped: transferType=${body.transferType}`);
            return { message: 'Skipped: not an incoming transfer' };
        }

        // Dedup: kiểm tra SePay transaction ID đã xử lý chưa (qua externalId unique)
        const existingPayment = await this.prisma.payment.findFirst({
            where: { externalId: String(body.id) },
        });
        if (existingPayment) {
            this.logger.log(`SePay webhook duplicate: sepay_id=${body.id} already linked to payment ${existingPayment.id}`);
            return { message: 'Transaction already processed' };
        }

        // Tìm paymentId từ body.code hoặc body.content
        const rawCode = body.code ?? body.content ?? '';
        const codeIdx = rawCode.indexOf(PREFIX_PAYMENT_CODE);
        if (codeIdx === -1) {
            this.logger.warn(
                `SePay webhook: prefix "${PREFIX_PAYMENT_CODE}" not found in code="${body.code}" content="${body.content}"`,
            );
            // Ghi log nhưng không throw — SePay có thể gửi giao dịch không liên quan
            return { message: 'Payment code not found in transfer content' };
        }

        const paymentId = rawCode.slice(codeIdx + PREFIX_PAYMENT_CODE.length);
        if (!paymentId) {
            this.logger.warn(`SePay webhook: empty paymentId extracted from "${rawCode}"`);
            return { message: 'Invalid payment code' };
        }

        // Tìm Payment trong DB
        const payment = await this.prisma.payment.findUnique({
            where: { id: paymentId },
        });

        if (!payment) {
            this.logger.warn(`SePay webhook: payment not found for id="${paymentId}" — ignoring unmatched transaction`);
            return { message: 'Payment not found' };
        }

        // Ghi PaymentEvent (audit log)
        await this.prisma.paymentEvent.create({
            data: {
                paymentId: payment.id,
                orderId: payment.orderId,
                type: 'sepay_webhook',
                rawData: body as any,
                gatewayStatus: body.transferType,
            },
        });

        if (payment.status === 'APPROVED') {
            this.logger.log(`SePay webhook: payment ${paymentId} already APPROVED — skipping`);
            return { message: 'Payment already approved' };
        }

        // Kiểm tra số tiền (tolerance 1 VND)
        if (Math.abs(payment.amount - body.transferAmount) > 1) {
            this.logger.error(
                `SePay webhook: amount mismatch for payment ${paymentId}. Expected ${payment.amount}, got ${body.transferAmount}`,
            );
            throw new BadRequestException(
                `Số tiền không khớp: cần ${payment.amount} VNĐ nhưng nhận ${body.transferAmount} VNĐ`,
            );
        }

        // Parse ngày giao dịch
        let transactionDate = new Date(body.transactionDate.replace(' ', 'T'));
        if (isNaN(transactionDate.getTime())) {
            transactionDate = new Date();
        }

        // Cập nhật Payment + Order trong transaction
        const { orderId } = await this.prisma.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: paymentId },
                data: {
                    status: 'APPROVED',
                    paidAt: transactionDate,
                    paidAmount: body.transferAmount,
                    externalId: String(body.id),
                    webhookData: JSON.stringify(body),
                },
            });

            await tx.order.update({
                where: { id: payment.orderId },
                data: { paymentStatus: 'APPROVED' },
            });

            return { orderId: payment.orderId };
        });

        this.logger.log(`SePay webhook: payment ${paymentId} APPROVED for order ${orderId}`);

        // Side effects sau commit
        try {
            await this.stockService.confirmReservation(orderId);
        } catch (err) {
            captureFailOpen(err, 'sepay_webhook_confirm_stock', { orderId });
            this.logger.error(`Failed to confirm stock for order ${orderId}: ${err}`);
        }

        try {
            await this.orderExpirationService.cancelExpiration(orderId);
        } catch (err) {
            captureFailOpen(err, 'sepay_webhook_cancel_expiration', { orderId });
        }

        this.dispatchMetaPurchase(orderId);

        this.fireAndForget(
            this.affiliateCommissionService.createForOrder(orderId),
            `affiliate-commission sepay order=${orderId}`,
        );

        const base = await this.buildOrderEmailBase(orderId);
        if (base) {
            this.fireAndForget(
                this.emailQueue.enqueuePaymentApproved({
                    ...base,
                    paymentMethod: 'bank_transfer',
                }),
                `payment-approved sepay order=${orderId}`,
            );
        }

        return { message: 'Payment received successfully' };
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    async findByOrderId(orderId: string) {
        return this.prisma.payment.findFirst({
            where: { orderId },
        });
    }

    // async getPixQrPng(
    //     _orderId: string,
    // ): Promise<{ status: 'NOT_FOUND' }> {
    //     return { status: 'NOT_FOUND' };
    // }

    async getPaymentStatus(orderId: string, user?: { id: string; role: string }) {
        if (user) {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                select: { userId: true },
            });
            if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
            if (user.role !== 'ADMIN' && order.userId !== user.id) {
                throw new ForbiddenException('Không có quyền truy cập');
            }
        }

        const payment = await this.prisma.payment.findFirst({
            where: { orderId },
            select: {
                id: true,
                orderId: true,
                status: true,
                method: true,
                gateway: true,
                amount: true,
                discount: true,
                expiresAt: true,
                paidAt: true,
            },
        });

        if (!payment) return null;

        // Đính kèm thông tin ngân hàng nếu đang PENDING
        if (payment.status === 'PENDING') {
            return this.attachBankInfo(payment);
        }

        return payment;
    }
}