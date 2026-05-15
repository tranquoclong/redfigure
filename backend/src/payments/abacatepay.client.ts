import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsService } from '../settings/settings.service';
import type {
    PaymentGateway,
    PixParams,
    CardParams,
    BoletoParams,
    CreatePixResult,
    CreateCardResult,
    CreateBoletoResult,
    GatewayPaymentInfo,
} from './gateway.interface';

const BASE_URL = 'https://api.abacatepay.com';

const STATUS_MAP: Record<string, string> = {
    PENDING: 'PENDING',
    PAID: 'APPROVED',
    EXPIRED: 'CANCELLED',
    CANCELLED: 'CANCELLED',
    REFUNDED: 'CANCELLED',
};

@Injectable()
export class AbacatePayClient implements PaymentGateway {
    readonly name = 'abacatepay' as const;
    private readonly logger = new Logger(AbacatePayClient.name);
    private readonly siteUrl: string;

    constructor(
        private readonly settingsService: SettingsService,
        private readonly configService: ConfigService,
    ) {
        this.siteUrl =
            this.configService.get<string>('SITE_URL') ?? 'https://elitepinup.com.br';
    }

    private async getApiKey(): Promise<string> {
        const encrypted = await this.settingsService.get('abacatepay_api_key');
        if (!encrypted) {
            throw new BadRequestException(
                'AbacatePay não configurado. Adicione a API key nas configurações.',
            );
        }
        return this.settingsService.decrypt(encrypted);
    }

    private async request<T>(
        method: 'GET' | 'POST',
        path: string,
        body?: unknown,
    ): Promise<T> {
        const apiKey = await this.getApiKey();
        const url = `${BASE_URL}${path}`;

        const opts: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        };
        if (body) opts.body = JSON.stringify(body);

        const response = await fetch(url, opts);

        if (!response.ok) {
            let errorMsg: string;
            try {
                const err = await response.json();
                errorMsg = err.error ?? JSON.stringify(err);
            } catch {
                errorMsg = `HTTP ${response.status}`;
            }
            this.logger.error(`AbacatePay ${method} ${path} failed: ${errorMsg}`);
            throw new BadRequestException(`AbacatePay: ${errorMsg}`);
        }

        const json = await response.json();
        return json.data as T;
    }

    /** Converte reais para centavos (ex: 115.00 → 11500) */
    private toCents(amount: number): number {
        return Math.round(amount * 100);
    }

    /** Converte centavos para reais (ex: 11500 → 115.00) */
    private toReais(cents: number): number {
        return cents / 100;
    }

    async createPixPayment(params: PixParams): Promise<CreatePixResult> {
        this.logger.log(
            `PIX request: amount=${params.amount}, ref=${params.externalReference}`,
        );

        const expiresIn = (params.expirationMinutes ?? 15) * 60;

        const data = await this.request<{
            id: string;
            brCode: string;
            brCodeBase64: string;
            expiresAt: string;
        }>('POST', '/v1/pixQrCode/create', {
            amount: this.toCents(params.amount),
            expiresIn,
            description: params.description.slice(0, 140),
            customer: {
                name: params.payer.name ?? 'Cliente',
                cellphone: params.payer.phone ?? '',
                email: params.payer.email,
                taxId: params.payer.cpf ?? '',
            },
            metadata: { externalReference: params.externalReference },
        });

        this.logger.log(`PIX created: id=${data.id}`);

        return {
            id: data.id,
            qrCode: data.brCode ?? '',
            qrCodeBase64: data.brCodeBase64 ?? '',
            expiresAt: data.expiresAt ?? '',
            raw: data,
        };
    }

    async createCardPayment(params: CardParams): Promise<CreateCardResult> {
        this.logger.log(
            `Card checkout request: amount=${params.amount}, ref=${params.externalReference}`,
        );

        // Parcelamento configurável via Setting `card_max_installments` (default 3).
        // Range válido owner: 0-12 (0/1 = "à vista only", display esconde hint).
        // AbacatePay exige 1-12 com mínimo R$10/parcela — coerce 0→1 antes de
        // mandar (consistência com display que esconde hint quando <2).
        // Sujeira (NaN/negativo/>12) cai pro default 3.
        const maxInstallmentsRaw = await this.settingsService.get(
            'card_max_installments',
        );
        const maxInstallmentsParsed =
            maxInstallmentsRaw !== null && maxInstallmentsRaw !== ''
                ? parseInt(maxInstallmentsRaw, 10)
                : NaN;
        const validForDisplay =
            Number.isInteger(maxInstallmentsParsed) &&
                maxInstallmentsParsed >= 0 &&
                maxInstallmentsParsed <= 12
                ? maxInstallmentsParsed
                : 3;
        // Gateway exige >=1; força à vista quando owner pediu 0.
        const maxInstallments = Math.max(validForDisplay, 1);

        // Empty product name → gateway rejeita 400. Slice DEPOIS do trim:
        // descrição "  ...200 spaces... Miniatura" passaria o check mas o
        // slice raw pegaria só os spaces (Gemini R2 hardening).
        const trimmedDesc = params.description?.trim();
        const productName = trimmedDesc
            ? Array.from(trimmedDesc).slice(0, 200).join('')
            : 'Pedido';

        // encodeURIComponent no externalReference dentro da URL — evita
        // path traversal/open redirect se ID contiver `/`, `?`, etc.
        // externalId no body fica raw (gateway parser próprio).
        const safeRef = encodeURIComponent(params.externalReference);

        // Defesa em camadas: PricingService blinda mas garante valor positivo
        // antes de toCents (negative/NaN → 0 → gateway rejeita 400 mais tarde
        // ou cliente paga R$0).
        const safeAmount = Math.max(0, Number(params.amount) || 0);

        // Campos opcionais do customer: undefined em vez de '' pra JSON.stringify
        // OMITIR a key. Empty string ('') faz gateway validar e rejeitar 400
        // (regex CPF/phone não casa com vazio). Gemini R2 #A.
        // taxId só é enviado se length 11 (CPF) ou 14 (CNPJ) — qualquer outro
        // tamanho gera 400 no gateway (Gemini R3 hardening). Upstream
        // OrdersService já bloqueia mas defesa em camadas.
        const rawTaxId = params.payer.cpf?.replace(/\D/g, '') ?? '';
        const taxIdDigits =
            rawTaxId.length === 11 || rawTaxId.length === 14 ? rawTaxId : undefined;
        const customer = {
            name: params.payer.name?.trim() || 'Cliente',
            email: params.payer.email,
            taxId: taxIdDigits,
            cellphone: params.payer.phone?.trim() || undefined,
        };

        // Endpoint /v2/checkouts/create (substituiu /v1/billing/create).
        // Precisa criar o produto inline via items[].id ou usar externalId
        // — aqui criamos sob demanda passando os products no payload.
        const data = await this.request<{
            id: string;
            url: string;
            amount: number;
            status: string;
        }>('POST', '/v2/checkouts/create', {
            frequency: 'ONE_TIME',
            methods: ['CARD'],
            products: [
                {
                    externalId: params.externalReference,
                    name: productName,
                    quantity: 1,
                    price: this.toCents(safeAmount),
                },
            ],
            card: { maxInstallments },
            returnUrl: `${this.siteUrl}/minha-conta/pedidos`,
            completionUrl: `${this.siteUrl}/pedido/pagamento/${safeRef}`,
            externalId: params.externalReference,
            customer,
        });

        this.logger.log(`Card billing created: id=${data.id}, url=${data.url}`);

        return {
            id: data.id,
            status: data.status ?? 'PENDING',
            statusDetail: '',
            cardLastFour: '',
            redirectUrl: data.url,
            raw: data,
        };
    }

    async createBoletoPayment(params: BoletoParams): Promise<CreateBoletoResult> {
        // CPF/CNPJ + nome são obrigatórios pelo gateway (cobrança fiscal de
        // boleto exige identificação do pagador). Falha aqui dá mensagem clara
        // — sem isso, gateway retorna 400 genérico difícil de diagnosticar.
        // Defesa em camadas: typeof check anti TypeError se DTO upstream
        // permitir array/object; length check (11 ou 14) confere shape
        // sem fazer round-trip pra rejeição do gateway (Gemini hardening).
        if (typeof params.payer.cpf !== 'string') {
            throw new BadRequestException(
                'CPF/CNPJ é obrigatório pra emitir boleto.',
            );
        }
        const cleanCpf = params.payer.cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11 && cleanCpf.length !== 14) {
            throw new BadRequestException(
                'CPF deve ter 11 dígitos ou CNPJ 14 dígitos pra emitir boleto.',
            );
        }
        if (!params.payer.name?.trim()) {
            throw new BadRequestException(
                'Nome do pagador é obrigatório pra emitir boleto.',
            );
        }

        this.logger.log(
            `Boleto request: amount=${params.amount}, ref=${params.externalReference}`,
        );

        // Endpoint /v2/transparents/create (Checkout Transparente): retorna
        // linha digitável (barCode), URL do PDF (url), e PIX alternativo
        // automático (brCode/brCodeBase64) na mesma cobrança. Sem redirect.
        const data = await this.request<{
            id: string;
            barCode: string;
            url: string;
            brCode?: string;
            brCodeBase64?: string;
            amount: number;
            status: string;
            expiresAt: string;
        }>('POST', '/v2/transparents/create', {
            method: 'BOLETO',
            data: {
                amount: this.toCents(params.amount),
                // Array.from preserva surrogate pairs (UTF-16 emoji/Unicode complex)
                // — slice raw pode cortar par no meio gerando string malformada
                // que gateway/WAF rejeitam (Gemini hardening).
                description: Array.from(params.description ?? '')
                    .slice(0, 500)
                    .join(''),
                externalId: params.externalReference,
                customer: {
                    name: params.payer.name,
                    taxId: cleanCpf,
                    email: params.payer.email,
                },
                metadata: { externalReference: params.externalReference },
            },
        });

        this.logger.log(`Boleto created: id=${data.id}, expires=${data.expiresAt}`);

        return {
            id: data.id,
            boletoUrl: data.url ?? '',
            barcode: data.barCode ?? '',
            expiresAt: data.expiresAt ?? '',
            raw: data,
        };
    }

    async getPayment(externalId: string): Promise<GatewayPaymentInfo> {
        // Detect type by ID prefix:
        //   - bill_*       → Billing v1 (cartão legado, antes do v2 checkouts)
        //   - check_*      → Checkout v2 (cartão novo via /v2/checkouts/create)
        //   - pix_char_*   → PIX QR Code v1 (legado) — também retornado pelo
        //                    /v2/transparents/create então cai no v1 historicamente.
        //                    Webhook é fonte primária; getPayment é fallback.
        //   - resto        → Transparents v2 (boleto + PIX novo)
        let path: string;
        if (externalId.startsWith('bill_')) {
            path = `/v1/billing/get?id=${encodeURIComponent(externalId)}`;
        } else if (externalId.startsWith('check_')) {
            path = `/v2/checkouts/one?id=${encodeURIComponent(externalId)}`;
        } else if (externalId.startsWith('pix_char_')) {
            path = `/v1/pixQrCode/check?id=${encodeURIComponent(externalId)}`;
        } else {
            path = `/v2/transparents/check?id=${encodeURIComponent(externalId)}`;
        }

        const data = await this.request<{
            id: string;
            status: string;
            amount: number;
        }>('GET', path);

        // Runtime check: gateway pode retornar shape inesperado (string em vez
        // de number, missing fields). NaN em toReais quebraria reconciliação
        // silenciosamente (Gemini hardening).
        if (typeof data?.status !== 'string') {
            throw new BadRequestException(
                'AbacatePay retornou shape inesperado em getPayment.',
            );
        }
        const rawAmount = typeof data.amount === 'number' ? data.amount : 0;

        return {
            status: data.status,
            amount: this.toReais(rawAmount),
            raw: data,
        };
    }

    mapStatus(gatewayStatus: string): string {
        return STATUS_MAP[gatewayStatus] ?? 'PENDING';
    }
}