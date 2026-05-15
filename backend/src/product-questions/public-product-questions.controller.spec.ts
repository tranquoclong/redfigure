import { Test, TestingModule } from '@nestjs/testing';
import { PublicProductQuestionsController } from './public-product-questions.controller';
import { ProductQuestionsService } from './product-questions.service';

describe('PublicProductQuestionsController', () => {
  let controller: PublicProductQuestionsController;
  let service: jest.Mocked<ProductQuestionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicProductQuestionsController],
      providers: [
        {
          provide: ProductQuestionsService,
          useValue: {
            ask: jest.fn(),
            findPublicByProduct: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(PublicProductQuestionsController);
    service = module.get(ProductQuestionsService);
  });

  const baseDto = {
    productId: 'prod-1',
    question: 'Qual o prazo?',
    acceptLgpd: true,
  };

  describe('POST /api/v1/product-questions', () => {
    it('delegates to service with DTO + IP + UA + user=null for guest', async () => {
      service.ask.mockResolvedValue({ ok: true, id: 'q1' });
      const req = {
        ip: '1.2.3.4',
        headers: { 'user-agent': 'Agent/1.0' },
        user: undefined,
      } as unknown as Parameters<typeof controller.ask>[1];

      const result = await controller.ask(
        {
          ...baseDto,
          askerName: 'a',
          askerEmail: 'a@b.com',
          turnstileToken: 'tok',
        },
        req,
      );

      expect(service.ask).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          askerName: 'a',
        }),
        null,
        { ipAddress: '1.2.3.4', userAgent: 'Agent/1.0' },
      );
      expect(result).toEqual({ data: { ok: true, id: 'q1' } });
    });

    it('passes user when authenticated (req.user populated)', async () => {
      service.ask.mockResolvedValue({ ok: true, id: 'q2' });
      const req = {
        ip: '1.2.3.4',
        headers: {},
        user: { id: 'u1', email: 'u@x.com', name: 'Pedro' },
      } as unknown as Parameters<typeof controller.ask>[1];

      await controller.ask(baseDto, req);

      expect(service.ask).toHaveBeenCalledWith(
        expect.anything(),
        { id: 'u1', email: 'u@x.com', name: 'Pedro' },
        expect.anything(),
      );
    });

    it('falls back to x-forwarded-for first hop when req.ip missing', async () => {
      service.ask.mockResolvedValue({ ok: true });
      await controller.ask(baseDto, {
        ip: undefined,
        headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
        user: undefined,
      } as unknown as Parameters<typeof controller.ask>[1]);
      expect(service.ask).toHaveBeenCalledWith(
        expect.anything(),
        null,
        expect.objectContaining({ ipAddress: '198.51.100.9' }),
      );
    });
  });

  describe('GET /api/v1/products/:productId/questions', () => {
    const anonReq = {
      user: undefined,
    } as unknown as Parameters<typeof controller.list>[1];

    it('delegates to service.findPublicByProduct with pagination defaults + no userId for anon', async () => {
      service.findPublicByProduct.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 },
      });

      const result = await controller.list(
        'prod-1',
        anonReq,
        undefined,
        undefined,
      );

      expect(service.findPublicByProduct).toHaveBeenCalledWith(
        'prod-1',
        1,
        10,
        undefined,
      );
      expect(result).toEqual({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 },
      });
    });

    it('passes currentUserId when authenticated — computes isOwn flag', async () => {
      service.findPublicByProduct.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 },
      });
      const req = {
        user: { id: 'u1' },
      } as unknown as Parameters<typeof controller.list>[1];
      await controller.list('prod-1', req, undefined, undefined);
      expect(service.findPublicByProduct).toHaveBeenCalledWith(
        'prod-1',
        1,
        10,
        'u1',
      );
    });

    it('clamps page/perPage to sane ranges', async () => {
      service.findPublicByProduct.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 10, lastPage: 1 },
      });
      await controller.list('prod-1', anonReq, '-5', '999');
      expect(service.findPublicByProduct).toHaveBeenCalledWith(
        'prod-1',
        1,
        50,
        undefined,
      );
    });
  });
});
