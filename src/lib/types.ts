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
  outOfStock: boolean; // «Временно нет в наличии» — флаг, товар виден, но купить нельзя
  requiresConfirmation: boolean; // точная версия/комплект ещё не подтверждены
  hasVariants: boolean;
  stockQty: number; // для быстрого добавления в корзину с карточки (товары без вариантов)
  weightGrams: number | null;
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
  weightGrams: number | null;
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
  /** Старые записи localStorage могут не иметь поля — тогда считаем товар неподтверждённым. */
  requiresConfirmation?: boolean;
};
