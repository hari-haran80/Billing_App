export interface BillItem {
  itemName: string;
  unitType: "weight" | "count";
  quantity?: number;
  pricePerUnit?: number;
  pricePerKg?: number;
  originalWeight?: number;
  lWeight?: number;
  reducedWeight?: number;
  finalWeight?: number;
  weightMode?: string;
  amount: number;
  weightEntries?: Array<{ weight: string; weightMode: string }>;
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
