import { Test, TestingModule } from '@nestjs/testing';
import { BannersController } from './banners.controller';
import { AdminBannersController } from './admin-banners.controller';
import { BannersService } from './banners.service';

describe('Banners controllers', () => {
  let publicCtrl: BannersController;
  let adminCtrl: AdminBannersController;
  let service: jest.Mocked<BannersService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BannersController, AdminBannersController],
      providers: [
        {
          provide: BannersService,
          useValue: {
            findActive: jest.fn(),
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            reorder: jest.fn(),
          },
        },
      ],
    }).compile();

    publicCtrl = module.get(BannersController);
    adminCtrl = module.get(AdminBannersController);
    service = module.get(BannersService);
  });

  describe('public', () => {
    it('GET /api/v1/site/banners returns active banners wrapped', async () => {
      const stub = [{ id: 'b1', title: 'X' }];
      service.findActive.mockResolvedValue(
        stub as Awaited<ReturnType<BannersService['findActive']>>,
      );
      const result = await publicCtrl.findActive();
      expect(result).toEqual({ data: stub });
    });
  });

  describe('admin', () => {
    it('GET /admin/banners lists all', async () => {
      const stub = [{ id: 'b1' }, { id: 'b2' }];
      service.findAll.mockResolvedValue(
        stub as Awaited<ReturnType<BannersService['findAll']>>,
      );
      const result = await adminCtrl.findAll();
      expect(result).toEqual({ data: stub });
    });

    it('POST /admin/banners creates', async () => {
      service.create.mockResolvedValue({ id: 'b1', title: 'new' } as Awaited<
        ReturnType<BannersService['create']>
      >);
      const result = await adminCtrl.create({ title: 'new' });
      expect(service.create).toHaveBeenCalledWith({ title: 'new' });
      expect(result).toEqual({ data: { id: 'b1', title: 'new' } });
    });

    it('PUT /admin/banners/:id updates', async () => {
      service.update.mockResolvedValue({
        id: 'b1',
        title: 'updated',
      } as Awaited<ReturnType<BannersService['update']>>);
      const result = await adminCtrl.update('b1', { title: 'updated' });
      expect(service.update).toHaveBeenCalledWith('b1', { title: 'updated' });
      expect(result).toEqual({ data: { id: 'b1', title: 'updated' } });
    });

    it('DELETE /admin/banners/:id removes', async () => {
      service.remove.mockResolvedValue();
      const result = await adminCtrl.remove('b1');
      expect(service.remove).toHaveBeenCalledWith('b1');
      expect(result).toEqual({ data: { message: 'Banner deleted' } });
    });

    it('PUT /admin/banners/reorder reorders', async () => {
      service.reorder.mockResolvedValue();
      const items = [
        { id: 'b1', order: 0 },
        { id: 'b2', order: 1 },
      ];
      const result = await adminCtrl.reorder({ items });
      expect(service.reorder).toHaveBeenCalledWith(items);
      expect(result).toEqual({ data: { message: 'Order updated' } });
    });
  });
});
