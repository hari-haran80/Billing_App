import NetInfo from "@react-native-community/netinfo";
import { Platform } from "react-native";
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
  private static apiBaseUrl = "https://wnzjtvbh-8000.inc1.devtunnels.ms";
  private static apiTimeout = 30000;
  private static maxRetries = 3;

  /**
   * Check if device is online
   */
  static async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected || false;
    } catch (error) {
      console.error("[SYNC] Error checking network:", error);
      return false;
    }
  }

  /**
   * Get all unsynced bills from local database
   */
  static async getUnsyncedBills(): Promise<any[]> {
    try {
      const db = getDb();
      if (!db) {
        console.error("[SYNC] Database not available");
        return [];
      }

      console.log("[SYNC] Fetching unsynced bills...");

      const results = await db.getAllAsync(
        `SELECT 
          b.*,
          COALESCE(
            json_group_array(
              json_object(
                'itemId', bi.item_id,
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
            ),
            '[]'
          ) as items
         FROM bills b
         LEFT JOIN bill_items bi ON b.id = bi.bill_id
         LEFT JOIN items i ON bi.item_id = i.id
         WHERE b.is_synced = 0
         GROUP BY b.id
         ORDER BY b.date ASC`
      );

      console.log(`[SYNC] Found ${results.length} unsynced bills`);

      const bills = [];
      for (const bill of results) {
        try {
          bill.items = JSON.parse(bill.items || "[]");
          bill.items = bill.items.filter((item: any) => item.itemName);
          bill.total_amount = parseFloat(bill.total_amount) || 0;

          if (bill.date) {
            bill.date = new Date(bill.date).toISOString();
          } else {
            bill.date = new Date().toISOString();
          }

          bills.push(bill);
        } catch (parseError) {
          console.error("[SYNC] Error parsing bill items:", parseError);
          bill.items = [];
          bills.push(bill);
        }
      }

      return bills;
    } catch (error) {
      console.error("[SYNC] Error getting unsynced bills:", error);
      return [];
    }
  }

  /**
   * Format numeric value to ensure it doesn't exceed decimal limits
   */
  private static formatDecimal(value: any, decimals: number = 2): string {
    if (value === null || value === undefined) return "0.00";

    const num = parseFloat(value);
    if (isNaN(num)) return "0.00";

    return num.toFixed(decimals);
  }

  /**
   * Calculate correct weight values based on business rules
   */
  private static calculateCorrectedWeight(item: any): {
    originalWeight: number;
    lWeight: number;
    reducedWeight: number;
    finalWeight: number;
    amount: number;
  } {
    const weightMode = item.weightMode || "normal";
    const pricePerKg = Number(item.pricePerKg) || 0;

    const originalWeight = Number(item.originalWeight) || 0;
    const lWeight = Number(item.lWeight) || 0;

    let correctedOriginalWeight = originalWeight;
    let correctedLWeight = 0;
    let correctedReducedWeight = 0;
    let correctedFinalWeight = originalWeight;
    let correctedAmount = 0;

    if (weightMode === "L") {
      // L MODE
      correctedLWeight = lWeight;
      correctedReducedWeight = originalWeight - lWeight;
      correctedAmount = lWeight * pricePerKg;
    } else {
      // NORMAL MODE
      correctedLWeight = 0;
      correctedReducedWeight = 0;
      correctedAmount = originalWeight * pricePerKg;
    }

    // Rounding rules
    correctedOriginalWeight = Number(correctedOriginalWeight.toFixed(3));
    correctedLWeight = Number(correctedLWeight.toFixed(3));
    correctedReducedWeight = Number(correctedReducedWeight.toFixed(3));
    correctedFinalWeight = Number(correctedFinalWeight.toFixed(3));
    correctedAmount = Number(correctedAmount.toFixed(2));

    return {
      originalWeight: correctedOriginalWeight,
      lWeight: correctedLWeight,
      reducedWeight: correctedReducedWeight,
      finalWeight: correctedFinalWeight,
      amount: correctedAmount,
    };
  }

  /**
   * Validate bill data before sending
   */
  private static validateBillData(bill: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!bill.bill_number) {
      errors.push("Bill number is required");
    }

    if (!bill.total_amount || isNaN(bill.total_amount)) {
      errors.push("Total amount is required and must be a number");
    }

    if (!bill.items || !Array.isArray(bill.items) || bill.items.length === 0) {
      errors.push("At least one item is required");
    } else {
      bill.items.forEach((item: any, index: number) => {
        if (!item.itemName) {
          errors.push(`Item ${index + 1}: Name is required`);
        }
        if (!item.amount && item.amount !== 0) {
          errors.push(`Item ${index + 1}: Amount is required`);
        }

        // Validate weight calculations
        if (item.unitType === "weight") {
          const corrected = this.calculateCorrectedWeight(item);
          if (corrected.amount <= 0) {
            errors.push(`Item ${index + 1}: Invalid calculated amount`);
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sync single bill to Django backend
   */
  private static async syncSingleBill(
    bill: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[SYNC] Preparing to sync bill: ${bill.bill_number}`);

      // Format bill data for API
      const apiData: any = {
        billNumber: bill.bill_number,
        customerName: bill.customer_name || "Walk-in Customer",
        customerPhone: bill.customer_phone || "",
        totalAmount: parseFloat(this.formatDecimal(bill.total_amount, 2)),
        date: bill.date || new Date().toISOString(),
        items: [],
      };

      // Format items
      if (bill.items && Array.isArray(bill.items)) {
        apiData.items = bill.items.map((item: any) => {
          // Determine unit type
          const unitType = item.unitType === "count" ? "count" : "weight";

          const formattedItem: any = {
            itemName: item.itemName?.trim() || "Unknown Item",
            unitType: unitType,
            quantity: parseInt(item.quantity || 1),
            weightMode: item.weightMode || "normal",
          };

          if (unitType === "weight") {
            // Calculate corrected weight values
            const corrected = this.calculateCorrectedWeight(item);

            formattedItem.originalWeight = corrected.originalWeight;
            formattedItem.lWeight = corrected.lWeight;
            formattedItem.reducedWeight = corrected.reducedWeight;
            formattedItem.finalWeight = corrected.finalWeight;
            formattedItem.pricePerKg = Number(
              this.formatDecimal(item.pricePerKg, 2)
            );
            formattedItem.pricePerUnit = 0;
            formattedItem.amount = corrected.amount;

            // Update the total amount if needed
            if (
              Math.abs(formattedItem.amount - parseFloat(item.amount)) > 0.01
            ) {
              console.log(
                `[SYNC] Corrected amount for ${formattedItem.itemName}: ${item.amount} -> ${formattedItem.amount}`
              );
            }

            // Log weight mode for debugging
            if (item.weightMode === "L") {
              console.log(
                `[SYNC] Item in L mode: Original=${formattedItem.originalWeight}, L=${formattedItem.lWeight}, Reduced=${formattedItem.reducedWeight}, Amount=${formattedItem.amount}`
              );
            } else {
              console.log(
                `[SYNC] Item in Normal mode: Original=${formattedItem.originalWeight}, Amount=${formattedItem.amount}`
              );
            }
          } else {
            formattedItem.originalWeight = 0;
            formattedItem.lWeight = 0;
            formattedItem.reducedWeight = 0;
            formattedItem.finalWeight = 0;
            formattedItem.pricePerKg = 0;
            formattedItem.pricePerUnit = parseFloat(
              this.formatDecimal(item.pricePerUnit, 2)
            );
            formattedItem.amount =
              formattedItem.quantity * formattedItem.pricePerUnit;
          }

          return formattedItem;
        });

        // Recalculate total amount based on corrected item amounts
        const totalAmount = apiData.items.reduce(
          (sum: number, item: any) => sum + item.amount,
          0
        );
        apiData.totalAmount = parseFloat(this.formatDecimal(totalAmount, 2));
      }

      // Validate the data
      const validation = this.validateBillData({
        bill_number: apiData.billNumber,
        total_amount: apiData.totalAmount,
        items: apiData.items,
      });

      if (!validation.isValid) {
        console.error(
          `[SYNC] Validation failed for bill ${bill.bill_number}:`,
          validation.errors
        );
        return {
          success: false,
          message: `Validation failed: ${validation.errors.join(", ")}`,
        };
      }

      console.log(`[SYNC] Sending bill ${bill.bill_number} to backend...`);

      // Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

      try {
        const response = await fetch(`${this.apiBaseUrl}/api/sync-bill/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(apiData),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        console.log(`[SYNC] Response status: ${response.status}`);

        const responseText = await response.text();
        console.log(
          `[SYNC] Raw response: ${responseText.substring(0, 500)}...`
        );

        let responseData;
        try {
          responseData = JSON.parse(responseText);
        } catch (parseError) {
          console.error("[SYNC] Failed to parse JSON response:", parseError);
          responseData = {
            success: false,
            error: "Invalid response format from server",
            details: responseText,
          };
        }

        if (response.ok && responseData.success) {
          console.log(`[SYNC] Successfully synced bill ${bill.bill_number}`);
          return {
            success: true,
            message: responseData.message || "Bill synced successfully",
          };
        } else {
          console.error(
            `[SYNC] API error for bill ${bill.bill_number}:`,
            responseData
          );
          return {
            success: false,
            message:
              responseData.error ||
              `HTTP ${response.status}: ${response.statusText}`,
          };
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);

        if (fetchError.name === "AbortError") {
          console.error(`[SYNC] Request timeout for bill ${bill.bill_number}`);
          return {
            success: false,
            message: "Request timeout - server took too long to respond",
          };
        }

        console.error(
          `[SYNC] Network error for bill ${bill.bill_number}:`,
          fetchError
        );
        return {
          success: false,
          message: `Network error: ${fetchError.message}`,
        };
      }
    } catch (error: any) {
      console.error(
        `[SYNC] Unexpected error syncing bill ${bill.bill_number}:`,
        error
      );
      return {
        success: false,
        message: `Unexpected error: ${error.message}`,
      };
    }
  }

  /**
   * Sync bills to Django backend
   */
  static async syncBills(): Promise<SyncResult> {
    console.log("[SYNC] Starting sync process...");

    // Check network
    const isOnline = await this.isOnline();
    if (!isOnline) {
      console.log("[SYNC] No network connection");
      return {
        success: false,
        syncedBills: 0,
        failedBills: 0,
        syncedItems: 0,
        failedItems: 0,
        message: "No internet connection. Please check your network.",
      };
    }

    // Test backend connection first
    const backendOnline = await this.testBackendConnection();
    if (!backendOnline) {
      console.log("[SYNC] Backend server is offline");
      return {
        success: false,
        syncedBills: 0,
        failedBills: 0,
        syncedItems: 0,
        failedItems: 0,
        message: "Backend server is offline. Please try again later.",
      };
    }

    // Get unsynced bills
    const unsyncedBills = await this.getUnsyncedBills();
    console.log(`[SYNC] Found ${unsyncedBills.length} bills to sync`);

    if (unsyncedBills.length === 0) {
      return {
        success: true,
        syncedBills: 0,
        failedBills: 0,
        syncedItems: 0,
        failedItems: 0,
        message: "All bills are already synced.",
      };
    }

    let syncedCount = 0;
    let failedCount = 0;
    let totalItemsSynced = 0;
    const errors: string[] = [];

    // Sync each bill
    for (const bill of unsyncedBills) {
      try {
        const result = await this.syncSingleBill(bill);

        if (result.success) {
          // Mark bill as synced in local database
          const db = getDb();
          if (db) {
            await db.runAsync(
              "UPDATE bills SET is_synced = 1, sync_attempts = 0, last_sync_attempt = CURRENT_TIMESTAMP WHERE id = ?",
              [bill.id]
            );

            // Remove from sync queue if exists
            await db.runAsync("DELETE FROM sync_queue WHERE bill_id = ?", [
              bill.id,
            ]);
          }

          syncedCount++;
          totalItemsSynced += bill.items?.length || 0;
          console.log(`[SYNC] ✓ Bill ${bill.bill_number} synced successfully`);
        } else {
          // Increment sync attempts
          const db = getDb();
          if (db) {
            await db.runAsync(
              "UPDATE bills SET sync_attempts = sync_attempts + 1, last_sync_attempt = CURRENT_TIMESTAMP WHERE id = ?",
              [bill.id]
            );
          }

          failedCount++;
          errors.push(`Bill ${bill.bill_number}: ${result.message}`);
          console.error(
            `[SYNC] ✗ Failed to sync bill ${bill.bill_number}: ${result.message}`
          );
        }
      } catch (error: any) {
        console.error(
          `[SYNC] Error processing bill ${bill.bill_number}:`,
          error
        );
        failedCount++;
        errors.push(`Bill ${bill.bill_number}: ${error.message}`);
      }
    }

    // Create result message
    let message: string;
    if (syncedCount > 0 && failedCount === 0) {
      message = `Successfully synced ${syncedCount} bill(s) with ${totalItemsSynced} item(s).`;
    } else if (syncedCount > 0 && failedCount > 0) {
      message = `Synced ${syncedCount} bill(s), failed ${failedCount} bill(s). Errors: ${errors.join("; ")}`;
    } else {
      message = `Failed to sync ${failedCount} bill(s). Errors: ${errors.join("; ")}`;
    }

    return {
      success: syncedCount > 0,
      syncedBills: syncedCount,
      failedBills: failedCount,
      syncedItems: totalItemsSynced,
      failedItems: 0,
      message,
    };
  }

  /**
   * Test backend server connection
   */
  static async testBackendConnection(): Promise<boolean> {
    try {
      console.log("[SYNC] Testing backend connection...");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.apiBaseUrl}/api/sync-status/`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log("[SYNC] Backend connection successful");
        return true;
      } else {
        console.error(`[SYNC] Backend returned status: ${response.status}`);
        return false;
      }
    } catch (error: any) {
      console.error("[SYNC] Backend connection failed:", error.message);
      return false;
    }
  }

  /**
   * Get sync status for a specific bill
   */
  static async checkBillSyncStatus(billNumber: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/sync-status/${billNumber}/`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        return await response.json();
      } else {
        return {
          bill_number: billNumber,
          is_synced: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error: any) {
      console.error(
        `[SYNC] Error checking status for bill ${billNumber}:`,
        error
      );
      return {
        bill_number: billNumber,
        is_synced: false,
        error: error.message,
      };
    }
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
          const response = await fetch(`${this.apiBaseUrl}/api/items/`, {
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
          console.error("[SYNC] Error syncing item:", error);
          failed++;
        }
      }

      // Sync bottle types
      for (const bottle of bottleTypes) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/api/bottle-types/`, {
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
          console.error("[SYNC] Error syncing bottle type:", error);
          failed++;
        }
      }

      return { synced, failed };
    } catch (error) {
      console.error("[SYNC] Error syncing items:", error);
      return { synced: 0, failed: 0 };
    }
  }

  /**
   * Sync everything - bills and items
   */
  static async syncAll(): Promise<SyncResult> {
    console.log("[SYNC] Starting full sync...");

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
      // Test backend first
      const backendOnline = await this.testBackendConnection();
      if (!backendOnline) {
        return {
          success: false,
          syncedBills: 0,
          failedBills: 0,
          syncedItems: 0,
          failedItems: 0,
          message: "Backend server is offline. Please try again later.",
        };
      }

      // Sync items first
      console.log("[SYNC] Syncing items...");
      const itemsResult = await this.syncItems();

      // Sync bills
      console.log("[SYNC] Syncing bills...");
      const billsResult = await this.syncBills();

      return {
        success: billsResult.success || itemsResult.synced > 0,
        syncedBills: billsResult.syncedBills,
        failedBills: billsResult.failedBills,
        syncedItems: itemsResult.synced + billsResult.syncedItems,
        failedItems: itemsResult.failed,
        message:
          billsResult.message +
          ` Items: ${itemsResult.synced} synced, ${itemsResult.failed} failed.`,
      };
    } catch (error: any) {
      console.error("[SYNC] Error during sync:", error);
      return {
        success: false,
        syncedBills: 0,
        failedBills: 0,
        syncedItems: 0,
        failedItems: 0,
        message: `Sync failed: ${error.message}`,
      };
    }
  }

  /**
   * Get sync status
   */
  static async getSyncStatus() {
    const db = getDb();
    if (!db) return { unsyncedBills: 0, unsyncedItems: 0 };

    try {
      const billsResult = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM bills WHERE is_synced = 0"
      );

      const queueResult = await db.getFirstAsync<{ count: number }>(
        "SELECT COUNT(*) as count FROM sync_queue"
      );

      return {
        unsyncedBills: billsResult?.count || 0,
        queueItems: queueResult?.count || 0,
      };
    } catch (error) {
      console.error("[SYNC] Error getting sync status:", error);
      return { unsyncedBills: 0, queueItems: 0 };
    }
  }

  /**
   * Retry failed syncs automatically
   */
  static async retryFailedSyncs(): Promise<void> {
    const db = getDb();
    if (!db) return;

    try {
      // Get bills with failed sync attempts (less than 3 attempts)
      const results = await db.getAllAsync<{ id: number }>(
        "SELECT id FROM bills WHERE is_synced = 0 AND sync_attempts < 3"
      );

      if (results.length > 0) {
        console.log(`[SYNC] Retrying ${results.length} failed syncs...`);
        await this.syncBills();
      }
    } catch (error) {
      console.error("[SYNC] Error retrying failed syncs:", error);
    }
  }

  /**
   * Send test bill to backend (for debugging)
   */
  static async sendTestBill(): Promise<any> {
    try {
      // Test Normal Mode
      const normalTestBill = {
        billNumber: `TEST-NORMAL-${Date.now()}`,
        customerName: "Test Customer (Normal Mode)",
        customerPhone: "1234567890",
        totalAmount: 500.0,
        date: new Date().toISOString(),
        items: [
          {
            itemName: "Copper Wire",
            unitType: "weight",
            originalWeight: 10.0,
            lWeight: 0,
            reducedWeight: 0,
            quantity: 1,
            finalWeight: 10.0,
            weightMode: "normal",
            pricePerKg: 50.0,
            pricePerUnit: 0.0,
            amount: 500.0,
          },
        ],
      };

      // Test L Mode (100g reduction per kg = 10%)
      const lTestBill = {
        billNumber: `TEST-L-${Date.now()}`,
        customerName: "Test Customer (L Mode)",
        customerPhone: "0987654321",
        totalAmount: 450.0,
        date: new Date().toISOString(),
        items: [
          {
            itemName: "Copper Wire",
            unitType: "weight",
            originalWeight: 10.0,
            lWeight: 9.0,
            reducedWeight: 1.0,
            quantity: 1,
            finalWeight: 10.0,
            weightMode: "L",
            pricePerKg: 50.0,
            pricePerUnit: 0.0,
            amount: 450.0,
          },
        ],
      };

      console.log(
        "[TEST] Sending L mode test bill:",
        JSON.stringify(lTestBill, null, 2)
      );

      const response = await fetch(`${this.apiBaseUrl}/api/sync-bill/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(lTestBill),
      });

      const responseText = await response.text();
      console.log("[TEST] Response status:", response.status);
      console.log("[TEST] Response:", responseText);

      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      return {
        success: response.ok,
        status: response.status,
        data: responseData,
        mode: "L",
        explanation:
          "L Mode: Original weight 10kg, L weight 9kg (10% reduction), billed for 9kg",
      };
    } catch (error: any) {
      console.error("[TEST] Error sending test bill:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear all sync data (for debugging)
   */
  static async clearSyncData(): Promise<boolean> {
    try {
      const db = getDb();
      if (!db) return false;

      await db.runAsync("UPDATE bills SET is_synced = 0, sync_attempts = 0");
      await db.runAsync("DELETE FROM sync_queue");

      console.log("[SYNC] All bills marked as unsynced");
      return true;
    } catch (error) {
      console.error("[SYNC] Error clearing sync data:", error);
      return false;
    }
  }
}

// Helper function to get API base URL (for use in other files)
export const getApiBaseUrl = () => SyncManager.apiBaseUrl;

// Helper function to update API URL
export const setApiBaseUrl = (url: string) => {
  SyncManager.apiBaseUrl = url;
  console.log(`[SYNC] API URL updated to: ${url}`);
};

// Initialize sync manager
export const initSyncManager = async () => {
  console.log("[SYNC] Initializing SyncManager...");

  // For web platform, use a different approach
  if (Platform.OS === "web") {
    console.log("[SYNC] Web platform detected, using mock sync");
    SyncManager.apiBaseUrl = "http://localhost:8000";
  }

  // Test backend connection on init
  try {
    const isOnline = await SyncManager.isOnline();
    if (isOnline) {
      const backendOnline = await SyncManager.testBackendConnection();
      console.log(
        `[SYNC] Backend connection: ${backendOnline ? "Online" : "Offline"}`
      );
    }
  } catch (error) {
    console.error("[SYNC] Error testing backend on init:", error);
  }
};
