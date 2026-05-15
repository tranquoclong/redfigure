-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ShippingGatewayStatus" AS ENUM ('NONE', 'IN_CART', 'PURCHASED', 'GENERATED', 'POSTED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('PERCENTAGE', 'FIXED', 'FREE_SHIPPING');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "ProductQuestionStatus" AS ENUM ('PENDING', 'ANSWERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CustomQuoteStatus" AS ENUM ('REQUESTED', 'DRAFT', 'SENT', 'PARTIALLY_ACCEPTED', 'FULLY_ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CustomQuoteItemStatus" AS ENUM ('QUOTED', 'ACCEPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CommissionSource" AS ENUM ('REFERRAL_COOKIE', 'COUPON');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('CREDIT', 'DEBIT');

-- CreateEnum
CREATE TYPE "LedgerSource" AS ENUM ('COMMISSION', 'MANUAL_CREDIT', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "CommissionRuleScope" AS ENUM ('PRODUCT', 'TAG', 'CATEGORY', 'GLOBAL');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'BOUNCED', 'FAILED', 'DEFERRED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "passwordSet" BOOLEAN NOT NULL DEFAULT true,
    "marketingConsent" BOOLEAN NOT NULL DEFAULT false,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerificationToken" TEXT,
    "emailVerificationExpires" TIMESTAMP(3),
    "passwordResetToken" TEXT,
    "passwordResetExpires" TIMESTAMP(3),
    "googleId" TEXT,
    "googlePicture" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "cccd" TEXT,
    "phone" TEXT,
    "mst" TEXT,
    "companyName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "emailMarketingOptOut" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribeTokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "secondReminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "persistent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(40),
    "street" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "postalCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'VN',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerCccd" TEXT,
    "customerPhone" TEXT,
    "customerMst" TEXT,
    "customerCompanyName" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "shipping" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "shippingAddress" JSONB,
    "shippingCarrier" TEXT,
    "shippingServiceName" TEXT,
    "shippingServiceId" INTEGER,
    "shippingDeadlineDays" INTEGER,
    "trackingCode" TEXT,
    "trackingUrl" TEXT,
    "shippingGatewayId" TEXT,
    "shippingGatewayOrderId" TEXT,
    "shippingLabelUrl" TEXT,
    "shippingGatewayStatus" "ShippingGatewayStatus" NOT NULL DEFAULT 'NONE',
    "deliveredAt" TIMESTAMP(3),
    "referringAffiliateId" TEXT,
    "referringAffiliateSource" "CommissionSource",
    "paymentMethod" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentId" TEXT,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "stockReserved" BOOLEAN NOT NULL DEFAULT false,
    "estimatedDeliveryDate" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variationId" TEXT,
    "quoteItemId" TEXT,
    "productName" TEXT,
    "productSku" TEXT,
    "productImage" TEXT,
    "productBrandName" TEXT,
    "productCategoryName" TEXT,
    "customItemDescription" TEXT,
    "variationLabel" TEXT,
    "variationName" TEXT,
    "scaleName" TEXT,
    "scalePercentage" DOUBLE PRECISION,
    "quantity" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isFreeGift" BOOLEAN NOT NULL DEFAULT false,
    "parentOrderItemId" TEXT,
    "bundleDiscount" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT,
    "content" TEXT,
    "type" TEXT NOT NULL DEFAULT 'simple',
    "brandId" TEXT,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION,
    "displayPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bundleDiscount" DOUBLE PRECISION,
    "sku" TEXT,
    "gtin" TEXT,
    "mpn" TEXT,
    "condition" TEXT NOT NULL DEFAULT 'new',
    "colorId" TEXT,
    "materialId" TEXT,
    "googleCategoryId" TEXT,
    "salePriceStartDate" TIMESTAMP(3),
    "salePriceEndDate" TIMESTAMP(3),
    "manageStock" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "lowStockThreshold" INTEGER,
    "weight" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "extraDays" INTEGER,
    "scaleRuleSetId" TEXT,
    "noScales" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variations" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "attributeValueId" TEXT,
    "sku" TEXT NOT NULL DEFAULT '',
    "gtin" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "salePrice" DOUBLE PRECISION,
    "manageStock" BOOLEAN NOT NULL DEFAULT true,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reservedStock" INTEGER NOT NULL DEFAULT 0,
    "image" TEXT,
    "weight" DOUBLE PRECISION,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "product_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variation_images" (
    "id" TEXT NOT NULL,
    "variationId" TEXT NOT NULL,
    "mediaFileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_variation_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "thumb" TEXT NOT NULL,
    "card" TEXT NOT NULL,
    "gallery" TEXT NOT NULL,
    "full" TEXT NOT NULL,
    "original" TEXT,
    "alt" TEXT,
    "title" TEXT,
    "description" TEXT,
    "caption" TEXT,
    "captionPresetId" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "whitelistedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_caption_presets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_caption_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaFileId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "parentId" TEXT,
    "scaleRuleSetId" TEXT,
    "colorId" TEXT,
    "materialId" TEXT,
    "googleCategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "extraDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "scaleRuleSetId" TEXT,
    "noScales" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "extraDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "sku_prefix" TEXT,
    "rename_folder_default" BOOLEAN NOT NULL DEFAULT true,
    "scale_rule_set_id" TEXT,
    "no_scales" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sku_counters" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sku_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale_rule_sets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scale_rule_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scale_rule_items" (
    "id" TEXT NOT NULL,
    "ruleSetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentageIncrease" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "scale_rule_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CouponType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "minOrderValue" DOUBLE PRECISION,
    "maxUses" INTEGER,
    "usesPerUser" INTEGER,
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "isFirstPurchaseOnly" BOOLEAN NOT NULL DEFAULT false,
    "isFreeShipping" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "categoryId" TEXT,
    "tagId" TEXT,
    "userId" TEXT,
    "affiliateId" TEXT,
    "allowedEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_coupons" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL,
    "couponType" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coupon_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_shipping_tiers" (
    "id" TEXT NOT NULL,
    "shippingUpTo" INTEGER,
    "minSubtotal" INTEGER NOT NULL,
    "extraDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_shipping_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "free_gifts" (
    "id" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minOrderAmount" DOUBLE PRECISION NOT NULL,
    "productId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "label" TEXT NOT NULL DEFAULT '🎁 Quà tặng!',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "free_gifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_components" (
    "id" TEXT NOT NULL,
    "parentProductId" TEXT NOT NULL,
    "childProductId" TEXT NOT NULL,
    "childVariationId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundle_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "discount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" TEXT NOT NULL,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'sepay',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "webhookData" TEXT,
    "redirectUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "installments" INTEGER,
    "cardLastFour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "gateway_status" TEXT,
    "gateway_status_detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_audit_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variationId" TEXT,
    "quantityBefore" INTEGER NOT NULL,
    "quantityAfter" INTEGER NOT NULL,
    "delta" INTEGER NOT NULL,
    "reservedBefore" INTEGER,
    "reservedAfter" INTEGER,
    "reason" TEXT NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkout_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT,
    "request" TEXT,
    "response" TEXT,
    "error" TEXT,
    "duration" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkout_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seo_meta" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "ogImage" TEXT,
    "keywords" TEXT,
    "canonical" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seo_meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "authorId" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "ogImage" TEXT,
    "faqItems" JSONB,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isFilter" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_values" (
    "id" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attributes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeValueId" TEXT NOT NULL,

    CONSTRAINT "product_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "related_products" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "related_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "images" TEXT,
    "displayName" TEXT,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "isHighlightedOnHome" BOOLEAN NOT NULL DEFAULT false,
    "inviteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_reviews" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_invites" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "couponId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_rewards" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_rewards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recently_viewed" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recently_viewed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "availableTags" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" TEXT NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "company" TEXT NOT NULL,
    "extraDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "featured_categories" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "displayLabel" TEXT,
    "glowColor" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "featured_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "eyebrow" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "primaryCtaLabel" TEXT,
    "primaryCtaHref" TEXT,
    "secondaryCtaLabel" TEXT,
    "secondaryCtaHref" TEXT,
    "imageUrl" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_subscribers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmationToken" TEXT,
    "confirmationExpiresAt" TIMESTAMP(3),
    "confirmationSentAt" TIMESTAMP(3),
    "unsubscribeToken" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "totalRecipients" INTEGER NOT NULL DEFAULT 0,
    "audienceLockedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materials" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "parentId" TEXT,

    CONSTRAINT "google_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_questions" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "askerName" TEXT NOT NULL,
    "askerEmail" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),
    "answeredById" TEXT,
    "status" "ProductQuestionStatus" NOT NULL DEFAULT 'PENDING',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_quotes" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "customerPhone" TEXT,
    "userId" TEXT,
    "customerNotes" TEXT,
    "externalLinks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "adminNotes" TEXT,
    "status" "CustomQuoteStatus" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_quote_items" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "maxQuantity" INTEGER NOT NULL DEFAULT 1,
    "weight" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION NOT NULL,
    "height" DOUBLE PRECISION NOT NULL,
    "length" DOUBLE PRECISION NOT NULL,
    "status" "CustomQuoteItemStatus" NOT NULL DEFAULT 'QUOTED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_quote_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_quote_images" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "mediaFileId" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_quote_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicId" SERIAL NOT NULL,
    "publicCode" VARCHAR(32),
    "status" "AffiliateStatus" NOT NULL DEFAULT 'APPROVED',
    "commissionRate" DECIMAL(5,2),
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "termsVersion" TEXT NOT NULL DEFAULT 'v1',
    "approvedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "suspendedReason" TEXT,
    "suspendedByUserId" TEXT,
    "notifyNewCommission" BOOLEAN NOT NULL DEFAULT false,
    "notifyPaidCommission" BOOLEAN NOT NULL DEFAULT false,
    "lastLedgerHash" CHAR(64),
    "lastLedgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_visits" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "sessionId" TEXT,
    "userId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "landingUrl" TEXT NOT NULL,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "convertedOrderId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commission_rules" (
    "id" TEXT NOT NULL,
    "scope" "CommissionRuleScope" NOT NULL,
    "productId" TEXT,
    "tagId" TEXT,
    "categoryId" TEXT,
    "rate" DECIMAL(5,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commission_rule_audits" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT,
    "scope" "CommissionRuleScope" NOT NULL,
    "action" TEXT NOT NULL,
    "oldRate" DECIMAL(5,2),
    "newRate" DECIMAL(5,2),
    "productId" TEXT,
    "tagId" TEXT,
    "categoryId" TEXT,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_commission_rule_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_commissions" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "source" "CommissionSource" NOT NULL,
    "baseAmount" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "commissionAmount" DECIMAL(12,2) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_ledger_entries" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "type" "LedgerType" NOT NULL,
    "source" "LedgerSource" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "orderId" TEXT,
    "commissionId" TEXT,
    "paymentId" TEXT,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "prevHash" CHAR(64),
    "hash" CHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payment_requests" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "amountRequested" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "affiliate_payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_payments" (
    "id" TEXT NOT NULL,
    "affiliateId" TEXT NOT NULL,
    "paymentRequestId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'SENT',
    "errorMessage" TEXT,
    "htmlBody" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "openCount" INTEGER NOT NULL DEFAULT 0,
    "clickedAt" TIMESTAMP(3),
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newsletter_gift_logs" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'welcome',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "newsletter_gift_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProductToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_CouponStackable" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_CouponStackable_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_passwordResetToken_key" ON "users"("passwordResetToken");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_cccd_key" ON "users"("cccd");

-- CreateIndex
CREATE UNIQUE INDEX "users_mst_key" ON "users"("mst");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "carts_userId_key" ON "carts"("userId");

-- CreateIndex
CREATE INDEX "carts_updatedAt_idx" ON "carts"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "login_codes_userId_createdAt_idx" ON "login_codes"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_number_key" ON "orders"("number");

-- CreateIndex
CREATE INDEX "orders_userId_idx" ON "orders"("userId");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_deletedAt_idx" ON "orders"("deletedAt");

-- CreateIndex
CREATE INDEX "orders_referringAffiliateId_createdAt_idx" ON "orders"("referringAffiliateId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_userId_idempotencyKey_key" ON "orders"("userId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_quoteItemId_key" ON "order_items"("quoteItemId");

-- CreateIndex
CREATE INDEX "order_items_parentOrderItemId_idx" ON "order_items"("parentOrderItemId");

-- CreateIndex
CREATE INDEX "order_items_quoteItemId_idx" ON "order_items"("quoteItemId");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_brandId_idx" ON "products"("brandId");

-- CreateIndex
CREATE INDEX "products_slug_idx" ON "products"("slug");

-- CreateIndex
CREATE INDEX "products_displayPrice_idx" ON "products"("displayPrice");

-- CreateIndex
CREATE INDEX "products_salesCount_idx" ON "products"("salesCount");

-- CreateIndex
CREATE INDEX "product_variations_deletedAt_idx" ON "product_variations"("deletedAt");

-- CreateIndex
CREATE INDEX "product_variations_attributeValueId_idx" ON "product_variations"("attributeValueId");

-- CreateIndex
CREATE INDEX "product_variation_images_variationId_idx" ON "product_variation_images"("variationId");

-- CreateIndex
CREATE INDEX "media_files_whitelistedAt_idx" ON "media_files"("whitelistedAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_caption_presets_name_key" ON "media_caption_presets"("name");

-- CreateIndex
CREATE INDEX "media_caption_presets_order_idx" ON "media_caption_presets"("order");

-- CreateIndex
CREATE INDEX "product_images_productId_idx" ON "product_images"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "product_categories_productId_idx" ON "product_categories"("productId");

-- CreateIndex
CREATE INDEX "product_categories_categoryId_idx" ON "product_categories"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_productId_categoryId_key" ON "product_categories"("productId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_slug_idx" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE INDEX "brands_slug_idx" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "sku_counters_brand_id_key" ON "sku_counters"("brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "scale_rule_sets_name_key" ON "scale_rule_sets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "scale_rule_items_ruleSetId_name_key" ON "scale_rule_items"("ruleSetId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_affiliateId_idx" ON "coupons"("affiliateId");

-- CreateIndex
CREATE INDEX "order_coupons_orderId_idx" ON "order_coupons"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_coupons_orderId_couponId_key" ON "order_coupons"("orderId", "couponId");

-- CreateIndex
CREATE INDEX "coupon_usages_couponId_idx" ON "coupon_usages"("couponId");

-- CreateIndex
CREATE INDEX "coupon_usages_userId_idx" ON "coupon_usages"("userId");

-- CreateIndex
CREATE INDEX "free_gifts_isActive_startsAt_endsAt_idx" ON "free_gifts"("isActive", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "free_gifts_productId_idx" ON "free_gifts"("productId");

-- CreateIndex
CREATE INDEX "order_status_history_orderId_idx" ON "order_status_history"("orderId");

-- CreateIndex
CREATE INDEX "bundle_components_parentProductId_idx" ON "bundle_components"("parentProductId");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_components_parentProductId_childProductId_childVaria_key" ON "bundle_components"("parentProductId", "childProductId", "childVariationId");

-- CreateIndex
CREATE UNIQUE INDEX "bundles_slug_key" ON "bundles"("slug");

-- CreateIndex
CREATE INDEX "bundles_slug_idx" ON "bundles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "bundle_items_bundleId_productId_key" ON "bundle_items"("bundleId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_externalId_key" ON "payments"("externalId");

-- CreateIndex
CREATE INDEX "payments_orderId_idx" ON "payments"("orderId");

-- CreateIndex
CREATE INDEX "payments_externalId_idx" ON "payments"("externalId");

-- CreateIndex
CREATE INDEX "payment_events_paymentId_idx" ON "payment_events"("paymentId");

-- CreateIndex
CREATE INDEX "payment_events_orderId_idx" ON "payment_events"("orderId");

-- CreateIndex
CREATE INDEX "payment_events_createdAt_idx" ON "payment_events"("createdAt");

-- CreateIndex
CREATE INDEX "stock_audit_logs_productId_idx" ON "stock_audit_logs"("productId");

-- CreateIndex
CREATE INDEX "stock_audit_logs_variationId_idx" ON "stock_audit_logs"("variationId");

-- CreateIndex
CREATE INDEX "stock_audit_logs_createdAt_idx" ON "stock_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "stock_audit_logs_productId_createdAt_idx" ON "stock_audit_logs"("productId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "checkout_logs_orderId_idx" ON "checkout_logs"("orderId");

-- CreateIndex
CREATE INDEX "checkout_logs_userId_idx" ON "checkout_logs"("userId");

-- CreateIndex
CREATE INDEX "checkout_logs_step_idx" ON "checkout_logs"("step");

-- CreateIndex
CREATE INDEX "checkout_logs_createdAt_idx" ON "checkout_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "seo_meta_entityType_entityId_key" ON "seo_meta"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_slug_idx" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_isPublished_idx" ON "blog_posts"("isPublished");

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_slug_idx" ON "pages"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_name_key" ON "attributes"("name");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_slug_key" ON "attributes"("slug");

-- CreateIndex
CREATE INDEX "attributes_slug_idx" ON "attributes"("slug");

-- CreateIndex
CREATE INDEX "attributes_deletedAt_idx" ON "attributes"("deletedAt");

-- CreateIndex
CREATE INDEX "attribute_values_deletedAt_idx" ON "attribute_values"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_values_attributeId_slug_key" ON "attribute_values"("attributeId", "slug");

-- CreateIndex
CREATE INDEX "product_attributes_productId_idx" ON "product_attributes"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_attributes_productId_attributeValueId_key" ON "product_attributes"("productId", "attributeValueId");

-- CreateIndex
CREATE INDEX "related_products_productId_idx" ON "related_products"("productId");

-- CreateIndex
CREATE INDEX "reviews_productId_idx" ON "reviews"("productId");

-- CreateIndex
CREATE INDEX "reviews_inviteId_idx" ON "reviews"("inviteId");

-- CreateIndex
CREATE INDEX "reviews_isHighlightedOnHome_isApproved_idx" ON "reviews"("isHighlightedOnHome", "isApproved");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_productId_userId_orderId_key" ON "reviews"("productId", "userId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "site_reviews_orderId_key" ON "site_reviews"("orderId");

-- CreateIndex
CREATE INDEX "site_reviews_userId_idx" ON "site_reviews"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "review_invites_orderId_key" ON "review_invites"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "review_invites_token_key" ON "review_invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "review_invites_couponId_key" ON "review_invites"("couponId");

-- CreateIndex
CREATE INDEX "review_invites_userId_idx" ON "review_invites"("userId");

-- CreateIndex
CREATE INDEX "review_invites_tokenExpiresAt_idx" ON "review_invites"("tokenExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "review_rewards_reviewId_key" ON "review_rewards"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_userId_productId_key" ON "wishlist_items"("userId", "productId");

-- CreateIndex
CREATE INDEX "recently_viewed_user_id_viewed_at_idx" ON "recently_viewed"("user_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "recently_viewed_session_id_viewed_at_idx" ON "recently_viewed"("session_id", "viewed_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "recently_viewed_session_id_product_id_key" ON "recently_viewed"("session_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_type_key" ON "email_templates"("type");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_methods_serviceId_key" ON "shipping_methods"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "featured_categories_isActive_order_idx" ON "featured_categories"("isActive", "order");

-- CreateIndex
CREATE UNIQUE INDEX "featured_categories_categoryId_key" ON "featured_categories"("categoryId");

-- CreateIndex
CREATE INDEX "banners_isActive_order_idx" ON "banners"("isActive", "order");

-- CreateIndex
CREATE INDEX "banners_startDate_endDate_idx" ON "banners"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_email_key" ON "newsletter_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_confirmationToken_key" ON "newsletter_subscribers"("confirmationToken");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_subscribers_unsubscribeToken_key" ON "newsletter_subscribers"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_createdAt_idx" ON "newsletter_subscribers"("createdAt");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_unsubscribedAt_idx" ON "newsletter_subscribers"("unsubscribedAt");

-- CreateIndex
CREATE INDEX "newsletter_subscribers_confirmedAt_idx" ON "newsletter_subscribers"("confirmedAt");

-- CreateIndex
CREATE INDEX "email_campaigns_status_scheduledFor_idx" ON "email_campaigns"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "email_campaigns_createdAt_idx" ON "email_campaigns"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "colors_name_key" ON "colors"("name");

-- CreateIndex
CREATE UNIQUE INDEX "colors_slug_key" ON "colors"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "materials_name_key" ON "materials"("name");

-- CreateIndex
CREATE UNIQUE INDEX "materials_slug_key" ON "materials"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "google_categories_path_key" ON "google_categories"("path");

-- CreateIndex
CREATE INDEX "google_categories_parentId_idx" ON "google_categories"("parentId");

-- CreateIndex
CREATE INDEX "google_categories_name_idx" ON "google_categories"("name");

-- CreateIndex
CREATE INDEX "product_questions_productId_status_createdAt_idx" ON "product_questions"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "product_questions_status_createdAt_idx" ON "product_questions"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "custom_quotes_number_key" ON "custom_quotes"("number");

-- CreateIndex
CREATE UNIQUE INDEX "custom_quotes_token_key" ON "custom_quotes"("token");

-- CreateIndex
CREATE INDEX "custom_quotes_customerEmail_idx" ON "custom_quotes"("customerEmail");

-- CreateIndex
CREATE INDEX "custom_quotes_userId_idx" ON "custom_quotes"("userId");

-- CreateIndex
CREATE INDEX "custom_quotes_status_idx" ON "custom_quotes"("status");

-- CreateIndex
CREATE INDEX "custom_quotes_token_idx" ON "custom_quotes"("token");

-- CreateIndex
CREATE INDEX "custom_quotes_expiresAt_idx" ON "custom_quotes"("expiresAt");

-- CreateIndex
CREATE INDEX "custom_quote_items_quoteId_idx" ON "custom_quote_items"("quoteId");

-- CreateIndex
CREATE INDEX "custom_quote_items_status_idx" ON "custom_quote_items"("status");

-- CreateIndex
CREATE INDEX "custom_quote_images_quoteId_idx" ON "custom_quote_images"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_accounts_userId_key" ON "affiliate_accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_accounts_publicId_key" ON "affiliate_accounts"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_accounts_publicCode_key" ON "affiliate_accounts"("publicCode");

-- CreateIndex
CREATE INDEX "affiliate_accounts_status_idx" ON "affiliate_accounts"("status");

-- CreateIndex
CREATE INDEX "affiliate_visits_affiliateId_createdAt_idx" ON "affiliate_visits"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "affiliate_visits_sessionId_idx" ON "affiliate_visits"("sessionId");

-- CreateIndex
CREATE INDEX "affiliate_visits_createdAt_idx" ON "affiliate_visits"("createdAt");

-- CreateIndex
CREATE INDEX "affiliate_visits_convertedOrderId_idx" ON "affiliate_visits"("convertedOrderId");

-- CreateIndex
CREATE INDEX "affiliate_commission_rules_scope_idx" ON "affiliate_commission_rules"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commission_rules_scope_productId_key" ON "affiliate_commission_rules"("scope", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commission_rules_scope_tagId_key" ON "affiliate_commission_rules"("scope", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commission_rules_scope_categoryId_key" ON "affiliate_commission_rules"("scope", "categoryId");

-- CreateIndex
CREATE INDEX "affiliate_commission_rule_audits_ruleId_idx" ON "affiliate_commission_rule_audits"("ruleId");

-- CreateIndex
CREATE INDEX "affiliate_commission_rule_audits_changedByUserId_changedAt_idx" ON "affiliate_commission_rule_audits"("changedByUserId", "changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_commissions_orderItemId_key" ON "affiliate_commissions"("orderItemId");

-- CreateIndex
CREATE INDEX "affiliate_commissions_status_idx" ON "affiliate_commissions"("status");

-- CreateIndex
CREATE INDEX "affiliate_commissions_affiliateId_status_idx" ON "affiliate_commissions"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "affiliate_commissions_orderId_idx" ON "affiliate_commissions"("orderId");

-- CreateIndex
CREATE INDEX "affiliate_commissions_createdAt_idx" ON "affiliate_commissions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_ledger_entries_commissionId_key" ON "affiliate_ledger_entries"("commissionId");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_ledger_entries_paymentId_key" ON "affiliate_ledger_entries"("paymentId");

-- CreateIndex
CREATE INDEX "affiliate_ledger_entries_affiliateId_createdAt_idx" ON "affiliate_ledger_entries"("affiliateId", "createdAt");

-- CreateIndex
CREATE INDEX "affiliate_ledger_entries_affiliateId_type_idx" ON "affiliate_ledger_entries"("affiliateId", "type");

-- CreateIndex
CREATE INDEX "affiliate_ledger_entries_orderId_idx" ON "affiliate_ledger_entries"("orderId");

-- CreateIndex
CREATE INDEX "affiliate_payment_requests_affiliateId_status_idx" ON "affiliate_payment_requests"("affiliateId", "status");

-- CreateIndex
CREATE INDEX "affiliate_payment_requests_status_requestedAt_idx" ON "affiliate_payment_requests"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "affiliate_payments_affiliateId_paidAt_idx" ON "affiliate_payments"("affiliateId", "paidAt");

-- CreateIndex
CREATE INDEX "affiliate_payments_paymentRequestId_idx" ON "affiliate_payments"("paymentRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "email_logs_providerMessageId_key" ON "email_logs"("providerMessageId");

-- CreateIndex
CREATE INDEX "email_logs_type_sentAt_idx" ON "email_logs"("type", "sentAt");

-- CreateIndex
CREATE INDEX "email_logs_recipient_idx" ON "email_logs"("recipient");

-- CreateIndex
CREATE INDEX "email_logs_status_sentAt_idx" ON "email_logs"("status", "sentAt");

-- CreateIndex
CREATE INDEX "email_logs_sentAt_idx" ON "email_logs"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_gift_logs_email_key" ON "newsletter_gift_logs"("email");

-- CreateIndex
CREATE UNIQUE INDEX "newsletter_gift_logs_couponId_key" ON "newsletter_gift_logs"("couponId");

-- CreateIndex
CREATE INDEX "newsletter_gift_logs_grantedAt_idx" ON "newsletter_gift_logs"("grantedAt");

-- CreateIndex
CREATE INDEX "_ProductToTag_B_index" ON "_ProductToTag"("B");

-- CreateIndex
CREATE INDEX "_CouponStackable_B_index" ON "_CouponStackable"("B");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_codes" ADD CONSTRAINT "login_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_referringAffiliateId_fkey" FOREIGN KEY ("referringAffiliateId") REFERENCES "affiliate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quoteItemId_fkey" FOREIGN KEY ("quoteItemId") REFERENCES "custom_quote_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_parentOrderItemId_fkey" FOREIGN KEY ("parentOrderItemId") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_googleCategoryId_fkey" FOREIGN KEY ("googleCategoryId") REFERENCES "google_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_scaleRuleSetId_fkey" FOREIGN KEY ("scaleRuleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variations" ADD CONSTRAINT "product_variations_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "attribute_values"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variation_images" ADD CONSTRAINT "product_variation_images_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variation_images" ADD CONSTRAINT "product_variation_images_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_captionPresetId_fkey" FOREIGN KEY ("captionPresetId") REFERENCES "media_caption_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_scaleRuleSetId_fkey" FOREIGN KEY ("scaleRuleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_googleCategoryId_fkey" FOREIGN KEY ("googleCategoryId") REFERENCES "google_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_scaleRuleSetId_fkey" FOREIGN KEY ("scaleRuleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_scale_rule_set_id_fkey" FOREIGN KEY ("scale_rule_set_id") REFERENCES "scale_rule_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sku_counters" ADD CONSTRAINT "sku_counters_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scale_rule_items" ADD CONSTRAINT "scale_rule_items_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "scale_rule_sets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_coupons" ADD CONSTRAINT "order_coupons_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_coupons" ADD CONSTRAINT "order_coupons_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "coupon_usages_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "free_gifts" ADD CONSTRAINT "free_gifts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_parentProductId_fkey" FOREIGN KEY ("parentProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_childProductId_fkey" FOREIGN KEY ("childProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_components" ADD CONSTRAINT "bundle_components_childVariationId_fkey" FOREIGN KEY ("childVariationId") REFERENCES "product_variations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit_logs" ADD CONSTRAINT "stock_audit_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_audit_logs" ADD CONSTRAINT "stock_audit_logs_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "product_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attributes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attributes" ADD CONSTRAINT "product_attributes_attributeValueId_fkey" FOREIGN KEY ("attributeValueId") REFERENCES "attribute_values"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "related_products" ADD CONSTRAINT "related_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "review_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_reviews" ADD CONSTRAINT "site_reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_reviews" ADD CONSTRAINT "site_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_invites" ADD CONSTRAINT "review_invites_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_invites" ADD CONSTRAINT "review_invites_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_invites" ADD CONSTRAINT "review_invites_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_rewards" ADD CONSTRAINT "review_rewards_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_rewards" ADD CONSTRAINT "review_rewards_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recently_viewed" ADD CONSTRAINT "recently_viewed_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "featured_categories" ADD CONSTRAINT "featured_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_categories" ADD CONSTRAINT "google_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "google_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_quotes" ADD CONSTRAINT "custom_quotes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_quote_items" ADD CONSTRAINT "custom_quote_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "custom_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_quote_images" ADD CONSTRAINT "custom_quote_images_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "custom_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_quote_images" ADD CONSTRAINT "custom_quote_images_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "media_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_accounts" ADD CONSTRAINT "affiliate_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_visits" ADD CONSTRAINT "affiliate_visits_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commission_rules" ADD CONSTRAINT "affiliate_commission_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commission_rules" ADD CONSTRAINT "affiliate_commission_rules_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commission_rules" ADD CONSTRAINT "affiliate_commission_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_commissions" ADD CONSTRAINT "affiliate_commissions_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "affiliate_commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_ledger_entries" ADD CONSTRAINT "affiliate_ledger_entries_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "affiliate_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payment_requests" ADD CONSTRAINT "affiliate_payment_requests_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payments" ADD CONSTRAINT "affiliate_payments_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_payments" ADD CONSTRAINT "affiliate_payments_paymentRequestId_fkey" FOREIGN KEY ("paymentRequestId") REFERENCES "affiliate_payment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "newsletter_gift_logs" ADD CONSTRAINT "newsletter_gift_logs_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToTag" ADD CONSTRAINT "_ProductToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToTag" ADD CONSTRAINT "_ProductToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponStackable" ADD CONSTRAINT "_CouponStackable_A_fkey" FOREIGN KEY ("A") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CouponStackable" ADD CONSTRAINT "_CouponStackable_B_fkey" FOREIGN KEY ("B") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
