export interface BillItem {
  itemName: string;
  unitType: "weight" | "count";
  quantity?: number;
  pricePerUnit?: number;
  pricePerKg?: number;
  lWeight?: number;
  amount: number;
}

export interface BillData {
  id?: number;
  billNumber: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  date: string;
  isSynced?: boolean;
  items: BillItem[];
}
