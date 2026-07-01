// Сериализуемые формы данных для клиентских компонентов (карточки, корзина, избранное).

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  priceKopecks: number;
  oldPriceKopecks: number | null;
  badge: string | null;
  image: string | null;
  categoryName?: string;
  inStock: boolean;
  hasVariants: boolean;
};

export type CartItem = {
  /** Уникальный ключ позиции: productId или productId:variantId */
  key: string;
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  image: string | null;
  priceKopecks: number;
  quantity: number;
  maxStock: number;
};

export type FavoriteItem = {
  id: string;
  slug: string;
  name: string;
  priceKopecks: number;
  oldPriceKopecks: number | null;
  badge: string | null;
  image: string | null;
  inStock: boolean;
  hasVariants: boolean;
};
