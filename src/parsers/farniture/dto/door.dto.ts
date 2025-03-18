export class CreateDoorDto {
  title: string;
  price: number;
  oldPrice?: number;
  categoryId: number;
  url: string;
  inStock?: boolean;
  images?: string[];
  description?: string;
  characteristics?: Record<string, string>;
  externalId?: string;
}

export class UpdateDoorDto extends CreateDoorDto {} 