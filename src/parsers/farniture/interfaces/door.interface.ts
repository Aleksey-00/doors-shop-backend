export interface IDoor {
  title: string;
  price: number;
  oldPrice?: number;
  priceUnit?: string;
  categoryId: number;
  imageUrls: string[];
  thumbnailUrls?: string[];
  inStock: boolean;
  description?: string;
  specifications?: Record<string, string>;
  url: string;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
  };
  materials?: {
    frame?: string;
    coating?: string;
    insulation?: string;
  };
  equipment?: string[];
  features?: string[];
  manufacturer?: string;
  warranty?: string;
  installation?: {
    opening?: 'left' | 'right' | 'universal';
    type?: string;
  };
  sale?: {
    endDate: string;
    remainingQuantity: number;
  };
  lockCount?: number;
  metalThickness?: number;
  doorThickness?: number;
  exteriorFinish?: string;
  interiorFinish?: string;
  exteriorColor?: string;
  interiorColor?: string;
  sizes?: string[];
  country?: string;
  brand?: {
    name: string;
    logo: string;
    url: string;
  };
  rating?: {
    value: number;
    count: number;
  };
}
