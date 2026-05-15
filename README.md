# Red Figure

---

## Giới thiệu

Cửa hàng mô hình chuyên nghiệp (Anime, Marvel, Games, ...) — Nền tảng thương mại điện tử chuyên biệt hỗ trợ tỷ lệ in đa dạng (1/10, 1/6, 1/4, 1/3, real-scale), bộ sưu tập (bundles) kèm giảm giá, các phiên bản tùy biến (vũ khí/trang phục), và báo giá tùy chỉnh cho các mẫu ngoài danh mục.

Dự án được xây dựng với tư duy **Security-first**, **Atomic Checkout** và **Test-Driven Development (TDD)** — mọi quy tắc nghiệp vụ và tính toán giá đều được thực hiện và xác thực nghiêm ngặt tại backend.

---

## Công nghệ sử dụng

### Backend

- **NestJS 11** (Node 25, TypeScript 5.7)
- **Prisma 6** + **PostgreSQL 18**
- **Redis 7** (session, giỏ hàng, mutex, rate limit)
- **Elasticsearch 9.3** (tìm kiếm toàn văn)
- **AWS S3 / Cloudflare R2** (lưu trữ hình ảnh/WebP)
- **BullMQ 5** (hàng đợi xử lý email, hết hạn đơn hàng, webhooks)
- **Sentry** (theo dõi lỗi và hiệu năng)

### Frontend

- **Next.js 16** (App Router, React 19)
- **Tailwind CSS 4** + **shadcn/ui**
- **TanStack Query** (đồng bộ trạng thái server)
- **Zustand** (quản lý trạng thái client: giỏ hàng, xác thực)

### Kiểm thử & Công cụ

- **Jest + Supertest** (Backend)
- **Vitest + RTL** (Frontend)
- **Playwright** (E2E Testing)
- **Pino** (Structured logging)

---

## Tính năng nổi bật

### Giao diện khách hàng (Client)

- **Bộ lọc thông minh:** Theo danh mục, thẻ, thuộc tính, tỷ lệ, thương hiệu và khoảng giá.
- **Tìm kiếm nâng cao:** Tự động gợi ý và tìm kiếm toàn văn với Elasticsearch.
- **Giỏ hàng bền vững:** Lưu trữ trên Redis 7 ngày, đảm bảo trải nghiệm liền mạch.
- **Thanh toán linh hoạt:** Hỗ trợ QR code, tích hợp các cổng thanh toán hiện đại.
- **Hệ thống giảm giá:** Mã giảm giá theo điều kiện (giá trị tối thiểu, giới hạn sử dụng) và giảm giá theo phương thức thanh toán (ví dụ: QR -10%).
- **Tương tác người dùng:** Danh sách yêu thích, sản phẩm đã xem, đánh giá kèm ảnh và hệ thống Hỏi đáp (Q&A) có kiểm duyệt.
- **Báo giá tùy chỉnh:** Quy trình yêu cầu mô hình riêng, admin định giá và khách hàng xác nhận mua ngay trên web.

### Quản trị (Admin)

- **Dashboard:** Tổng quan các chỉ số kinh doanh và hiệu suất theo thời gian thực.
- **Quản lý sản phẩm:** CRUD đầy đủ cho bộ sưu tập (bundles), phiên bản (variations), tỷ lệ (scales) và thuộc tính.
- **Vận hành đơn hàng:** Quản lý theo máy trạng thái (state machine) và kiểm kê kho hàng chi tiết.
- **Marketing & SEO:** Trình chỉnh sửa mẫu email (React Email), quản lý nội dung blog, trang tĩnh và SEO metadata.
- **Tích hợp:** Nhập tệp trực tiếp từ Dropbox vào S3/R2, AI (Gemini) hỗ trợ tự động điền thông tin sản phẩm.

---

## Bảo mật

- **Xác thực:** JWT + Refresh Token với cơ chế xoay vòng (rotation) và phát hiện sử dụng lại (RFC 6819).
- **Chính sách mật khẩu:** Kiểm tra dựa trên vai trò (Role-aware) và đối soát với cơ sở dữ liệu mật khẩu bị rò rỉ (HIBP).
- **Phòng thủ:** Rate limit nghiêm ngặt, Turnstile (fail-closed) và Honeypot trên tất cả các form công khai.
- **Toàn vẹn dữ liệu:** Xác thực HMAC cho webhooks, tính không thay đổi (idempotency) với `SETNX`.
- **Giao dịch:** Sử dụng `$transaction + SELECT FOR UPDATE` cho các thao tác cạnh tranh quan trọng (giữ kho, sử dụng coupon).
- **Quyền riêng tư:** Tuân thủ LGPD/GDPR với quản lý PII và tùy chọn opt-out marketing.

---

## Kiến trúc hệ thống

### Luồng thanh toán

```
Client gửi yêu cầu đặt hàng (chỉ gửi IDs và số lượng)
         │
         ▼
OrdersController → Mutex Redis (tránh double-submit)
         │
         ▼
PricingService: Tính toán lại toàn bộ giá, chiết khấu, phí vận chuyển từ DB
         │
         ▼
$transaction (Nguyên tử):
         ├─ Tạo đơn hàng & chi tiết (snapshot giá)
         ├─ Giữ kho (Reserve stock)
         ├─ Tạo yêu cầu thanh toán tại Gateway
         └─ Cập nhật lượt dùng mã giảm giá
         │
         ▼
Webhook xử lý kết quả thanh toán (HMAC validation)
         ├─ Thành công: Xác nhận trừ kho thực tế
         ├─ Thất bại: Giải phóng kho đã giữ
         └─ Gửi email thông báo (BullMQ)
```

---

## Cấu trúc thư mục

```
.
├── backend/              NestJS API
│   ├── src/              Mã nguồn tổ chức theo module (auth, products, orders, ...)
│   ├── prisma/           Schema, migrations và seeding data
│   └── test/             Kiểm thử E2E và integration
├── frontend/             Next.js App
│   ├── src/app/          App Router (Public, Admin, Account)
│   ├── src/components/   UI Components (shadcn, custom)
│   └── src/store/        Zustand state management
```

---

## Hướng dẫn phát triển

### Yêu cầu hệ thống

- Node.js 24+ LTS
- Docker & Docker Compose
- Tệp cấu hình `.env` (sao chép từ `.env.example`)

### Thiết lập môi trường

````bash
# Backend
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run start:dev

# Frontend
cd frontend
npm install
npm run dev

### Các lệnh thường dùng

```bash
# Chạy toàn bộ test backend
cd backend && npm test

# Chạy test frontend
cd frontend && npm test

# Kiểm tra kiểu dữ liệu
npm run type-check # (tại từng thư mục)
````
