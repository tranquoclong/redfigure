import { Injectable } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
// import { MercadoPagoClient } from './mercadopago.client';
import { AbacatePayClient } from './abacatepay.client';
import type { PaymentGateway } from './gateway.interface';

@Injectable()
export class GatewayRouterService {
    constructor(
        private readonly settingsService: SettingsService,
        // private readonly mpClient: MercadoPagoClient,
        private readonly abacateClient: AbacatePayClient,
    ) { }

    /**
     * Resolve which gateway should handle a given payment method
     * based on admin configuration in Settings table.
     * Falls back to MercadoPago if not configured.
     */
    // async getGatewayForMethod(method: string): Promise<PaymentGateway> {
    //     const key = `payment_gateway_${method}`;
    //     const name = (await this.settingsService.get(key)) ?? 'mercadopago';
    //     return this.getGatewayByName(name);
    // }

    /**
     * Get gateway client by name (used by webhook processing
     * where the gateway is already known from the Payment record).
     */
    // getGatewayByName(name: string): PaymentGateway {
    //     if (name === 'abacatepay') return this.abacateClient as PaymentGateway;
    //     return this.mpClient as unknown as PaymentGateway;
    // }
}