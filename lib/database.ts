// lib/database.ts - UPDATED SCHEMA
import * as SQLite from "expo-sqlite";
import { Platform } from "react-native";

interface TableInfoRow {
  name: string;
}

interface WeightSettingRow {
  setting_value: number;
}

interface CountRow {
  count: number;
}

interface ItemRow {
  id: number;
  name: string;
  unit_type: "weight" | "count";
}

interface BottleRow {
  name: string;
}

interface BillRow {
  id: number;
  bill_number: string;
  customer_name: string;
  customer_phone?: string;
  total_amount: number;
  date: string;
}

interface BillNumberRow {
  bill_number: string;
}

let db: SQLite.SQLiteDatabase | null = null;
let isInitialized = false;

export const initDatabase = async () => {
  if (Platform.OS === "web") {
    console.log("[DB] Web platform, using mock database");
    return;
  }

  try {
    console.log("[DB] Opening database...");
    db = await SQLite.openDatabaseAsync("scrapbill.db");
    console.log("[DB] Database opened successfully, db =", !!db);

    if (!db) {
      throw new Error("Database object is null after opening");
    }

    console.log("[DB] Creating tables...");
    // Create tables one by one to isolate any issues
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        unit_type TEXT DEFAULT 'weight',
        last_price_per_kg REAL DEFAULT 0,
        last_price_per_unit REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bills (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_number TEXT UNIQUE NOT NULL,
        customer_name TEXT DEFAULT 'Walk-in Customer',
        customer_phone TEXT,
        total_amount REAL NOT NULL,
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_synced BOOLEAN DEFAULT 0,
        sync_attempts INTEGER DEFAULT 0,
        last_sync_attempt DATETIME
      )
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bill_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        original_weight REAL DEFAULT 0,
        l_weight REAL DEFAULT 0,
        quantity INTEGER DEFAULT 1,
        final_weight REAL NOT NULL,
        weight_mode TEXT DEFAULT 'normal',
        price_per_kg REAL DEFAULT 0,
        price_per_unit REAL DEFAULT 0,
        amount REAL NOT NULL,
        reduced_weight REAL DEFAULT 0,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (item_id) REFERENCES items(id)
      )
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bottle_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        standard_weight REAL DEFAULT 0,
        price_per_unit REAL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS weight_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value REAL DEFAULT 0,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bill_id INTEGER NOT NULL,
        operation TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE
      )
    `);
    console.log("[DB] Tables created successfully");

    // Insert default weight reduction setting
    await db.runAsync(`
      INSERT OR IGNORE INTO weight_settings (setting_key, setting_value, description) 
      VALUES ('l_mode_reduction_per_kg', 0.1, 'Weight reduced per 1kg in L mode (e.g., 0.1 = 100g reduction)')
    `);
    console.log("[DB] Default settings inserted");

    // Add missing columns if they don't exist
    await addMissingColumns();

    isInitialized = true;
    console.log("[DB] Database initialized successfully");
  } catch (error) {
    console.error("[DB] Error initializing database:", error);
    // Reset db on error
    db = null;
    isInitialized = false;
  }
};

// Helper function to add missing columns
const addMissingColumns = async () => {
  if (!db) return;

  try {
    // Check if last_price_per_unit column exists in items table
    const tableInfo = await db.getAllAsync<TableInfoRow>(
      "PRAGMA table_info(items)"
    );
    const hasLastPricePerUnit = tableInfo.some(
      (col) => col.name === "last_price_per_unit"
    );

    if (!hasLastPricePerUnit) {
      console.log("[DB] Adding last_price_per_unit column to items table");
      await db.runAsync(
        "ALTER TABLE items ADD COLUMN last_price_per_unit REAL DEFAULT 0"
      );
    }

    // Check if price_per_unit column exists in bill_items table
    const billItemsInfo = await db.getAllAsync<TableInfoRow>(
      "PRAGMA table_info(bill_items)"
    );
    const hasPricePerUnit = billItemsInfo.some(
      (col) => col.name === "price_per_unit"
    );

    if (!hasPricePerUnit) {
      console.log("[DB] Adding price_per_unit column to bill_items table");
      await db.runAsync(
        "ALTER TABLE bill_items ADD COLUMN price_per_unit REAL DEFAULT 0"
      );
    }

    // Check if quantity column exists in bill_items table
    const hasQuantity = billItemsInfo.some((col) => col.name === "quantity");

    if (!hasQuantity) {
      console.log("[DB] Adding quantity column to bill_items table");
      await db.runAsync(
        "ALTER TABLE bill_items ADD COLUMN quantity INTEGER DEFAULT 1"
      );
    }

    // Check if l_weight column exists in bill_items table
    const hasLWeight = billItemsInfo.some((col) => col.name === "l_weight");

    if (!hasLWeight) {
      console.log("[DB] Adding l_weight column to bill_items table");
      await db.runAsync(
        "ALTER TABLE bill_items ADD COLUMN l_weight REAL DEFAULT 0"
      );
    }

    // Check if weight_mode column exists in bill_items table
    const hasWeightMode = billItemsInfo.some(
      (col) => col.name === "weight_mode"
    );

    if (!hasWeightMode) {
      console.log("[DB] Adding weight_mode column to bill_items table");
      await db.runAsync(
        "ALTER TABLE bill_items ADD COLUMN weight_mode TEXT DEFAULT 'normal'"
      );
    }

    // Check if reduced_weight column exists in bill_items table
    const hasReducedWeight = billItemsInfo.some(
      (col) => col.name === "reduced_weight"
    );

    if (!hasReducedWeight) {
      console.log("[DB] Adding reduced_weight column to bill_items table");
      await db.runAsync(
        "ALTER TABLE bill_items ADD COLUMN reduced_weight REAL DEFAULT 0"
      );
    }

    // Check if sync_attempts column exists in bills table
    const billsInfo = await db.getAllAsync<TableInfoRow>(
      "PRAGMA table_info(bills)"
    );
    const hasSyncAttempts = billsInfo.some(
      (col) => col.name === "sync_attempts"
    );

    if (!hasSyncAttempts) {
      console.log("[DB] Adding sync_attempts column to bills table");
      await db.runAsync(
        "ALTER TABLE bills ADD COLUMN sync_attempts INTEGER DEFAULT 0"
      );
    }

    // Check if last_sync_attempt column exists in bills table
    const hasLastSyncAttempt = billsInfo.some(
      (col) => col.name === "last_sync_attempt"
    );

    if (!hasLastSyncAttempt) {
      console.log("[DB] Adding last_sync_attempt column to bills table");
      await db.runAsync(
        "ALTER TABLE bills ADD COLUMN last_sync_attempt DATETIME"
      );
    }
  } catch (error) {
    console.error("[DB] Error adding missing columns:", error);
  }
};

export const resetDatabase = async () => {
  if (!db) throw new Error("Database not initialized");

  try {
    console.log("[DB] Resetting database...");

    // Drop all tables
    await db.execAsync(`
      DROP TABLE IF EXISTS sync_queue;
      DROP TABLE IF EXISTS weight_settings;
      DROP TABLE IF EXISTS bottle_types;
      DROP TABLE IF EXISTS bill_items;
      DROP TABLE IF EXISTS bills;
      DROP TABLE IF EXISTS items;
    `);

    // Close and reopen database to ensure clean state
    await db.closeAsync();
    db = null;
    isInitialized = false;

    // Reinitialize
    await initDatabase();

    console.log("[DB] Database reset successfully");
  } catch (error) {
    console.error("[DB] Error resetting database:", error);
    throw error;
  }
};

// Weight Management Functions
export const getWeightReduction = async () => {
  if (!db) throw new Error("Database not initialized");
  const result = await db.getFirstAsync<WeightSettingRow>(
    "SELECT setting_value FROM weight_settings WHERE setting_key = ?",
    ["l_mode_reduction_per_kg"]
  );
  return result?.setting_value || 0.1;
};

export const updateWeightReduction = async (reduction: number) => {
  if (!db) throw new Error("Database not initialized");
  await db.runAsync(
    "INSERT OR REPLACE INTO weight_settings (setting_key, setting_value, description, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
    ["l_mode_reduction_per_kg", reduction, "Weight reduced per 1kg in L mode"]
  );
};

// Item Management Functions
export const getAllItems = async () => {
  if (!db) throw new Error("Database not initialized");
  return await db.getAllAsync(`
    SELECT * FROM items 
    ORDER BY name ASC
  `);
};

export const getBottleTypes = async () => {
  if (!db) throw new Error("Database not initialized");
  return await db.getAllAsync("SELECT * FROM bottle_types ORDER BY name");
};

export const addNewItem = async (
  name: string,
  price: number,
  unitType: string = "weight"
) => {
  if (!db) throw new Error("Database not initialized");

  const safeName = name.trim();
  if (!safeName) throw new Error("Item name cannot be empty");

  if (unitType === "count") {
    return await db.runAsync(
      "INSERT INTO items (name, unit_type, last_price_per_unit) VALUES (?, ?, ?)",
      [safeName, unitType, price || 0]
    );
  } else {
    return await db.runAsync(
      "INSERT INTO items (name, unit_type, last_price_per_kg) VALUES (?, ?, ?)",
      [safeName, unitType, price || 0]
    );
  }
};

export const updateItemPrice = async (
  itemId: number,
  price: number,
  unitType: string = "weight"
) => {
  if (!db) throw new Error("Database not initialized");

  if (unitType === "count") {
    await db.runAsync("UPDATE items SET last_price_per_unit = ? WHERE id = ?", [
      price,
      itemId,
    ]);
  } else {
    await db.runAsync("UPDATE items SET last_price_per_kg = ? WHERE id = ?", [
      price,
      itemId,
    ]);
  }
};

export const deleteItem = async (id: number) => {
  if (!db) throw new Error("Database not initialized");

  // First check if item exists in any bills
  const billItems = await db.getAllAsync<CountRow>(
    "SELECT COUNT(*) as count FROM bill_items WHERE item_id = ?",
    [id]
  );

  if (billItems[0]?.count > 0) {
    throw new Error("Cannot delete item. It is used in existing bills.");
  }

  return await db.runAsync("DELETE FROM items WHERE id = ?", [id]);
};

export const deleteBottleType = async (id: number) => {
  if (!db) throw new Error("Database not initialized");

  // Get bottle name first
  const bottle = await db.getFirstAsync<BottleRow>(
    "SELECT name FROM bottle_types WHERE id = ?",
    [id]
  );

  if (!bottle) return;

  // Delete from bottle_types
  await db.runAsync("DELETE FROM bottle_types WHERE id = ?", [id]);

  // Delete from items table
  await db.runAsync("DELETE FROM items WHERE name = ?", [bottle.name]);
};

// Bulk delete functions
export const deleteMultipleItems = async (ids: number[]) => {
  if (!db) throw new Error("Database not initialized");

  for (const id of ids) {
    // Check if item exists in any bills
    const billItems = await db.getAllAsync<CountRow>(
      "SELECT COUNT(*) as count FROM bill_items WHERE item_id = ?",
      [id]
    );

    if (billItems[0]?.count > 0) {
      throw new Error(
        `Cannot delete item with ID ${id}. It is used in existing bills.`
      );
    }
  }

  await db.runAsync(`DELETE FROM items WHERE id IN (${ids.join(",")})`);
};

export const deleteMultipleBottles = async (ids: number[]) => {
  if (!db) throw new Error("Database not initialized");

  for (const id of ids) {
    // Get bottle name
    const bottle = await db.getFirstAsync<BottleRow>(
      "SELECT name FROM bottle_types WHERE id = ?",
      [id]
    );

    if (bottle) {
      // Delete from bottle_types
      await db.runAsync("DELETE FROM bottle_types WHERE id = ?", [id]);
      // Delete from items table
      await db.runAsync("DELETE FROM items WHERE name = ?", [bottle.name]);
    }
  }
};

// Bill Functions with Weight Mode Logic
export const getNextBillNumber = async (): Promise<string> => {
  if (!db) throw new Error("Database not initialized");

  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `FAM${dd}${mm}`;

  // Get the last bill number for today
  const result = await db.getAllAsync<BillNumberRow>(
    "SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY bill_number DESC LIMIT 1",
    [`${prefix}%`]
  );

  let nextNum = 1;
  if (result.length > 0) {
    const lastNum = parseInt(result[0].bill_number.slice(-4));
    nextNum = lastNum + 1;
  }

  return `${prefix}${String(nextNum).padStart(4, "0")}`;
};

export const saveBill = async (billData: any) => {
  if (!db) throw new Error("Database not initialized");

  const { billNumber, customerName, customerPhone, items } = billData;
  const weightReduction = await getWeightReduction(); // e.g., 0.1 for 10%

  // Compute total amount for the bill
  let totalAmount = 0;

  // Save bill header first (amount 0 for now, will update after items)
  const result = await db.runAsync(
    `INSERT INTO bills (bill_number, customer_name, customer_phone, total_amount) 
     VALUES (?, ?, ?, ?)`,
    [billNumber, customerName || "Walk-in Customer", customerPhone || "", 0]
  );

  const billId = result.lastInsertRowId;

  // Save bill items
  for (const item of items) {
    const itemDetails = await getItemById(item.itemId);

    let originalWeight = Number(item.weight) || 0;
    let quantity = item.quantity || 1;
    let lWeight = 0;
    let finalWeight = originalWeight;
    let reducedWeight = 0;
    let amount = 0;

    if (itemDetails?.unit_type === "count") {
      // Count-based items (bottles)
      amount = Number((quantity * item.price).toFixed(2));
      totalAmount += amount;

      await db.runAsync(
        `INSERT INTO bill_items 
        (bill_id, item_id, original_weight, l_weight, final_weight, weight_mode, price_per_kg, price_per_unit, amount, reduced_weight, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          billId,
          item.itemId,
          0,
          0,
          0,
          "normal",
          0,
          item.price,
          amount,
          0,
          quantity,
        ]
      );

      // Update item last price
      await db.runAsync(
        "UPDATE items SET last_price_per_unit = ? WHERE id = ?",
        [item.price, item.itemId]
      );
    } else {
      // Weight-based items
      if (item.weightMode === "L") {
        // L mode: entered weight is L weight, calculate gross weight
        lWeight = originalWeight;
        originalWeight = lWeight / (1 - weightReduction);
        finalWeight = originalWeight;
        reducedWeight = originalWeight - lWeight;
        amount = Number((lWeight * item.price).toFixed(2));
      } else {
        // Normal mode
        lWeight = 0;
        finalWeight = originalWeight;
        reducedWeight = 0;
        amount = Number((finalWeight * item.price).toFixed(2));
      }

      totalAmount += amount;

      await db.runAsync(
        `INSERT INTO bill_items 
        (bill_id, item_id, original_weight, l_weight, final_weight, weight_mode, price_per_kg, price_per_unit, amount, reduced_weight, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          billId,
          item.itemId,
          Number(originalWeight.toFixed(3)),
          Number(lWeight.toFixed(3)),
          Number(finalWeight.toFixed(3)),
          item.weightMode || "normal",
          item.price,
          0,
          amount,
          Number(reducedWeight.toFixed(3)),
          1,
        ]
      );

      // Update last price per kg
      await db.runAsync("UPDATE items SET last_price_per_kg = ? WHERE id = ?", [
        item.price,
        item.itemId,
      ]);
    }
  }

  // Update total amount in bill header
  await db.runAsync("UPDATE bills SET total_amount = ? WHERE id = ?", [
    Number(totalAmount.toFixed(2)),
    billId,
  ]);

  return billId;
};

export const getItemById = async (id: number) => {
  if (!db) throw new Error("Database not initialized");
  return await db.getFirstAsync<ItemRow>("SELECT * FROM items WHERE id = ?", [
    id,
  ]);
};

export const getAllBills = async () => {
  if (!db) throw new Error("Database not initialized");
  return await db.getAllAsync(`
    SELECT 
      b.*,
      GROUP_CONCAT(
        CASE 
          WHEN i.unit_type = 'count' THEN i.name || ' (' || bi.quantity || ' nos)'
          ELSE i.name || ' (' || CASE WHEN bi.weight_mode = 'L' THEN bi.l_weight ELSE bi.final_weight END || ' kg)'
        END
      ) as items_list,
      COUNT(bi.id) as item_count
    FROM bills b
    LEFT JOIN bill_items bi ON b.id = bi.bill_id
    LEFT JOIN items i ON bi.item_id = i.id
    GROUP BY b.id
    ORDER BY b.date DESC
  `);
};

export const getBillDetails = async (billId: number) => {
  if (!db) throw new Error("Database not initialized");

  const bill = await db.getFirstAsync<BillRow>(
    "SELECT * FROM bills WHERE id = ?",
    [billId]
  );
  const items = await db.getAllAsync(
    `
    SELECT 
      bi.*, 
      i.name as item_name,
      i.unit_type,
      bt.display_name as bottle_display_name
    FROM bill_items bi
    JOIN items i ON bi.item_id = i.id
    LEFT JOIN bottle_types bt ON i.name = bt.name
    WHERE bi.bill_id = ?
  `,
    [billId]
  );

  // Adjust items for L mode display
  const adjustedItems = items.map((item) => {
    if (item.weight_mode === "L") {
      return {
        ...item,
        final_weight: item.original_weight,
        amount: Number((item.l_weight * item.price_per_kg).toFixed(2)),
      };
    }
    return item;
  });

  return { ...bill, items: adjustedItems };
};

// Bottle Type Management
export const addBottleType = async (
  name: string,
  displayName: string,
  price: number,
  weight: number = 0.3
) => {
  if (!db) throw new Error("Database not initialized");

  const safeName = name.trim().toLowerCase().replace(/\s+/g, "_");
  const safeDisplayName = displayName.trim();

  if (!safeName || !safeDisplayName) {
    throw new Error("Bottle name and display name are required");
  }

  // Add to bottle_types
  await db.runAsync(
    "INSERT OR REPLACE INTO bottle_types (name, display_name, standard_weight, price_per_unit) VALUES (?, ?, ?, ?)",
    [safeName, safeDisplayName, weight, price || 0]
  );

  // Add to items table
  await db.runAsync(
    "INSERT OR REPLACE INTO items (name, unit_type, last_price_per_unit) VALUES (?, ?, ?)",
    [safeName, "count", price || 0]
  );

  return safeName;
};

export const getDb = () => db;
export const isDbInitialized = () => isInitialized;
