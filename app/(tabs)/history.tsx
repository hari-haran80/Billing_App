// Update the HistoryScreen component in history.tsx
import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { getAllBills, getBillDetails, getDb } from "../../lib/database";
import { PDFGenerator } from "../../lib/pdfGenerator";

// Define proper types
interface BillItem {
  bottle_display_name?: string;
  item_name?: string;
  unit_type?: string;
  quantity?: number;
  price_per_unit?: number;
  price_per_kg?: number;
  weight_mode?: string;
  l_weight?: number;
  final_weight?: number;
  amount?: number;
}

interface Bill {
  id: number;
  bill_number?: string;
  customer_name?: string;
  customer_phone?: string;
  total_amount?: number;
  date?: string;
  sync_uuid?: string;
  is_synced?: boolean;
  items: BillItem[];
  item_count?: number;
  items_list?: string;
}

// Helper function to map database unit_type to PDFGenerator expected type
const mapUnitType = (unitType?: string): "weight" | "count" => {
  if (!unitType) return "count";
  
  const normalized = unitType.toLowerCase();
  if (normalized.includes("weight") || normalized.includes("kg") || normalized.includes("gram")) {
    return "weight";
  }
  return "count";
};

// Helper function to get weight value
const getWeightValue = (item: BillItem): number => {
  if (item.weight_mode === "L") {
    return item.l_weight || 0;
  }
  return item.final_weight || 0;
};

export default function HistoryScreen() {
  const router = useRouter();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    loadBills();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      loadBills();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadBills = async () => {
    try {
      const db = getDb();
      if (!db) {
        setTimeout(loadBills, 500);
        return;
      }

      const billsData = await getAllBills();
      // Ensure is_synced property exists on each bill
      const processedBills = (billsData || []).map((bill: any) => ({
        ...bill,
        // Determine if bill is synced based on sync_uuid or other logic
        is_synced: !!bill.sync_uuid,
      }));
      setBills(processedBills);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error("Error loading bills:", error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreBills = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      setTimeout(() => {
        setPage((prev) => prev + 1);
        setLoadingMore(false);
        if (bills.length < page * pageSize) {
          setHasMore(false);
        }
      }, 500);
    } catch (error) {
      console.error("Error loading more bills:", error);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadBills();
  };

  const handleBillPress = (billId: number) => {
    router.push(`/bill-details?billId=${billId}`);
  };

  const handleShowPDF = async (billId: number) => {
    try {
      const bill = await getBillDetails(billId);
      if (!bill) {
        Alert.alert("Error", "Bill not found");
        return;
      }
      
      const billData = {
        id: bill.id,
        billNumber: bill.bill_number || `BILL-${bill.id}`,
        customerName: bill.customer_name || "Walk-in Customer",
        customerPhone: bill.customer_phone || "",
        totalAmount: bill.total_amount || 0,
        date: bill.date || new Date().toISOString().split('T')[0],
        isSynced: !!bill.sync_uuid,
        items: bill.items.map((item: BillItem) => ({
          itemName: item.bottle_display_name || item.item_name || "Unknown Item",
          unitType: mapUnitType(item.unit_type),
          quantity: item.quantity || 1,
          pricePerUnit: item.price_per_unit || 0,
          pricePerKg: item.price_per_kg || 0,
          lWeight: getWeightValue(item),
          amount: item.amount || 0,
        })),
      };
      const pdfUri = await PDFGenerator.generatePDF(billData, "tamil");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: "application/pdf",
          dialogTitle: "View PDF",
        });
      }
    } catch (error) {
      console.error("Error showing PDF:", error);
      Alert.alert("Error", "Failed to generate PDF");
    }
  };

  const handlePrintPDF = async (billId: number) => {
    try {
      const bill = await getBillDetails(billId);
      if (!bill) {
        Alert.alert("Error", "Bill not found");
        return;
      }
      
      const billData = {
        id: bill.id,
        billNumber: bill.bill_number || `BILL-${bill.id}`,
        customerName: bill.customer_name || "Walk-in Customer",
        customerPhone: bill.customer_phone || "",
        totalAmount: bill.total_amount || 0,
        date: bill.date || new Date().toISOString().split('T')[0],
        isSynced: !!bill.sync_uuid,
        items: bill.items.map((item: BillItem) => ({
          itemName: item.bottle_display_name || item.item_name || "Unknown Item",
          unitType: mapUnitType(item.unit_type),
          quantity: item.quantity || 1,
          pricePerUnit: item.price_per_unit || 0,
          pricePerKg: item.price_per_kg || 0,
          lWeight: getWeightValue(item),
          amount: item.amount || 0,
        })),
      };
      const pdfUri = await PDFGenerator.generatePDF(billData, "tamil");
      await Print.printAsync({
        uri: pdfUri,
        printerUrl: "auto",
      });
    } catch (error) {
      console.error("Error printing PDF:", error);
      Alert.alert("Error", "Failed to print PDF");
    }
  };

  const handleSharePDF = async (billId: number) => {
    try {
      const bill = await getBillDetails(billId);
      if (!bill) {
        Alert.alert("Error", "Bill not found");
        return;
      }
      
      const billData = {
        id: bill.id,
        billNumber: bill.bill_number || `BILL-${bill.id}`,
        customerName: bill.customer_name || "Walk-in Customer",
        customerPhone: bill.customer_phone || "",
        totalAmount: bill.total_amount || 0,
        date: bill.date || new Date().toISOString().split('T')[0],
        isSynced: !!bill.sync_uuid,
        items: bill.items.map((item: BillItem) => ({
          itemName: item.bottle_display_name || item.item_name || "Unknown Item",
          unitType: mapUnitType(item.unit_type),
          quantity: item.quantity || 1,
          pricePerUnit: item.price_per_unit || 0,
          pricePerKg: item.price_per_kg || 0,
          lWeight: getWeightValue(item),
          amount: item.amount || 0,
        })),
      };
      const pdfUri = await PDFGenerator.generatePDF(billData, "tamil");
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(pdfUri, {
          mimeType: "application/pdf",
          dialogTitle: "Share PDF",
        });
      }
    } catch (error) {
      console.error("Error sharing PDF:", error);
      Alert.alert("Error", "Failed to share PDF");
    }
  };

  const handleDeleteBill = (billId: number) => {
    Alert.alert(
      "Delete Bill",
      "Are you sure you want to delete this bill? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const db = getDb();
              if (!db) {
                Alert.alert("Error", "Database not available");
                return;
              }
              await db.runAsync("DELETE FROM bills WHERE id = ?", [billId]);
              // Also delete related bill items
              await db.runAsync("DELETE FROM bill_items WHERE bill_id = ?", [billId]);
              // Reload bills
              await loadBills();
              Alert.alert("Success", "Bill deleted successfully");
            } catch (error) {
              console.error("Error deleting bill:", error);
              Alert.alert("Error", "Failed to delete bill");
            }
          },
        },
      ]
    );
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4a6da7" />
      </View>
    );
  };

  const renderBillItem = ({ item }: { item: Bill }) => (
    <View style={styles.billCard}>
      <TouchableOpacity
        style={styles.billContent}
        onPress={() => handleBillPress(item.id)}
      >
        <View style={styles.billHeader}>
          <View>
            <Text style={styles.billCustomer}>{item.customer_name || "Walk-in Customer"}</Text>
            <Text style={styles.billNumber}>Bill: {item.bill_number || `BILL-${item.id}`}</Text>
          </View>

          <View style={styles.billStatusContainer}>
            <View
              style={[
                styles.billStatus,
                { backgroundColor: item.is_synced ? "#28a745" : "#ffc107" },
              ]}
            />
            <Text style={styles.billStatusText}>
              {item.is_synced ? "Synced" : "Pending"}
            </Text>
          </View>
        </View>

        <View style={styles.billDetails}>
          <View style={styles.billDetailItem}>
            <Icon name="calendar-today" size={16} color="#6c757d" />
            <Text style={styles.billDetailText}>
              {item.date ? new Date(item.date).toLocaleDateString("ta-IN") : "Unknown date"}
            </Text>
          </View>

          <View style={styles.billDetailItem}>
            <Icon name="inventory" size={16} color="#6c757d" />
            <Text style={styles.billDetailText}>
              {item.item_count || item.items?.length || 0} items
            </Text>
          </View>

          <View style={styles.billDetailItem}>
            <Icon name="currency-rupee" size={16} color="#6c757d" />
            <Text style={styles.billDetailText}>
              ₹{(item.total_amount || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <Text style={styles.billItems} numberOfLines={1}>
          {item.items_list || "No items"}
        </Text>
      </TouchableOpacity>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleShowPDF(item.id)}
        >
          <Icon name="visibility" size={20} color="#4a6da7" />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handlePrintPDF(item.id)}
        >
          <Icon name="print" size={20} color="#4a6da7" />
          <Text style={styles.actionButtonText}>Print</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleSharePDF(item.id)}
        >
          <Icon name="share" size={20} color="#4a6da7" />
          <Text style={styles.actionButtonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleDeleteBill(item.id)}
        >
          <Icon name="delete" size={20} color="#dc3545" />
          <Text style={[styles.actionButtonText, { color: "#dc3545" }]}>
            Delete
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6da7" />
        <Text style={styles.loadingText}>Loading bills...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bill History</Text>
        <Text style={styles.headerSubtitle}>Tap on a bill to view details</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Bills</Text>
          <Text style={styles.statValue}>{bills.length}</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Synced</Text>
          <Text style={[styles.statValue, { color: "#28a745" }]}>
            {bills.filter((b) => b.is_synced).length}
          </Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, { color: "#ffc107" }]}>
            {bills.filter((b) => !b.is_synced).length}
          </Text>
        </View>
      </View>

      {/* Bills List with Pagination */}
      <FlatList
        data={bills.slice(0, page * pageSize)}
        renderItem={renderBillItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#16a085"]}
            tintColor="#16a085"
          />
        }
        onEndReached={loadMoreBills}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="receipt" size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>No bills found</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first bill in the New Bill tab
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fa",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    padding: 20,
    backgroundColor: "#4a6da7",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
  },
  statsRow: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 12,
    color: "#6c757d",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  listContent: {
    padding: 16,
  },
  billCard: {
    backgroundColor: "white",
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billContent: {
    padding: 16,
  },
  billHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  billCustomer: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 4,
  },
  billNumber: {
    fontSize: 14,
    color: "#6c757d",
  },
  billStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  billStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  billStatusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6c757d",
  },
  billDetails: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 16,
  },
  billDetailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  billDetailText: {
    fontSize: 14,
    color: "#6c757d",
  },
  billItems: {
    fontSize: 14,
    color: "#495057",
    fontStyle: "italic",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f8f9fa",
  },
  actionButtons: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f8f9fa",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 4,
  },
  actionButtonText: {
    fontSize: 12,
    color: "#4a6da7",
    fontWeight: "500",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: "#adb5bd",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#ced4da",
  },
  footerLoader: {
    padding: 20,
    alignItems: "center",
  },
});
