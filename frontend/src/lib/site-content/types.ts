

export interface MenuItem {

  label: string;

  href: string;

  children?: MenuItem[];

  external?: boolean;
}

export interface Banner {

  id: string;

  eyebrow?: string;

  title: string;

  subtitle?: string;

  primaryCta?: { label: string; href: string };

  secondaryCta?: { label: string; href: string };

  imageUrl?: string;

  stats?: Array<{ value: string; label: string }>;
}

export interface HomeCategoryCard {

  slug: string;

  label: string;

  glowColor: string;

  count?: number;
}

export interface HomeFeatureCard {

  number: string;

  title: string;

  description: string;
}

export interface HomeSection {

  id: string;

  eyebrow: string;

  title: string;

  seeAllLink?: { label: string; href: string };
}

export interface FooterColumn {

  title: string;

  links: Array<{ label: string; href: string }>;
}

export interface SocialLink {

  platform: 'facebook' | 'instagram' | 'twitter' | 'youtube' | 'tiktok';

  href: string;

  shortLabel: string;
}
