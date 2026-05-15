import { test, expect } from '@playwright/test';


const NORMAL_PRODUCT_SLUG = process.env.E2E_NORMAL_PRODUCT_SLUG ?? 'elven-warrior';
const MIN_ORDER_AMOUNT = Number(process.env.E2E_GIFT_MIN ?? '100');

test.describe('Free Gift — cart flow', () => {
  test('show progress bar when subtotal < min', async ({ page }) => {
    await page.goto(`/p/${NORMAL_PRODUCT_SLUG}`);
    await page.getByRole('button', { name: /add.*cart/i }).click();

    await page.goto('/cart');
    const progress = page.getByText(/Faltam.*para ganhar/i);
    await expect(progress).toBeVisible();

    await expect(
      page.getByText(/FREE GIFT/i),
    ).not.toBeVisible();
  });

  test('add gift automatically when subtotal reaches minimum', async ({
    page,
  }) => {
    await page.goto(`/p/${NORMAL_PRODUCT_SLUG}`);

    const targetQty = Math.ceil(MIN_ORDER_AMOUNT / 50) + 1;
    for (let i = 0; i < targetQty; i++) {
      await page.getByRole('button', { name: /add.*cart/i }).click();
    }

    await page.goto('/cart');

    const giftBadge = page.getByText(/FREE GIFT/i).first();
    await expect(giftBadge).toBeVisible();

    await expect(page.getByText(/You won/i)).toBeVisible();

    await expect(page.getByText(/R\$\s*0,00/)).toBeVisible();
  });

  test('remove button from gift is disabled', async ({ page }) => {
    await page.goto('/cart');

    const giftCard = page.locator('text=FREE GIFT').first();
    if (!(await giftCard.isVisible())) {
      test.skip();
    }
    const lockedBtn = page.getByRole('button', { name: /gift/i });
    await expect(lockedBtn).toBeDisabled();
  });
});
