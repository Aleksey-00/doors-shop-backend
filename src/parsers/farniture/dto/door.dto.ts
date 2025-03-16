export class CreateDoorDto {
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

export class UpdateDoorDto extends CreateDoorDto {} 