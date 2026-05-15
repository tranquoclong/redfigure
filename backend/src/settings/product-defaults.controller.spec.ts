import { Test, TestingModule } from '@nestjs/testing';
import { ProductDefaultsController } from './product-defaults.controller';
import { SettingsService } from './settings.service';

describe('ProductDefaultsController', () => {
  let controller: ProductDefaultsController;

  const mockSettingsService = {
    getMany: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductDefaultsController],
      providers: [{ provide: SettingsService, useValue: mockSettingsService }],
    }).compile();

    controller = module.get<ProductDefaultsController>(
      ProductDefaultsController,
    );

    jest.clearAllMocks();
  });

  describe('GET /settings/product-defaults', () => {
    it('should return all product defaults', async () => {
      mockSettingsService.getMany.mockResolvedValue({
        product_default_weight: '0.040',
        product_default_width: '1',
        product_default_height: '1',
        product_default_length: '1',
        product_default_condition: 'new',
        product_default_color_id: '',
        product_default_material_id: '',
      });

      const result = await controller.getDefaults();

      expect(result).toEqual({
        data: {
          weight: '0.040',
          width: '1',
          height: '1',
          length: '1',
          condition: 'new',
          colorId: '',
          materialId: '',
        },
      });
    });

    it('should return empty values when settings do not exist', async () => {
      mockSettingsService.getMany.mockResolvedValue({});

      const result = await controller.getDefaults();

      expect(result).toEqual({
        data: {
          weight: '',
          width: '',
          height: '',
          length: '',
          condition: '',
          colorId: '',
          materialId: '',
        },
      });
    });
  });

  describe('PUT /settings/product-defaults', () => {
    it('should save all defaults', async () => {
      mockSettingsService.set.mockResolvedValue(undefined);

      const dto = {
        weight: '0.040',
        width: '1',
        height: '1',
        length: '1',
        condition: 'new',
        colorId: 'color-1',
        materialId: 'mat-1',
      };

      const result = await controller.setDefaults(dto);

      expect(mockSettingsService.set).toHaveBeenCalledTimes(7);
      expect(mockSettingsService.set).toHaveBeenCalledWith(
        'product_default_weight',
        '0.040',
      );
      expect(mockSettingsService.set).toHaveBeenCalledWith(
        'product_default_color_id',
        'color-1',
      );
      expect(result).toEqual({ data: { message: 'Product defaults saved' } });
    });
  });
});
