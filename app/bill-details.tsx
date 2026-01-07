// app/bill-details.tsx
import { getBillDetails } from "@/lib/database";
import * as Print from "expo-print";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import BackButton from "../components/common/BackButton";
import { PDFGenerator } from "../lib/pdfGenerator";

export default function BillDetailsScreen() {
  const { billId } = useLocalSearchParams();
  const [bill, setBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBillDetails();
  }, [billId]);

  const loadBillDetails = async () => {
    try {
      const billData = await getBillDetails(parseInt(billId as string));
      setBill(billData);
    } catch (error) {
      console.error("Error loading bill details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleShowPDF = async () => {
    if (!bill) return;
    try {
      const billData = {
        id: bill.id,
        billNumber: bill.bill_number,
        customerName: bill.customer_name || "Walk-in Customer",
        customerPhone: bill.customer_phone,
        totalAmount: bill.total_amount || 0,
        date: bill.date,
        isSynced: bill.is_synced,
        items: bill.items.map((item) => ({
          itemName: item.bottle_display_name || item.item_name,
          unitType: item.unit_type,
          quantity: item.quantity || 1,
          pricePerUnit: item.price_per_unit || 0,
          pricePerKg: item.price_per_kg || 0,
          lWeight: item.weight_mode === "L" ? item.l_weight : item.final_weight,
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

  const handlePrintPDF = async () => {
    if (!bill) return;
    try {
      const billData = {
        id: bill.id,
        billNumber: bill.bill_number,
        customerName: bill.customer_name || "Walk-in Customer",
        customerPhone: bill.customer_phone,
        totalAmount: bill.total_amount || 0,
        date: bill.date,
        isSynced: bill.is_synced,
        items: bill.items.map((item) => ({
          itemName: item.bottle_display_name || item.item_name,
          unitType: item.unit_type,
          quantity: item.quantity || 1,
          pricePerUnit: item.price_per_unit || 0,
          pricePerKg: item.price_per_kg || 0,
          lWeight: item.weight_mode === "L" ? item.l_weight : item.final_weight,
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

  const handleSharePDF = async () => {
    if (!bill) return;
    try {
      const billData = {
        id: bill.id,
        billNumber: bill.bill_number,
        customerName: bill.customer_name || "Walk-in Customer",
        customerPhone: bill.customer_phone,
        totalAmount: bill.total_amount || 0,
        date: bill.date,
        isSynced: bill.is_synced,
        items: bill.items.map((item) => ({
          itemName: item.bottle_display_name || item.item_name,
          unitType: item.unit_type,
          quantity: item.quantity || 1,
          pricePerUnit: item.price_per_unit || 0,
          pricePerKg: item.price_per_kg || 0,
          finalWeight: item.final_weight || 0,
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

  const handleDeleteBill = () => {
    if (!bill) return;
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
              // Delete from database
              const db = await import("@/lib/database").then((m) => m.getDb());
              await db.runAsync("DELETE FROM bills WHERE id = ?", [bill.id]);
              Alert.alert("Success", "Bill deleted successfully");
              router.back();
            } catch (error) {
              console.error("Error deleting bill:", error);
              Alert.alert("Error", "Failed to delete bill");
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6da7" />
        <Text style={styles.loadingText}>Loading bill details...</Text>
      </View>
    );
  }

  if (!bill) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error" size={64} color="#dc3545" />
        <Text style={styles.errorText}>Bill not found</Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <BackButton />
          <Text style={styles.headerTitle}>Bill Details</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.billHeader}>
            <View>
              <Text style={styles.billNumber}>Bill: {bill.bill_number}</Text>
              <Text style={styles.billCustomer}>{bill.customer_name}</Text>
              {bill.customer_phone && (
                <Text style={styles.billPhone}>
                  Phone: {bill.customer_phone}
                </Text>
              )}
            </View>
            <Text style={styles.billAmount}>
              ₹{bill.total_amount.toFixed(2)}
            </Text>
          </View>

          <View style={styles.dateSection}>
            <Icon name="calendar-today" size={18} color="#6c757d" />
            <Text style={styles.dateText}>
              {new Date(bill.date).toLocaleDateString("ta-IN")} •{" "}
              {new Date(bill.date).toLocaleTimeString("en-IN")}
            </Text>
          </View>

          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>
              Items ({bill.items?.length || 0})
            </Text>

            {bill.items?.map((item: any, index: number) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>
                    {item.bottle_display_name || item.item_name}
                  </Text>
                  <Text style={styles.itemAmount}>
                    ₹{item.amount.toFixed(2)}
                  </Text>
                </View>

                {item.unit_type === "count" ? (
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetail}>
                      Quantity: {item.quantity} nos × ₹
                      {item.price_per_unit?.toFixed(2)}/each
                    </Text>
                  </View>
                ) : (
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetail}>
                      Weight:{" "}
                      {(Number(item.l_weight) > 0
                        ? Number(item.l_weight)
                        : Number(item.final_weight)
                      ).toFixed(3)}{" "}
                      kg × ₹{Number(item.price_per_kg).toFixed(2)}/kg
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>
                ₹{bill.total_amount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.statusRow}>
              <Icon
                name={bill.is_synced ? "cloud-done" : "cloud-upload"}
                size={20}
                color={bill.is_synced ? "#28a745" : "#ffc107"}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: bill.is_synced ? "#28a745" : "#ffc107" },
                ]}
              >
                {bill.is_synced ? "Synced to server" : "Pending sync"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleShowPDF}>
            <Icon name="visibility" size={24} color="#4a6da7" />
            <Text style={styles.actionButtonText}>View PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePrintPDF}
          >
            <Icon name="print" size={24} color="#4a6da7" />
            <Text style={styles.actionButtonText}>Print PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSharePDF}
          >
            <Icon name="share" size={24} color="#4a6da7" />
            <Text style={styles.actionButtonText}>Share PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleDeleteBill}
          >
            <Icon name="delete" size={24} color="#dc3545" />
            <Text style={[styles.actionButtonText, { color: "#dc3545" }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fa",
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    color: "#dc3545",
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "#4a6da7",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#4a6da7",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  card: {
    backgroundColor: "white",
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  billNumber: {
    fontSize: 16,
    color: "#6c757d",
    marginBottom: 4,
  },
  billCustomer: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 4,
  },
  billPhone: {
    fontSize: 14,
    color: "#6c757d",
  },
  billAmount: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#4a6da7",
  },
  dateSection: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f9fa",
  },
  dateText: {
    fontSize: 14,
    color: "#6c757d",
    marginLeft: 8,
  },
  itemsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: "#f8f9fa",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    flex: 1,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#28a745",
  },
  itemDetails: {
    marginLeft: 8,
  },
  itemDetail: {
    fontSize: 14,
    color: "#6c757d",
  },
  lWeightNote: {
    fontSize: 12,
    color: "#ffc107",
    fontStyle: "italic",
    marginTop: 2,
  },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: "#f8f9fa",
    paddingTop: 20,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  totalValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4a6da7",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: "row",
    margin: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonText: {
    fontSize: 12,
    color: "#4a6da7",
    fontWeight: "500",
    marginTop: 4,
  },
});
