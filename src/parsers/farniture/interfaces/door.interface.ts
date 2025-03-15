export interface IDoor {
  title: string;
  price: number;
  oldPrice?: number;
  category: string;
  imageUrls: string[];
  inStock: boolean;
  description?: string;
  specifications?: Record<string, string>;
  url: string;
}
