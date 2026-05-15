

export interface FreeGiftPublic {
  id: string;
  minOrderAmount: number;
  label: string;
  product: {
    id: string;
    name: string;
    slug: string;
    image?: string;
  };
}
