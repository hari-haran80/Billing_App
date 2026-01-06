import { getDb } from "./database";

export const saveBillToDB = async (customerName, billItems, total) => {
  const db = getDb();
  if (!db) throw new Error("Database not available");

  try {
    // Insert bill header
    const billResult = await db.runAsync(
      "INSERT INTO bills (customer_name, total_amount, is_synced) VALUES (?, ?, 0)",
      [customerName, total]
    );
    const billId = billResult.lastInsertRowId;

    // Insert each bill item with hidden reduced weight
    for (const item of billItems) {
      await db.runAsync(
        `INSERT INTO bill_items
         (bill_id, item_id, original_weight, reduced_weight, final_weight, price_per_kg, amount)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          billId,
          item.itemId,
          item.originalWeight,
          item.reducedWeight, // Stored in DB
          parseFloat(item.originalWeight) - parseFloat(item.reducedWeight), // Shown to customer
          item.price,
          item.amount,
        ]
      );

      // Update item's last price for future auto-fill
      await db.runAsync("UPDATE items SET last_price_per_kg = ? WHERE id = ?", [
        item.price,
        item.itemId,
      ]);
    }

    return billId;
  } catch (error) {
    throw error;
  }
};
