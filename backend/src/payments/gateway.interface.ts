/**
 * Standardized results returned by any payment gateway.
 * PaymentsService works exclusively with these types —
 * gateway-specific quirks (cents vs reais, etc.) are hidden inside each client.
 */

export interface PixParams {
    amount: number; // reais (ex: 115.00)
    description: string;
    externalReference: string; // orderId or orderNumber
    expirationMinutes?: number;
    payer: {
        email: string;
        name?: string;
        cpf?: string;
        phone?: string;
    };
}

export interface CardParams {
    amount: number; // reais
    description: string;
    externalReference: string;
    payer: {
        email: string;
        name?: string;
        cpf?: string;
        phone?: string;
    };
    /** MercadoPago: required (from SDK tokenization). AbacatePay: not used. */
    cardToken?: string;
    installments?: number;
    paymentMethodId?: string; // visa, mastercard, etc.
}

export interface BoletoParams {
    amount: number; // reais
    description: string;
    externalReference: string;
    payer: {
        email: string;
        name?: string;
        cpf?: string;
    };
}

export interface CreatePixResult {
    id: string;
    qrCode: string; // copia-e-cola text
    qrCodeBase64: string; // base64 QR image (data:image/png;base64,...)
    expiresAt: string;
    raw: unknown;
}

export interface CreateCardResult {
    id: string;
    status: string; // APPROVED | PENDING | FAILED
    statusDetail: string;
    cardLastFour: string;
    /** AbacatePay: redirect URL to hosted checkout. MercadoPago: undefined. */
    redirectUrl?: string;
    raw: unknown;
}

export interface CreateBoletoResult {
    id: string;
    boletoUrl: string;
    barcode: string;
    expiresAt: string;
    raw: unknown;
}

export interface GatewayPaymentInfo {
    status: string; // gateway-native status
    amount: number; // reais
    raw: unknown;
}

export interface PaymentGateway {
    /** Unique gateway identifier stored in Payment.gateway */
    readonly name: string;

    createPixPayment(params: PixParams): Promise<CreatePixResult>;
    createCardPayment(params: CardParams): Promise<CreateCardResult>;
    createBoletoPayment?(params: BoletoParams): Promise<CreateBoletoResult>;

    /** Fetch payment status from gateway API (for double-check on webhooks) */
    getPayment(externalId: string): Promise<GatewayPaymentInfo>;

    /** Map gateway-native status string to internal PaymentStatus enum value */
    mapStatus(gatewayStatus: string): string;
}