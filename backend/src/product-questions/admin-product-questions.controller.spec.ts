import { Test, TestingModule } from '@nestjs/testing';
import { AdminProductQuestionsController } from './admin-product-questions.controller';
import { ProductQuestionsService } from './product-questions.service';

describe('AdminProductQuestionsController', () => {
  let controller: AdminProductQuestionsController;
  let service: jest.Mocked<ProductQuestionsService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminProductQuestionsController],
      providers: [
        {
          provide: ProductQuestionsService,
          useValue: {
            findAllAdmin: jest.fn(),
            answer: jest.fn(),
            reject: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(AdminProductQuestionsController);
    service = module.get(ProductQuestionsService);
  });

  describe('GET /api/v1/admin/product-questions', () => {
    it('delegates with query params', async () => {
      service.findAllAdmin.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 20, lastPage: 1 },
      });
      await controller.list('PENDING', 'prod-1', '2', '30');
      expect(service.findAllAdmin).toHaveBeenCalledWith({
        status: 'PENDING',
        productId: 'prod-1',
        page: 2,
        perPage: 30,
      });
    });

    it('uses defaults for missing query', async () => {
      service.findAllAdmin.mockResolvedValue({
        data: [],
        meta: { total: 0, page: 1, perPage: 20, lastPage: 1 },
      });
      await controller.list(undefined, undefined, undefined, undefined);
      expect(service.findAllAdmin).toHaveBeenCalledWith({
        status: undefined,
        productId: undefined,
        page: 1,
        perPage: 20,
      });
    });

    it('rejects invalid status (not in enum)', async () => {
      await expect(
        controller.list('INVALID', undefined, undefined, undefined),
      ).rejects.toThrow();
      expect(service.findAllAdmin).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/v1/admin/product-questions/:id/answer', () => {
    it('delegates to service.answer with admin user id + body', async () => {
      service.answer.mockResolvedValue({
        id: 'q1',
        status: 'ANSWERED',
      } as Awaited<ReturnType<ProductQuestionsService['answer']>>);
      const req = { user: { id: 'admin-1' } } as unknown as Parameters<
        typeof controller.answer
      >[2];

      const result = await controller.answer(
        'q1',
        { answer: 'Resposta!' },
        req,
      );

      expect(service.answer).toHaveBeenCalledWith('q1', 'Resposta!', 'admin-1');
      expect(result).toEqual({ data: { id: 'q1', status: 'ANSWERED' } });
    });
  });

  describe('PATCH /api/v1/admin/product-questions/:id/reject', () => {
    it('delegates to service.reject', async () => {
      service.reject.mockResolvedValue({
        id: 'q1',
        status: 'REJECTED',
      } as Awaited<ReturnType<ProductQuestionsService['reject']>>);
      const result = await controller.reject('q1');
      expect(service.reject).toHaveBeenCalledWith('q1');
      expect(result).toEqual({ data: { id: 'q1', status: 'REJECTED' } });
    });
  });
});
