// lib/syncManager.ts - Complete with bottle support
import NetInfo from "@react-native-community/netinfo";
import { getDb } from "./database";

export interface SyncResult {
  success: boolean;
  syncedBills: number;
  failedBills: number;
  syncedItems: number;
  failedItems: number;
  message: string;
}

export class SyncManager {
  private static apiBaseUrl = "https://your-django-api.com/api"; // Replace with your backend URL

  /**
   * Check if device is online
   */
  static async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected || false;
  }

  /**
   * Get all unsynced bills
   */
  static async getUnsyncedBills(): Promise<any[]> {
    try {
      const db = getDb();
      if (!db) return [];

      const [results] = await db.executeSql(
        `SELECT b.*, 
                json_group_array(
                  json_object(
                    'itemName', i.name,
                    'unitType', i.unit_type,
                    'originalWeight', bi.original_weight,
                    'lWeight', bi.l_weight,
                    'reducedWeight', bi.reduced_weight,
                    'quantity', bi.quantity,
                    'finalWeight', bi.final_weight,
                    'weightMode', bi.weight_mode,
                    'pricePerKg', bi.price_per_kg,
                    'pricePerUnit', bi.price_per_unit,
                    'amount', bi.amount
                  )
                ) as items
         FROM bills b
         LEFT JOIN bill_items bi ON b.id = bi.bill_id
         LEFT JOIN items i ON bi.item_id = i.id
         WHERE b.is_synced = 0
         GROUP BY b.id
         ORDER BY b.date ASC`,
        []
      );

      const bills = [];
      for (let i = 0; i < results.rows.length; i++) {
        const bill = results.rows.item(i);
        bill.items = JSON.parse(bill.items);
        bills.push(bill);
      }

      return bills;
    } catch (error) {
      console.error("Error getting unsynced bills:", error);
      return [];
    }
  }

  /**
   * Sync bills to Django backend
   */
  static async syncBills(): Promise<SyncResult> {
    const isOnline = await this.isOnline();

    if (!isOnline) {
      return {
        success: false,
        syncedBills: 0,
        failedBills: 0,
        syncedItems: 0,
        failedItems: 0,
        message: "No internet connection. Please check your network.",
      };
    }

    const unsyncedBills = await this.getUnsyncedBills();
    let syncedCount = 0;
    let failedCount = 0;

    for (const bill of unsyncedBills) {
      try {
        // Format bill data for API
        const apiData = {
          bill_number: bill.bill_number,
          customer_name: bill.customer_name,
          customer_phone: bill.customer_phone,
          total_amount: bill.total_amount,
          date: bill.date,
          items: bill.items.map((item: any) => ({
            item_name: item.itemName,
            unit_type: item.unitType,
            original_weight: item.originalWeight,
            l_weight: item.lWeight,
            reduced_weight: item.reducedWeight,
            quantity: item.quantity,
            final_weight: item.finalWeight,
            weight_mode: item.weightMode,
            price_per_kg: item.pricePerKg,
            price_per_unit: item.pricePerUnit,
            amount: item.amount,
          })),
        };

        const response = await fetch(`${this.apiBaseUrl}/bills/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(apiData),
        });

        if (response.ok) {
          // Mark bill as synced
          const db = getDb();
          if (!db) continue;

          await db.runAsync(
            "UPDATE bills SET is_synced = 1, sync_attempts = 0 WHERE id = ?",
            [bill.id]
          );

          // Remove from sync queue
          await db.runAsync("DELETE FROM sync_queue WHERE bill_id = ?", [
            bill.id,
          ]);

          syncedCount++;
        } else {
          // Increment sync attempts
          const db = getDb();
          if (!db) continue;

          await db.runAsync(
            "UPDATE bills SET sync_attempts = sync_attempts + 1, last_sync_attempt = CURRENT_TIMESTAMP WHERE id = ?",
            [bill.id]
          );
          failedCount++;
        }
      } catch (error) {
        console.error("Error syncing bill:", error);
        failedCount++;
      }
    }

    return {
      success: syncedCount > 0,
      syncedBills: syncedCount,
      failedBills: failedCount,
      syncedItems: 0,
      failedItems: 0,
      message: `Synced ${syncedCount} bill(s). ${failedCount} failed.`,
    };
  }

  /**
   * Sync items to backend
   */
  static async syncItems(): Promise<{ synced: number; failed: number }> {
    try {
      const db = getDb();
      if (!db) return { synced: 0, failed: 0 };

      const items = await db.getAllAsync("SELECT * FROM items");
      const bottleTypes = await db.getAllAsync("SELECT * FROM bottle_types");

      let synced = 0;
      let failed = 0;

      // Sync regular items
      for (const item of items) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/items/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: item.name,
              unit_type: item.unit_type,
              last_price_per_kg: item.last_price_per_kg,
              last_price_per_unit: item.last_price_per_unit,
              created_at: item.created_at,
            }),
          });

          if (response.ok) {
            synced++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error("Error syncing item:", error);
          failed++;
        }
      }

      // Sync bottle types
      for (const bottle of bottleTypes) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/bottle-types/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: bottle.name,
              display_name: bottle.display_name,
              standard_weight: bottle.standard_weight,
              price_per_unit: bottle.price_per_unit,
              created_at: bottle.created_at,
            }),
          });

          if (response.ok) {
            synced++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error("Error syncing bottle type:", error);
          failed++;
        }
      }

      return { synced, failed };
    } catch (error) {
      console.error("Error syncing items:", error);
      return { synced: 0, failed: 0 };
    }
  }

  /**
   * Sync everything - bills and items
   */
  static async syncAll(): Promise<SyncResult> {
    const isOnline = await this.isOnline();

    if (!isOnline) {
      return {
        success: false,
        syncedBills: 0,
        failedBills: 0,
        syncedItems: 0,
        failedItems: 0,
        message: "No internet connection. Please check your network.",
      };
    }

    try {
      // Sync items first
      const itemsResult = await this.syncItems();

      // Sync bills
      const billsResult = await this.syncBills();

      return {
        success: billsResult.syncedBills > 0 || itemsResult.synced > 0,
        syncedBills: billsResult.syncedBills,
        failedBills: billsResult.failedBills,
        syncedItems: itemsResult.synced,
        failedItems: itemsResult.failed,
        message: `Synced ${billsResult.syncedBills} bill(s) and ${itemsResult.synced} item(s). ${billsResult.failedBills + itemsResult.failed} failed.`,
      };
    } catch (error) {
      console.error("Error during sync:", error);
      return {
        success: false,
        syncedBills: 0,
        failedBills: 0,
        syncedItems: 0,
        failedItems: 0,
        message: "Sync failed. Please try again.",
      };
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus() {
    const db = getDb();
    if (!db) return { unsyncedBills: 0, unsyncedItems: 0 };

    const [billsResult] = await db.executeSql(
      "SELECT COUNT(*) as count FROM bills WHERE is_synced = 0",
      []
    );

    const [queueResult] = await db.executeSql(
      "SELECT COUNT(*) as count FROM sync_queue",
      []
    );

    return {
      unsyncedBills: billsResult.rows.item(0).count,
      queueItems: queueResult.rows.item(0).count,
    };
  }

  /**
   * Retry failed syncs automatically
   */
  static async retryFailedSyncs(): Promise<void> {
    const db = getDb();
    if (!db) return;

    // Get bills with failed sync attempts (less than 3 attempts)
    const [results] = await db.executeSql(
      "SELECT id FROM bills WHERE is_synced = 0 AND sync_attempts < 3",
      []
    );

    if (results.rows.length > 0) {
      console.log(`Retrying ${results.rows.length} failed syncs...`);
      await this.syncBills();
    }
  }
}
