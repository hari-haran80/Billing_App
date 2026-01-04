export const saveBillToDB = async (customerName, billItems, total) => {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Insert bill header
      tx.executeSql(
        'INSERT INTO bills (customer_name, total_amount, is_synced) VALUES (?, ?, 0)',
        [customerName, total],
        (_, result) => {
          const billId = result.insertId;
          
          // Insert each bill item with hidden reduced weight
          billItems.forEach(item => {
            tx.executeSql(
              `INSERT INTO bill_items 
               (bill_id, item_id, original_weight, reduced_weight, final_weight, price_per_kg, amount) 
               VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                billId, 
                item.itemId, 
                item.originalWeight,
                item.reducedWeight, // Stored in DB
                (parseFloat(item.originalWeight) - parseFloat(item.reducedWeight)), // Shown to customer
                item.price,
                item.amount
              ]
            );

            // Update item's last price for future auto-fill
            tx.executeSql(
              'UPDATE items SET last_price_per_kg = ? WHERE id = ?',
              [item.price, item.itemId]
            );
          });
          resolve(billId);
        },
        (_, error) => reject(error)
      );
    });
  });
};