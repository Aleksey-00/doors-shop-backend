export interface FindAllFilters {
  category?: string;
  priceMin?: number;
  priceMax?: number;
  inStock?: boolean;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'new';
  page?: number;
  limit?: number;
  search?: string;
} 