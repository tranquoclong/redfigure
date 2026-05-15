

export type {
  MenuItem,
  Banner,
  HomeCategoryCard,
  HomeFeatureCard,
  HomeSection,
  FooterColumn,
  SocialLink,
} from './types';
export type { TopBarMessage, TopBarConfig } from './top-bar';
export type { MarqueeConfig } from './marquee';
export type { GeneralConfig } from './general';
export type {
  MegaMenuBadge,
  MegaMenuLink,
  MegaMenuColumn,
  MegaMenuFeaturedImage,
  MegaMenuItem,
  MegaMenuConfig,
} from './megamenu';

export {
  defaultTopBar,
  getTopBar,
  TOPBAR_CACHE_TAG,
} from './top-bar';
export {
  defaultMarquee,
  getMarquee,
  MARQUEE_CACHE_TAG,
} from './marquee';
export {
  defaultGeneral,
  getGeneral,
  GENERAL_CACHE_TAG,
} from './general';
export type { LoginFeaturedProduct } from './login-featured';
export {
  getLoginFeaturedProduct,
  LOGIN_FEATURED_CACHE_TAG,
} from './login-featured';

export {
  defaultMegaMenu,
  getMegaMenu,
  MEGAMENU_CACHE_TAG,
} from './megamenu';

export { menuItems } from './menu';
export {
  homeBanners,
  defaultBanners,
  getActiveBanners,
  BANNERS_CACHE_TAG,
} from './home-banners';
export {
  homeSectionMeta,
  homeCategoryCards,
  homeFeatureCards,
  getFeaturedCategoryCards,
  FEATURED_CATEGORIES_CACHE_TAG,
} from './home-sections';
export {
  footerColumns,
  socialLinks,
  footerLegal,
  getFooter,
  FOOTER_CACHE_TAG,
} from './footer-columns';
export type { FooterData } from './footer-columns';

