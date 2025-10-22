export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  priceCents: number;
  createdAt: string;
}

export interface InventoryPage {
  items: InventoryItem[];
  page: number;
  limit: number;
  total: number;
  hasNext: boolean;
}
