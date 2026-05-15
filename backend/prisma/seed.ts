import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const prisma = new PrismaClient();

async function main() {
  console.log('Đang seed cơ sở dữ liệu...');

  const categories = [
    {
      name: 'Kỳ ảo',
      slug: 'fantasy',
      description:
        'Mô hình kỳ ảo thời trung cổ: chiến binh, tộc tiên, rồng, pháp sư và hơn thế nữa.',
    },
    {
      name: 'Viễn tưởng',
      slug: 'sci-fi',
      description:
        'Mô hình tương lai: lính không gian, mechs, người ngoài hành tinh và tàu không gian.',
    },
    {
      name: 'Pin Ups',
      slug: 'pin-ups',
      description: 'Mô hình nghệ thuật với mức độ chi tiết cao.',
    },
    {
      name: 'Quái vật',
      slug: 'monstros',
      description: 'Sinh vật, ác quỷ, rồng và quái thú cho RPG và wargames.',
    },
    {
      name: 'Địa hình',
      slug: 'cenarios',
      description: 'Địa hình, tàn tích, tháp và các yếu tố bối cảnh cho bàn chơi game.',
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  const fantasyCategory = await prisma.category.findUnique({ where: { slug: 'fantasy' } });
  const sciFiCategory = await prisma.category.findUnique({ where: { slug: 'sci-fi' } });

  const subcategories = [
    { name: 'Tộc Tiên', slug: 'elf', description: 'Tộc tiên các loại', parentId: fantasyCategory?.id },
    { name: 'Rồng', slug: 'dragon', description: 'Rồng và các sinh vật có cánh', parentId: fantasyCategory?.id },
    { name: 'Chiến binh', slug: 'warrior', description: 'Chiến binh, hiệp sĩ và kỵ sĩ', parentId: fantasyCategory?.id },
    { name: 'Mechs', slug: 'mechs', description: 'Robot khổng lồ và bộ xương ngoài', parentId: sciFiCategory?.id },
    { name: 'Lính không gian', slug: 'space-soldier', description: 'Quân đội tương lai', parentId: sciFiCategory?.id },
  ];

  for (const sub of subcategories) {
    if (sub.parentId) {
      await prisma.category.upsert({
        where: { slug: sub.slug },
        update: { parentId: sub.parentId },
        create: sub,
      });
    }
  }

  console.log(`  ✅ Đã seed ${categories.length} danh mục gốc + ${subcategories.length} danh mục con`);

  const existingRuleSet = await prisma.scaleRuleSet.findUnique({
    where: { name: 'Mô hình tiêu chuẩn' },
  });
  if (!existingRuleSet) {
    await prisma.scaleRuleSet.create({
      data: {
        name: 'Mô hình tiêu chuẩn',
        items: {
          create: [
            { name: '28mm', percentageIncrease: 0, sortOrder: 0 },
            { name: '32mm', percentageIncrease: 15, sortOrder: 1 },
            { name: '54mm', percentageIncrease: 80, sortOrder: 2 },
            { name: '75mm', percentageIncrease: 150, sortOrder: 3 },
          ],
        },
      },
    });
  }
  console.log('  ✅ Đã seed');

  const tags = [
    { name: 'RPG', slug: 'rpg', color: '#6366F1' },
    { name: 'Wargame', slug: 'wargame', color: '#EF4444' },
    { name: 'Đồ sưu tầm', slug: 'collection', color: '#F59E0B' },
    { name: 'Mới', slug: 'new', color: '#10B981' },
    { name: 'Khuyến mãi', slug: 'sale', color: '#EC4899' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: {},
      create: tag,
    });
  }
  console.log(`  ✅ Đã seed ${tags.length} thẻ (tags)`);

  const brands = [
    {
      name: 'Red Figure',
      slug: 'red-figure',
      description: 'Thương hiệu mô hình của Red Figure.',
    },
    {
      name: 'Arsenal Craft',
      slug: 'arsenal-craft',
      description: 'Mô hình từ Arsenal Craft.',
    },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({
      where: { slug: brand.slug },
      update: {},
      create: brand,
    });
  }
  console.log(`  ✅ Đã seed ${brands.length} thương hiệu`);

  await prisma.coupon.upsert({
    where: { code: 'GIAM10' },
    update: {},
    create: {
      code: 'GIAM10',
      type: 'PERCENTAGE',
      value: 10,
      minOrderValue: 50,
      usesPerUser: 1,
      isFirstPurchaseOnly: true,
      isActive: true,
    },
  });
  console.log('  ✅ Đã tạo mã giảm giá GIAM10');

  // const freeShippingExists = await prisma.freeShippingRule.findFirst();
  // if (!freeShippingExists) {
  //   await prisma.freeShippingRule.createMany({
  //     data: [
  //       {
  //         zipCodeStart: '01000000',
  //         zipCodeEnd: '09999999',
  //         minOrderValue: 150,
  //       },
  //       {
  //         zipCodeStart: '20000000',
  //         zipCodeEnd: '26999999',
  //         minOrderValue: 200,
  //       },
  //       {
  //         zipCodeStart: '30000000',
  //         zipCodeEnd: '35999999',
  //         minOrderValue: 200,
  //       },
  //     ],
  //   });
  // }

  const redFigureBrand = await prisma.brand.findUnique({
    where: { slug: 'red-figure' },
  });
  const tag = await prisma.tag.findUnique({ where: { slug: 'tag' } });
  const collectionTag = await prisma.tag.findUnique({
    where: { slug: 'collection' },
  });

  const sampleProduct = await prisma.product.upsert({
    where: { slug: 'guerreira-elfica-28mm' },
    update: {},
    create: {
      name: 'Nữ chiến binh Tộc Tiên',
      slug: 'guerreira-elfica-28mm',
      description:
        'Mô hình nữ chiến binh tộc tiên trong tư thế động. Được in bằng nhựa resin độ phân giải cao với chi tiết tuyệt vời.',
      content:
        '<p>Mô hình này được điêu khắc kỹ thuật số với sự chú ý đến từng chi tiết: bộ giáp trang trí công phu, mái tóc bay trong gió và một thanh trường kiếm.</p><p>Lý tưởng cho các trò chơi RPG để bàn, wargames hoặc vẽ nghệ thuật.</p>',
      basePrice: 49.9,
      sku: 'ELF-WAR-001',
      featured: true,
      brandId: redFigureBrand?.id,
      tags: {
        connect: [tag, collectionTag].filter(Boolean).map((t) => ({ id: t!.id })),
      },
    },
  });

  const existingVar = await prisma.productVariation.findFirst({
    where: { productId: sampleProduct.id, name: 'Mẫu A' },
  });
  if (!existingVar) {
    await prisma.productVariation.create({
      data: {
        productId: sampleProduct.id,
        name: 'Mẫu A',
        sku: 'ELF-WAR-001-A',
        price: 49.9,
        stock: 50,
      },
    });
    await prisma.productVariation.create({
      data: {
        productId: sampleProduct.id,
        name: 'Mẫu B',
        sku: 'ELF-WAR-001-B',
        price: 49.9,
        stock: 30,
      },
    });
  }

  if (fantasyCategory) {
    const elfCategory = await prisma.category.findUnique({ where: { slug: 'elf' } });
    const categoriesToConnect = [fantasyCategory.id, elfCategory?.id].filter(Boolean) as string[];
    for (const catId of categoriesToConnect) {
      await (prisma.productCategory as any).upsert({
        where: { productId_categoryId: { productId: sampleProduct.id, categoryId: catId } },
        update: {},
        create: { productId: sampleProduct.id, categoryId: catId },
      });
    }
  }

  console.log('  ✅ Đã seed');

  const emailLayout = (content: string) => `
<!DOCTYPE html>
<html lang="vi-VN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f9fc;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:100%">
  <!-- Header -->
  <tr><td style="background:#1a1a2e;padding:24px;text-align:center">
    <h1 style="color:#e0a526;margin:0;font-size:28px">Red Figure</h1>
  </td></tr>
  <!-- Content -->
  <tr><td style="padding:32px 24px">
    ${content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="border-top:1px solid #e6ebf1;padding:16px 24px;text-align:center">
    <p style="color:#8898aa;font-size:12px;margin:4px 0">&copy; 2026 Red Figure.</p>
    <p style="color:#8898aa;font-size:12px;margin:4px 0">Bạn nhận được email này vì bạn có tài khoản tại cửa hàng của chúng tôi.</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const emailTemplates = [
    {
      type: 'welcome',
      subject: 'Chào mừng bạn đến với Red Figure, {{name_client}}!',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Chào mừng bạn, {{name_client}}!</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Tài khoản của bạn đã được tạo thành công. Bây giờ bạn có thể khám phá danh mục mô hình 3D độc quyền của chúng tôi,
      theo dõi đơn hàng và nhiều hơn thế nữa.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{url_store}}/products" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Khám phá Danh mục</a>
    </p>
    <p style="color:#525f7f;font-size:16px">Nếu bạn có bất kỳ câu hỏi nào, hãy trả lời email này và chúng tôi sẽ rất vui lòng được hỗ trợ.</p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'email_client', description: 'Email khách hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'sepay-pending',
      subject: 'Hoàn tất đơn hàng {{order_number}} của bạn — Mã thanh toán hết hạn sau {{sepay_expiration_minutes}} phút',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Hoàn tất thanh toán của bạn</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Chúng tôi đã nhận được đơn hàng <strong>{{order_number}}</strong> của bạn. Để xác nhận, chỉ cần thanh toán qua mã QR bên dưới. Mã sẽ hết hạn sau {{sepay_expiration_minutes}} phút.
    </p>
    <div style="background:#fff3cd;border:1px solid #ffe69c;border-radius:6px;padding:12px 16px;margin:16px 0">
      <p style="font-size:13px;color:#7a5e00;margin:0">⏱️ Hết hạn lúc <strong>{{sepay_expires_at}}</strong></p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <img src="{{sepay_qr_base64}}" alt="QR Code sepay" style="max-width:240px;height:auto;border:1px solid #e6ebf1;border-radius:6px;padding:8px;background:#fff" />
    </div>
    <p style="font-size:12px;color:#8898aa;text-transform:uppercase;margin:16px 0 4px">Mã thanh toán (Sao chép và Dán)</p>
    <div style="background:#f6f9fc;border-radius:6px;padding:12px;word-break:break-all;font-family:monospace;font-size:12px;color:#1a1a2e">{{sepay_copia_cola}}</div>
    <div style="margin:24px 0">
      <p style="font-size:14px;font-weight:bold;color:#8898aa;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px">Chi tiết đơn hàng</p>
      {{order_items}}
    </div>
    <hr style="border:none;border-top:1px solid #e6ebf1;margin:12px 0"/>
    <p style="color:#1a1a2e;font-size:18px;font-weight:bold;text-align:right;margin:0">Tổng cộng: {{total}}</p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{order_url}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Xem Đơn hàng</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'order_number', description: 'Số đơn hàng' },
        { tag: 'sepay_qr_base64', description: 'Dữ liệu QR Code (base64)' },
        { tag: 'sepay_copy_paste', description: 'Mã thanh toán sao chép' },
        { tag: 'sepay_expires_at', description: 'Thời gian hết hạn định dạng (17/04/2026 12:15)' },
        { tag: 'sepay_expiration_minutes', description: 'Số phút hiệu lực' },
        { tag: 'order_items', description: 'Danh sách sản phẩm định dạng HTML' },
        { tag: 'total', description: 'Tổng tiền đơn hàng' },
        { tag: 'order_url', description: 'URL chi tiết đơn hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'payment-approved',
      subject: 'Xác nhận thanh toán — đơn hàng {{order_number}}',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Thanh toán thành công! 🎉</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Chúng tôi đã nhận được thanh toán cho đơn hàng <strong>{{order_number}}</strong> qua <strong>{{payment_method}}</strong> và đang chuẩn bị mọi thứ cho bạn.
    </p>
    <div style="margin:24px 0">
      <p style="font-size:14px;font-weight:bold;color:#8898aa;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px">Chi tiết đơn hàng</p>
      {{order_items}}
    </div>
    <hr style="border:none;border-top:1px solid #e6ebf1;margin:12px 0"/>
    <p style="color:#1a1a2e;font-size:18px;font-weight:bold;text-align:right;margin:0">Tổng thanh toán: {{total}}</p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{order_url}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Theo dõi Đơn hàng</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'order_number', description: 'Số đơn hàng' },
        { tag: 'payment_method', description: 'Phương thức thanh toán' },
        { tag: 'order_items', description: 'Danh sách sản phẩm định dạng HTML' },
        { tag: 'total', description: 'Tổng tiền đơn hàng' },
        { tag: 'order_url', description: 'URL chi tiết đơn hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'order-in-production',
      subject: 'Đơn hàng {{order_number}} đã bắt đầu sản xuất',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Đơn hàng của bạn đang được sản xuất 🛠️</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Các mô hình trong đơn hàng <strong>{{order_number}}</strong> của bạn đang được in ấn cẩn thận.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Chúng tôi sẽ thông báo cho bạn ngay khi chúng hoàn thành và được gửi đi.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{order_url}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Theo dõi Đơn hàng</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'order_number', description: 'Số đơn hàng' },
        { tag: 'order_url', description: 'URL chi tiết đơn hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'order-shipped',
      subject: 'Đơn hàng {{order_number}} đã được gửi đi! Kiểm tra mã vận đơn của bạn',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Đơn hàng của bạn đang trên đường giao 🚚</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Đơn hàng <strong>{{order_number}}</strong> đã được gửi đi qua <strong>{{carrier_name}}</strong> và sẽ sớm đến tay bạn sau khoảng {{shipping_deadline_days}} ngày làm việc.
    </p>
    <div style="background:#f6f9fc;border-radius:6px;padding:16px;margin:16px 0">
      <p style="font-size:12px;color:#8898aa;text-transform:uppercase;margin:0 0 4px">Mã vận đơn</p>
      <p style="font-size:20px;color:#1a1a2e;font-weight:bold;font-family:monospace;margin:0">{{tracking_code}}</p>
    </div>
    <p style="text-align:center;margin:24px 0">
      <a href="{{tracking_url}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Theo dõi Vận chuyển</a>
    </p>
    <p style="text-align:center;margin:16px 0">
      <a href="{{order_url}}" style="color:#1a1a2e;text-decoration:underline">Xem đơn hàng tại cửa hàng</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'order_number', description: 'Số đơn hàng' },
        { tag: 'tracking_code', description: 'Mã vận đơn' },
        { tag: 'tracking_url', description: 'Link theo dõi vận chuyển' },
        { tag: 'carrier_name', description: 'Tên đơn vị vận chuyển' },
        { tag: 'shipping_deadline_days', description: 'Thời gian giao hàng dự kiến (ngày)' },
        { tag: 'order_url', description: 'URL chi tiết đơn hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'order-delivered',
      subject: 'Đơn hàng {{order_number}} đã được giao! 🎉',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Đơn hàng của bạn đã đến! 🎉</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Đơn hàng <strong>{{order_number}}</strong> đã được đánh dấu là đã giao thành công. Chúng tôi hy vọng bạn sẽ yêu thích các mô hình của mình.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Sớm thôi chúng tôi sẽ gửi lời mời bạn đánh giá sản phẩm để nhận mã giảm giá.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{order_url}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Xem Đơn hàng</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'order_number', description: 'Số đơn hàng' },
        { tag: 'order_url', description: 'URL chi tiết đơn hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'order-cancelled',
      subject: 'Đơn hàng {{order_number}} đã bị hủy',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Đơn hàng đã bị hủy</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}. Đơn hàng <strong>{{order_number}}</strong> của bạn đã bị hủy{{motivo}}.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Nếu bạn đã thanh toán, khoản hoàn trả sẽ được xử lý tùy theo phương thức thanh toán.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Nếu có bất kỳ thắc mắc nào, hãy trả lời email này để chúng tôi hỗ trợ.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{order_url}}" style="color:#1a1a2e;text-decoration:underline">Xem đơn hàng đã hủy</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'order_number', description: 'Số đơn hàng' },
        { tag: 'reason', description: 'Lý do hủy' },
        { tag: 'order_url', description: 'URL chi tiết đơn hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'order-refunded',
      subject: 'Đơn hàng {{order_number}} đã được hoàn tiền',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Đã ghi nhận hoàn tiền</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}. Chúng tôi đã thực hiện hoàn tiền cho đơn hàng <strong>{{order_number}}</strong>{{reason}}.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Khoản tiền đang được xử lý và sẽ được ghi có vào cùng phương thức thanh toán bạn đã sử dụng — quá trình này có thể mất từ 1 đến 10 ngày làm việc tùy thuộc vào cổng thanh toán.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Nếu có thắc mắc, hãy trả lời email này.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{order_url}}" style="color:#1a1a2e;text-decoration:underline">Xem đơn hàng</a>
    </p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'order_number', description: 'Số đơn hàng' },
        { tag: 'reason', description: 'Lý do hoàn tiền' },
        { tag: 'order_url', description: 'URL chi tiết đơn hàng' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'password-reset',
      subject: 'Đặt lại mật khẩu — RedFigure',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Đặt lại Mật khẩu</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{url_redefinicao}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Đặt lại Mật khẩu của tôi</a>
    </p>
    <p style="color:#8898aa;font-size:14px;line-height:22px">
      Liên kết này sẽ hết hạn sau <strong>1 giờ</strong>. Nếu bạn không yêu cầu đặt lại, vui lòng bỏ qua email này.
    </p>
    <div style="background:#f6f9fc;border-radius:6px;padding:12px 16px;margin:16px 0">
      <p style="font-size:12px;color:#8898aa;margin:0 0 4px">Hoặc sao chép và dán liên kết này vào trình duyệt:</p>
      <p style="font-size:12px;color:#525f7f;word-break:break-all;margin:0">{{url_reset_password}}</p>
    </div>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'url_reset_password', description: 'URL đặt lại mật khẩu' },
        { tag: 'url_store', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'review-reward',
      subject: 'Bạn đã nhận được mã giảm giá {{percentual_desconto}}%!',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Cảm ơn bạn đã đánh giá!</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Đánh giá của bạn cho sản phẩm <strong>{{product_name}}</strong> đã được phê duyệt.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Để cảm ơn, đây là mã giảm giá <strong>{{percentual_desconto}}%</strong> cho lần mua hàng tiếp theo của bạn:
    </p>
    <div style="text-align:center;margin:24px 0;background:#1a1a2e;border-radius:8px;padding:20px">
      <p style="color:#e0a526;font-size:28px;font-weight:bold;font-family:monospace;letter-spacing:2px;margin:0">{{coupon_code}}</p>
    </div>
    <p style="text-align:center;margin:24px 0">
      <a href="{{store_url}}/products" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Sử dụng Mã giảm giá</a>
    </p>
    <p style="font-size:12px;color:#8898aa">Mã giảm giá chỉ có giá trị cho một lần sử dụng và không thể kết hợp với các chương trình khuyến mãi khác.</p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'product_name', description: 'Tên sản phẩm được đánh giá' },
        { tag: 'coupon_code', description: 'Mã giảm giá' },
        { tag: 'discount_percentage', description: 'Phần trăm giảm giá' },
        { tag: 'store_url', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'review-request',
      subject: 'Đơn hàng của bạn thế nào? Nhận {{valor_desconto}} giảm giá',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Trải nghiệm của bạn thế nào?</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Xin chào, {{name_client}}! Đơn hàng của bạn đã được giao. Hãy cho chúng tôi biết cảm nhận của bạn — ý kiến của bạn giúp những khách hàng khác và giúp chúng tôi cải thiện hơn nữa.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Khi gửi đánh giá, bạn sẽ nhận được mã giảm giá <strong>{{discount_value}}</strong> cho lần mua hàng tiếp theo, có hiệu lực trong <strong>{{validity_days}} ngày</strong>.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{review_link}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Đánh giá Đơn hàng</a>
    </p>
    <p style="font-size:12px;color:#8898aa">Mã giảm giá là duy nhất và chỉ được tạo sau khi gửi đánh giá qua liên kết này. Chỉ mất khoảng 2 phút.</p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'review_link', description: 'URL đánh giá duy nhất' },
        { tag: 'discount_value', description: 'Giá trị giảm giá định dạng' },
        { tag: 'discount_percentage', description: 'Phần trăm giảm giá' },
        { tag: 'validity_days', description: 'Số ngày hiệu lực của mã' },
        { tag: 'unsubscribe_url', description: 'URL hủy đăng ký nhận email' },
        { tag: 'store_url', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'review-reminder',
      subject: 'Vẫn còn thời gian: {{valor_desconto}} giảm giá đang chờ bạn',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">Vẫn còn thời gian để nhận mã giảm giá!</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Chào {{name_client}}! Chúng tôi thấy bạn vẫn chưa gửi đánh giá của mình. Chỉ mất 2 phút và mã giảm giá sẽ được gửi ngay vào email của bạn.
    </p>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Nhắc lại: bạn sẽ nhận được <strong>{{discount_value}}</strong> giảm giá để sử dụng trong <strong>{{validity_days}} ngày</strong> tới.
    </p>
    <p style="text-align:center;margin:24px 0">
      <a href="{{review_link}}" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Gửi Đánh giá</a>
    </p>
    <p style="font-size:12px;color:#8898aa">Nếu bạn đã gửi, vui lòng bỏ qua email này. Mã giảm giá sẽ được gửi ngay khi đánh giá được ghi nhận.</p>`),
      availableTags: JSON.stringify([
        { tag: 'name_client', description: 'Tên khách hàng' },
        { tag: 'review_link', description: 'URL đánh giá duy nhất' },
        { tag: 'discount_value', description: 'Giá trị giảm giá định dạng' },
        { tag: 'discount_percentage', description: 'Phần trăm giảm giá' },
        { tag: 'validity_days', description: 'Số ngày hiệu lực của mã' },
        { tag: 'unsubscribe_url', description: 'URL hủy đăng ký nhận email' },
        { tag: 'store_url', description: 'URL cửa hàng' },
      ]),
    },
    {
      type: 'low-stock-alert',
      subject: '⚠️ Cảnh báo hàng trong kho thấp: {{product_name}}',
      htmlBody: emailLayout(`
    <h2 style="color:#1a1a2e;margin:0 0 16px">⚠️ Cảnh báo hàng trong kho thấp</h2>
    <p style="color:#525f7f;font-size:16px;line-height:24px">
      Sản phẩm dưới đây đã đạt đến giới hạn tồn kho tối thiểu và cần được nhập thêm.
    </p>
    <div style="background:#fef3cd;border:1px solid #ffc107;border-radius:6px;padding:16px;margin:16px 0">
      <table width="100%" cellpadding="4" cellspacing="0">
        <tr>
          <td style="color:#856404;font-size:14px;font-weight:bold">Sản phẩm</td>
          <td style="color:#856404;font-size:14px;text-align:right">{{product_name}}</td>
        </tr>
        <tr>
          <td style="color:#856404;font-size:14px;font-weight:bold">Tồn kho hiện tại</td>
          <td style="color:#856404;font-size:22px;font-weight:bold;text-align:right">{{current_stock}} cái.</td>
        </tr>
        <tr>
          <td style="color:#856404;font-size:14px;font-weight:bold">Giới hạn đã cấu hình</td>
          <td style="color:#856404;font-size:14px;text-align:right">{{configured_limit}} cái.</td>
        </tr>
      </table>
    </div>
    <p style="text-align:center;margin:24px 0">
      <a href="{{store_url}}/admin/products" style="background:#e0a526;color:#1a1a2e;font-weight:bold;padding:12px 24px;border-radius:6px;text-decoration:none;font-size:16px;display:inline-block">Quản lý Kho hàng</a>
    </p>
    <p style="font-size:12px;color:#8898aa">Cảnh báo này được gửi tự động khi hàng tồn kho đạt đến giới hạn đã cấu hình.</p>`),
      availableTags: JSON.stringify([
        { tag: 'product_name', description: 'Tên sản phẩm' },
        { tag: 'current_stock', description: 'Số lượng tồn kho hiện tại' },
        { tag: 'configured_limit', description: 'Giới hạn cảnh báo' },
        { tag: 'variation_name', description: 'Tên biến thể' },
        { tag: 'store_url', description: 'URL cửa hàng' },
      ]),
    },
  ];

  for (const tpl of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { type: tpl.type },
      update: { availableTags: tpl.availableTags },
      create: tpl,
    });
  }

  console.log('  ✅ 8 mẫu email (welcome, order, status, password-reset, review-request, review-reminder, review-reward, low-stock-alert)');
  const settings = [
    { key: 'low_stock_threshold', value: '5' },
    { key: 'cutoff_time', value: '14:00' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    } as any);
  }

  console.log('  ✅ 4 thiết lập');
  await seedAiAttributes();
  await seedGoogleTaxonomy();
  await seedPages();

  console.log('\n🎉 Seed hoàn tất!');
}
async function seedAiAttributes() {
  const slugify = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

  const attributes: Array<{ name: string; slug: string; values: string[] }> = [
    {
      name: 'Phong cách',
      slug: 'style',
      values: ['Pin-up', 'Cyberpunk', 'Kỳ ảo', 'Viễn tưởng', 'Quân sự', 'Gothic', 'Steampunk', 'Phương Đông'],
    },
    {
      name: 'Tư thế',
      slug: 'pose',
      values: ['Đứng', 'Ngồi', 'Quỳ', 'Nằm/Tựa', 'Động', 'Có điểm tựa'],
    },
    {
      name: 'Trang phục',
      slug: 'clothing',
      values: ['Nội y', 'Bikini', 'Giáp', 'Đồng phục', 'Váy', 'Cosplay'],
    },
    {
      name: 'Phụ kiện',
      slug: 'accessory',
      values: ['Kiếm', 'Súng', 'Khiên', 'Cánh', 'Mũ', 'Gậy'],
    },
    {
      name: 'Nguyên mẫu',
      slug: 'archetype',
      values: ['Chiến binh', 'Phù thủy', 'Y tá', 'Ma cà rồng', 'Thiên thần', 'Ác quỷ', 'Mỹ nhân ngư', 'Tộc tiên'],
    },
    {
      name: 'Phân loại',
      slug: 'classification',
      values: ['Anime', 'Game'],
    },
    {
      name: 'Bộ sưu tập',
      slug: 'collection',
      values: [],
    },
  ];

  let created = 0;
  for (const attr of attributes) {
    const attribute = await prisma.attribute.upsert({
      where: { slug: attr.slug },
      create: { name: attr.name, slug: attr.slug, isFilter: true },
      update: { isFilter: true },
    });

    for (const val of attr.values) {
      const valSlug = slugify(val);
      const exists = await prisma.attributeValue.findFirst({
        where: { attributeId: attribute.id, slug: valSlug },
      });
      if (!exists) {
        await prisma.attributeValue.create({
          data: { attributeId: attribute.id, value: val, slug: valSlug },
        });
        created++;
      }
    }
  }

  console.log(`  ✅ Đã seed`);
}

async function seedGoogleTaxonomy() {
  const existing = await prisma.googleCategory.count();
  if (existing > 0) {
    console.log(`Google Taxonomy`);
    return;
  }

  const filePath = join(process.cwd(), 'prisma', 'data', 'google-taxonomy.en-US.txt');
  const raw = readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/);

  type Row = { id: string; name: string; path: string; parentId: string | null };
  const byPath = new Map<string, Row>();
  const rows: Row[] = [];

  for (const line of lines) {
    if (!line.trim() || line.startsWith('#')) continue;
    const m = /^(\d+)\s*-\s*(.+)$/.exec(line);
    if (!m) continue;
    const id = m[1];
    const path = m[2].trim();
    const segments = path.split(' > ');
    const name = segments[segments.length - 1];
    const parentPath = segments.slice(0, -1).join(' > ');
    const row: Row = {
      id,
      name,
      path,
      parentId: null,
    };
    rows.push(row);
    byPath.set(path, row);
    (row as Row & { _parentPath?: string })._parentPath = parentPath || undefined;
  }
  for (const row of rows) {
    const parentPath = (row as Row & { _parentPath?: string })._parentPath;
    if (parentPath) {
      row.parentId = byPath.get(parentPath)?.id ?? null;
    }
    delete (row as Row & { _parentPath?: string })._parentPath;
  }

  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await prisma.googleCategory.createMany({
      data: rows.slice(i, i + CHUNK),
      skipDuplicates: true,
    });
  }

  console.log(`  ✅ Đã seed ${rows.length} Google`);
}

async function seedPages() {
  console.log('Đang seed các trang...');

  const pages = [
    {
      slug: 'about',
      title: 'Giới thiệu',
      content: '<p>Chúng tôi là cửa hàng chuyên về mô hình 3D chất lượng cao cho người sưu tầm, người đam mê mô hình.</p><p>Mỗi mô hình đều được in cẩn thận bằng nhựa resin độ phân giải cao, đảm bảo chi tiết kinh ngạc ở mọi tỷ lệ.</p><h2>Sứ mệnh của chúng tôi</h2><p>Làm cho mô hình 3D trở nên dễ tiếp cận đối với mọi người đam mê, cung cấp sự đa dạng về tỷ lệ, giá cả hợp lý và dịch vụ cá nhân hóa.</p><h2>Tỷ lệ có sẵn</h2><p>Chúng tôi làm việc với nhiều tỷ lệ khác nhau: 28mm (Heroic), 32mm, 54mm, 75mm và hơn thế nữa. Mỗi tỷ lệ đều có các quy tắc giá có thể cấu hình để đảm bảo hiệu quả chi phí tốt nhất.</p>',
      metaDescription: 'Tìm hiểu về Red Figure — cửa hàng chuyên về mô hình và các hình tượng sưu tầm được in bằng nhựa resin độ nét cao.',
    },
    {
      slug: 'contact',
      title: 'Liên hệ',
      content: '<p>Gửi tin nhắn của bạn và chúng tôi sẽ phản hồi trong vòng 24 giờ.</p>',
      metaDescription: 'Liên hệ với Red Figure. Giải đáp thắc mắc về đơn hàng, mô hình, thời hạn và cá nhân hóa.',
    },
    {
      slug: 'faq',
      title: 'Câu hỏi thường gặp',
      content: '',
      metaDescription: 'Giải đáp các thắc mắc về thời hạn, tỷ lệ, thanh toán, vận chuyển và bảo hành các mô hình của Red Figure.',
      faqItems: [
        { question: 'Thời gian sản xuất là bao lâu?', answer: 'Thời gian sản xuất là 3 ngày làm việc sau khi xác nhận thanh toán.' },
        { question: 'Có những tỷ lệ nào?', answer: 'Chúng tôi có làm mô hình với các tỷ lệ 32mm, 54mm, 75mm và các tỷ lệ tùy chỉnh theo yêu cầu.' },
        { question: 'Tôi có thể thanh toán bằng cách chuyển khoản không?', answer: 'Có! Thanh toán qua chuyển khoản ngân hàng được giảm giá 10% tự động khi thanh toán.' },
        { question: 'Làm thế nào để theo dõi đơn hàng của tôi?', answer: 'Sau khi gửi hàng, bạn sẽ nhận được mã vận đơn qua email. Bạn cũng có thể theo dõi trong Tài khoản của tôi > Đơn hàng.' },
        { question: 'Cửa hàng có miễn phí vận chuyển không?', answer: 'Có! Đối với một số khu vực, các đơn hàng trên một giá trị tối thiểu sẽ được miễn phí vận chuyển. Kiểm tra khi thanh toán.' },
        { question: 'Chính sách bảo hành như thế nào?', answer: 'Nếu mô hình bị lỗi in, chúng tôi sẽ gửi lại miễn phí. Kiểm tra chính sách đổi trả của chúng tôi.' },
      ],
    },
    {
      slug: 'privacy-policy',
      title: 'Chính sách bảo mật',
      content: '<p>Sự riêng tư của bạn rất quan trọng đối với chúng tôi. Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu của bạn.</p><h2>1. Dữ liệu được thu thập</h2><p>Chúng tôi thu thập tên, email, địa chỉ giao hàng và dữ liệu thanh toán cần thiết để xử lý đơn hàng.</p><h2>2. Sử dụng dữ liệu</h2><p>Dữ liệu của bạn được sử dụng độc quyền để: xử lý đơn hàng, gửi thông báo trạng thái, cải thiện dịch vụ của chúng tôi.</p><h2>3. Bảo vệ</h2><p>Mật khẩu được lưu trữ bằng hash bcrypt. Dữ liệu thanh toán được xử lý bởi Mercado Pago và không bao giờ được lưu trữ trên máy chủ của chúng tôi.</p><h2>4. Cookies</h2><p>Chúng tôi sử dụng cookies thiết yếu để xác thực và giỏ hàng. Chúng tôi không sử dụng cookies theo dõi của bên thứ ba.</p>',
      metaDescription: 'Chính sách bảo mật của Red Figure. Tìm hiểu cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu cá nhân của bạn.',
    },
    {
      slug: 'terms-of-use',
      title: 'Điều khoản sử dụng',
      content: '<p>Bằng cách sử dụng trang web này, bạn đồng ý với các điều khoản và điều kiện sau.</p><h2>1. Sử dụng trang web</h2><p>Nội dung của trang web này chỉ dành cho mục đích cá nhân và phi thương mại. Nghiêm cấm sao chép khi không được phép.</p><h2>2. Tài khoản người dùng</h2><p>Bạn có trách nhiệm duy trì tính bảo mật của tài khoản và mật khẩu của mình. Thông báo ngay cho chúng tôi về bất kỳ hành vi sử dụng trái phép nào.</p><h2>3. Sản phẩm và giá cả</h2><p>Giá có thể thay đổi mà không cần thông báo trước. Tất cả các giao dịch được xử lý bằng đồng Reais (BRL).</p><h2>4. Sở hữu trí tuệ</h2><p>Tất cả các mô hình 3D, hình ảnh và nội dung đều là tài sản của cửa hàng hoặc được cấp phép từ bên thứ ba.</p>',
      metaDescription: 'Điều khoản và điều kiện sử dụng của cửa hàng Red Figure. Vui lòng đọc trước khi mua hàng.',
    },
    {
      slug: 'exchanges-and-returns',
      title: 'Đổi trả và Hoàn tiền',
      content: '<h2>Lỗi in ấn</h2><p>Nếu mô hình của bạn bị lỗi in (in sai màu, thiếu bộ phận, gãy trong quá trình vận chuyển), chúng tôi sẽ gửi lại mà không mất thêm chi phí. Vui lòng gửi ảnh chụp lỗi cho bộ phận hỗ trợ của chúng tôi.</p><h2>Thời hạn</h2><p>Bạn có tối đa 7 ngày kể từ ngày nhận hàng để yêu cầu đổi trả hoặc hoàn tiền.</p><h2>Cách yêu cầu</h2><p>Liên hệ qua email hoặc trang liên hệ, cung cấp số đơn hàng và ảnh chụp sản phẩm.</p><h2>Hoàn tiền</h2><p>Hoàn tiền được xử lý trong vòng 10 ngày làm việc sau khi được phê duyệt, thông qua cùng phương thức thanh toán đã sử dụng khi mua hàng.</p>',
      metaDescription: 'Chính sách đổi trả và hoàn tiền của Red Figure. Tìm hiểu cách yêu cầu đổi trả hoặc hoàn tiền cho mô hình.',
    },
  ];

  for (const page of pages) {
    await prisma.page.upsert({
      where: { slug: page.slug },
      update: {
        metaDescription: page.metaDescription,
        faqItems: (page as any).faqItems ?? undefined,
      },
      create: page as any,
    });
  }

  console.log(`  ✅ Đã seed ${pages.length} trang`);
}

main()
  .catch((e) => {
    console.error('Seed thất bại:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });