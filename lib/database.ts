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
  sync_uuid?: string;
  item_code?: string;
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
  sync_uuid?: string;
}

interface BillNumberRow {
  bill_number: string;
}

// Add new interfaces for the missing types
interface ExistingItemRow {
  id: number;
  name: string;
}

interface ExistingBillRow {
  id: number;
}

interface BillItemRow {
  id: number;
  bill_id: number;
  item_id: number;
  original_weight: number;
  l_weight: number;
  quantity: number;
  final_weight: number;
  weight_mode: "normal" | "L";
  price_per_kg: number;
  price_per_unit: number;
  amount: number;
  reduced_weight: number;
  item_name?: string;
  unit_type?: "weight" | "count";
  bottle_display_name?: string;
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
        sync_uuid TEXT UNIQUE,
        item_code TEXT UNIQUE,
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

    isInitialized = true;
    console.log("[DB] Database initialized successfully");

    // Add missing columns if they don't exist (run every time)
    await addMissingColumns();
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

    // Check if sync_uuid column exists in items table
    const hasSyncUuid = tableInfo.some((col) => col.name === "sync_uuid");

    if (!hasSyncUuid) {
      console.log("[DB] Adding sync_uuid column to items table");
      await db.runAsync("ALTER TABLE items ADD COLUMN sync_uuid TEXT UNIQUE");
    }

    // Check if item_code column exists in items table
    const hasItemCode = tableInfo.some((col) => col.name === "item_code");

    if (!hasItemCode) {
      try {
        console.log("[DB] Adding item_code column to items table");
        await db.runAsync("ALTER TABLE items ADD COLUMN item_code TEXT");

        // Populate item_code for existing items
        console.log("[DB] Populating item_code for existing items");
        const existingItems = await db.getAllAsync<ExistingItemRow>(
          "SELECT id, name FROM items WHERE item_code IS NULL"
        );
        for (const item of existingItems) {
          const itemCode = generateItemCode(item.name, item.id);
          await db.runAsync("UPDATE items SET item_code = ? WHERE id = ?", [
            itemCode,
            item.id,
          ]);
        }

        // Add UNIQUE constraint separately
        try {
          await db.runAsync(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_items_item_code ON items(item_code)"
          );
          console.log("[DB] Added unique index on item_code");
        } catch (indexError) {
          console.warn(
            "[DB] Could not add unique index on item_code:",
            indexError
          );
        }
      } catch (error) {
        console.error("[DB] Error adding item_code column:", error);
      }
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

    // Check if sync_uuid column exists in bills table
    const hasBillsSyncUuid = billsInfo.some(
      (col) => col.name === "sync_uuid"
    );

    if (!hasBillsSyncUuid) {
      console.log("[DB] Adding sync_uuid column to bills table");
      await db.runAsync(
        "ALTER TABLE bills ADD COLUMN sync_uuid TEXT"
      );

      // Populate sync_uuid for existing bills
      console.log("[DB] Populating sync_uuid for existing bills");
      const existingBills = await db.getAllAsync<ExistingBillRow>("SELECT id FROM bills WHERE sync_uuid IS NULL");
      for (const bill of existingBills) {
        const syncUuid = generateUUID();
        await db.runAsync("UPDATE bills SET sync_uuid = ? WHERE id = ?", [syncUuid, bill.id]);
      }
      console.log(`[DB] Populated sync_uuid for ${existingBills.length} existing bills`);
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
  try {
    const result = await db.getAllAsync<ItemRow>(`
    SELECT * FROM items 
    ORDER BY name ASC
  `);
    return result || [];
  } catch (error) {
    console.error("Error getting all items:", error);
    return [];
  }
};

export const getBottleTypes = async () => {
  if (!db) throw new Error("Database not initialized");
  return await db.getAllAsync<BottleRow>("SELECT * FROM bottle_types ORDER BY name");
};

export const addNewItem = async (
  name: string,
  price: number,
  unitType: string = "weight"
) => {
  if (!db) throw new Error("Database not initialized");

  const safeName = name.trim();
  if (!safeName) throw new Error("Item name cannot be empty");

  // Check if item with same name already exists
  const existing = await db.getFirstAsync<ItemRow>("SELECT id FROM items WHERE name = ?", [safeName]);
  if (existing) {
    throw new Error("Item with this name already exists");
  }

  const syncUuid = generateUUID();

  let result;
  if (unitType === "count") {
    result = await db.runAsync(
      "INSERT INTO items (name, unit_type, last_price_per_unit, sync_uuid) VALUES (?, ?, ?, ?)",
      [safeName, unitType, price || 0, syncUuid]
    );
  } else {
    result = await db.runAsync(
      "INSERT INTO items (name, unit_type, last_price_per_kg, sync_uuid) VALUES (?, ?, ?, ?)",
      [safeName, unitType, price || 0, syncUuid]
    );
  }

  // Now generate item_code with the id
  const itemCode = generateItemCode(safeName, result.lastInsertRowId);

  // Update the item with item_code
  await db.runAsync("UPDATE items SET item_code = ? WHERE id = ?", [
    itemCode,
    result.lastInsertRowId,
  ]);

  return result;
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

export const updateItem = async (
  itemId: number,
  updates: {
    name?: string;
    unit_type?: "weight" | "count";
    last_price_per_kg?: number;
    last_price_per_unit?: number;
  }
) => {
  if (!db) throw new Error("Database not initialized");

  const fields = [];
  const values = [];

  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
  }
  if (updates.unit_type !== undefined) {
    fields.push("unit_type = ?");
    values.push(updates.unit_type);
  }
  if (updates.last_price_per_kg !== undefined) {
    fields.push("last_price_per_kg = ?");
    values.push(updates.last_price_per_kg);
  }
  if (updates.last_price_per_unit !== undefined) {
    fields.push("last_price_per_unit = ?");
    values.push(updates.last_price_per_unit);
  }

  if (fields.length === 0) return;

  const query = `UPDATE items SET ${fields.join(", ")} WHERE id = ?`;
  values.push(itemId);

  await db.runAsync(query, values);
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
  const yy = String(now.getFullYear()).slice(-2);

  // Get the last bill number for today
  const result = await db.getAllAsync<BillNumberRow>(
    "SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY bill_number DESC LIMIT 1",
    [`FAM${dd}${mm}${yy}%`]
  );

  let nextNum = 1;
  if (result.length > 0) {
    const lastBillNumber = result[0].bill_number;
    // Extract the number part after the date prefix
    const numPart = lastBillNumber.slice(9); // FAMDDMMYY has 9 characters
    const lastNum = parseInt(numPart) || 0;
    nextNum = lastNum + 1;
  }

  return `FAM${dd}${mm}${yy}${String(nextNum).padStart(4, "0")}`;
};

export const saveBill = async (billData: any) => {
  if (!db) throw new Error("Database not initialized");

  const { billNumber, customerName, customerPhone, items } = billData;
  const weightReduction = await getWeightReduction(); // e.g., 0.1 for 10%

  // Generate unique sync UUID for this bill
  const syncUuid = generateUUID();

  // Compute total amount for the bill
  let totalAmount = 0;

  // Save bill header first (amount 0 for now, will update after items)
  const result = await db.runAsync(
    `INSERT INTO bills (bill_number, customer_name, customer_phone, total_amount, date, sync_uuid) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      billNumber,
      customerName || "Walk-in Customer",
      customerPhone || "",
      0,
      new Date().toISOString(),
      syncUuid,
    ]
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
  const items = await db.getAllAsync<BillItemRow>(
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
      } as BillItemRow;
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
    "INSERT OR REPLACE INTO items (name, unit_type, last_price_per_unit, sync_uuid, item_code) VALUES (?, ?, ?, ?, ?)",
    [
      safeName,
      "count",
      price || 0,
      generateUUID(),
      generateItemCode(safeDisplayName),
    ]
  );

  return safeName;
};

// Generate item code from name
const generateItemCode = (name: string, id?: number): string => {
  const baseCode = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .substring(0, 8);
  if (id) {
    return `${baseCode}${id}`.substring(0, 10);
  }
  return baseCode.substring(0, 10);
};

// Generate a simple UUID
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const getDb = () => db;
export const isDbInitialized = () => isInitialized;
