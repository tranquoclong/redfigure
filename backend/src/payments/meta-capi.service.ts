import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    ServerEvent,
    EventRequest,
    UserData,
    CustomData,
} from 'facebook-nodejs-business-sdk';
import { PrismaService } from '../prisma/prisma.service';
import { captureFailOpen } from '../observability/fail-open-capture';

interface ShippingAddress {
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
}

/**
 * Meta Conversions API service.
 *
 * Sends server-side `Purchase` events to the Meta Pixel for deduplication
 * with the client-side Pixel. The shared event_id is `purchase_<orderNumber>`,
 * which the frontend tracker (PurchaseTracker) must use as well.
 *
 * Fire-and-forget: never throws — failures are logged so the webhook handler
 * can return 200 to Mercado Pago regardless of CAPI availability.
 *
 * No-op when META_ACCESS_TOKEN or META_PIXEL_ID are not configured (e.g. in
 * dev / test environments without a Pixel set up).
 */
@Injectable()
export class MetaCapiService {
    private readonly logger = new Logger(MetaCapiService.name);
    private readonly accessToken?: string;
    private readonly pixelId?: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        this.accessToken = this.config.get<string>('META_ACCESS_TOKEN');
        this.pixelId = this.config.get<string>('META_PIXEL_ID');
    }

    async sendPurchaseEvent(orderId: string): Promise<void> {
        if (!this.accessToken || !this.pixelId) {
            // No Pixel configured — silently skip
            return;
        }

        try {
            const order = await this.prisma.order.findUnique({
                where: { id: orderId },
                include: { user: true, items: true },
            });

            if (!order) {
                this.logger.warn(`CAPI: order ${orderId} not found`);
                return;
            }

            const event = this.buildPurchaseEvent(order);
            const request = new EventRequest(this.accessToken, this.pixelId);
            await request.setEvents([event]).execute();
        } catch (err) {
            this.logger.error(
                `CAPI Purchase failed for order ${orderId}: ${err instanceof Error ? err.message : String(err)
                }`,
            );
            captureFailOpen(err, 'meta_capi_purchase', { orderId });
        }
    }

    private buildPurchaseEvent(order: any): ServerEvent {
        const userData = this.buildUserData(order);
        const customData = this.buildCustomData(order);

        return new ServerEvent()
            .setEventName('Purchase')
            .setEventTime(Math.floor(Date.now() / 1000))
            .setEventId(`purchase_${order.number}`)
            .setActionSource('website')
            .setUserData(userData)
            .setCustomData(customData);
    }

    private buildUserData(order: any): UserData {
        const userData = new UserData();
        const user = order.user;

        if (user?.email) userData.setEmail(user.email);
        if (user?.phone) userData.setPhone(user.phone);
        if (user?.id) userData.setExternalId(user.id);

        if (user?.name) {
            const parts = String(user.name).trim().split(/\s+/);
            const first = parts[0];
            const last = parts.slice(1).join(' ');
            if (first) userData.setFirstName(first);
            if (last) userData.setLastName(last);
        }

        const address = this.parseShippingAddress(order.shippingAddress);
        if (address) {
            if (address.city) userData.setProvince(address.city);
            if (address.state) userData.setDistrict(address.state);
            if (address.postalCode) userData.setZip(address.postalCode);
            if (address.country) userData.setCountry(address.country);
        }

        return userData;
    }

    private buildCustomData(order: any): CustomData {
        const items: Array<{
            productId: string;
            variationId?: string | null;
            quantity: number;
        }> = order.items ?? [];

        const contentIds = items.map((it) =>
            it.variationId ? `${it.productId}-${it.variationId}` : it.productId,
        );
        const numItems = items.reduce((sum, it) => sum + (it.quantity ?? 0), 0);

        const customData = new CustomData()
            .setValue(order.total)
            .setCurrency('BRL')
            .setOrderId(order.number)
            .setContentIds(contentIds)
            .setNumItems(numItems);

        return customData;
    }

    private parseShippingAddress(raw: unknown): ShippingAddress | null {
        if (!raw || typeof raw !== 'string') return null;
        try {
            return JSON.parse(raw) as ShippingAddress;
        } catch {
            this.logger.warn('CAPI: failed to parse shippingAddress JSON');
            return null;
        }
    }
}