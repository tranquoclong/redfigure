import { Test, TestingModule } from '@nestjs/testing';
import { WishlistAdminController } from './wishlist-admin.controller';
import { WishlistService } from './wishlist.service';

describe('WishlistAdminController — admin view of favorites by user', () => {
  let controller: WishlistAdminController;
  let service: { findAllForAdmin: jest.Mock };

  beforeEach(async () => {
    service = { findAllForAdmin: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistAdminController],
      providers: [{ provide: WishlistService, useValue: service }],
    }).compile();

    controller = module.get(WishlistAdminController);
  });

  const VALID_CUID = 'cm5xj3yk100000abc1234567z';

  it('returns hydrated items from user via service', async () => {
    const items = [
      {
        id: 'wi1',
        productId: 'p1',
        createdAt: new Date(),
        product: {
          id: 'p1',
          name: 'Warrior',
          slug: 'warrior',
          basePrice: 49.9,
          salePrice: null,
          images: [
            {
              id: 'img1',
              mediaFile: { id: 'mf1', card: 'https://cdn.example/w-card.webp' },
            },
          ],
        },
      },
    ];
    service.findAllForAdmin.mockResolvedValue(items);

    const result = await controller.getWishlistByUser(VALID_CUID);

    expect(service.findAllForAdmin).toHaveBeenCalledWith(VALID_CUID);
    expect(result).toEqual({ data: items });
  });

  it('user without favorites: returns data: []', async () => {
    service.findAllForAdmin.mockResolvedValue([]);
    const result = await controller.getWishlistByUser(VALID_CUID);
    expect(result).toEqual({ data: [] });
  });
});
