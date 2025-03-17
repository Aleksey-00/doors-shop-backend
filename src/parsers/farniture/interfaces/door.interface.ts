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
}
