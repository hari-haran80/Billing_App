import { getDb } from "./database";

type BillItem = {
  itemId: number;
  originalWeight: number | string;
  reducedWeight: number | string;
  price: number;
  amount: number;
};

export const saveBillToDB = async (
  customerName: string,
  billItems: BillItem[],
  total: number
): Promise<number> => {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  try {
    const billResult = await db.runAsync(
      "INSERT INTO bills (customer_name, total_amount, is_synced) VALUES (?, ?, 0)",
      [customerName, total]
    );

    const billId = billResult.lastInsertRowId;

    for (const item of billItems) {
      const original = Number(item.originalWeight) || 0;
      const reduced = Number(item.reducedWeight) || 0;
      const finalWeight = original - reduced;

      await db.runAsync(
        `INSERT INTO bill_items
         (bill_id, item_id, original_weight, reduced_weight, final_weight, price_per_kg, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          billId,
          item.itemId,
          original,
          reduced,
          finalWeight,
          item.price,
          item.amount,
        ]
      );

      await db.runAsync(
        "UPDATE items SET last_price_per_kg = ? WHERE id = ?",
        [item.price, item.itemId]
      );
    }

    return billId;
  } catch (error) {
    console.error("Save bill failed:", error);
    throw error;
  }
};
