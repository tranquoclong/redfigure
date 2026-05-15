import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/lib/constants';
import { getGeneral, getLoginFeaturedProduct } from '@/lib/site-content';

export async function AuthSideArt() {
  const [product, general] = await Promise.all([
    getLoginFeaturedProduct(),
    getGeneral(),
  ]);
  const badge = product
    ? general.loginBadgeFeatured
    : general.loginBadgeFallback;
  const title = product?.name ?? general.loginFallbackTitle;
  const subtitle = general.loginSubtitle;

  return (
    <div className="relative hidden overflow-hidden rounded-3xl border border-purple/25 bg-white/[0.02] lg:block">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 30%, rgba(255,0,122,0.55), transparent 60%), radial-gradient(80% 80% at 50% 90%, rgba(0,240,255,0.45), transparent 65%), linear-gradient(180deg,#1c0a40,#08021c)',
        }}
      />
      {product ? (
        <Link
          href={ROUTES.product(product.slug)}
          className="absolute inset-0 block"
          aria-label={`Ver ${product.name}`}
        >
          <Image
            src={product.imageUrl}
            alt={product.alt ?? product.name}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 0px, 540px"
            priority
            unoptimized
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08021c]/85 via-transparent to-transparent" />
        </Link>
      ) : (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 400 600"
          fill="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="auth-hg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ff66c4" />
              <stop offset="1" stopColor="#00f0ff" />
            </linearGradient>
          </defs>
          <g
            stroke="url(#auth-hg)"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          >
            <circle cx="200" cy="180" r="38" />
            <path d="M165 220 C 168 250 152 260 150 300 C 148 340 175 335 180 365 C 185 400 165 430 200 450 C 235 430 215 400 220 365 C 225 335 252 340 250 300 C 248 260 232 250 235 220" />
            <path d="M125 340 Q 200 380 275 340" />
            <path d="M140 440 Q 200 480 260 440" />
          </g>
        </svg>
      )}
      <div className="pointer-events-none absolute bottom-8 left-8 right-8">
        {badge && (
          <span className="inline-block rounded-full border border-purple/35 bg-purple/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-pink-soft [font-family:var(--font-orbitron)]">
            {badge}
          </span>
        )}
        {title && (
          <div className="mt-3 text-2xl text-white [font-family:var(--font-orbitron)]">
            {title}
          </div>
        )}
        {subtitle && <div className="text-sm text-cyan">{subtitle}</div>}
      </div>
    </div>
  );
}
