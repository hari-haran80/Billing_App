// app/reports.tsx - UPDATED WITH FIXED EXPORT AND SIMPLIFIED FILTERS
import BackButton from "@/components/common/BackButton";
import { getAllBills } from "@/lib/database";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import * as XLSX from "xlsx";

export default function ReportsScreen() {
  const [bills, setBills] = useState<any[]>([]);
  const [filteredBills, setFilteredBills] = useState<any[]>([]);
  const [filters, setFilters] = useState({
    customer: "",
    dateFrom: "",
    dateTo: "",
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadBills();
  }, []);

  useEffect(() => {
    filterBills();
  }, [filters, bills]);

  const loadBills = async () => {
    try {
      const billsData = await getAllBills();
      setBills(billsData || []);
      setFilteredBills(billsData || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading bills:", error);
      Alert.alert("Error", "Failed to load bills");
      setLoading(false);
    }
  };

  const filterBills = () => {
    let filtered = [...bills];

    if (filters.customer) {
      filtered = filtered.filter((bill) =>
        bill.customer_name
          .toLowerCase()
          .includes(filters.customer.toLowerCase())
      );
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((bill) => new Date(bill.date) >= fromDate);
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((bill) => new Date(bill.date) <= toDate);
    }

    setFilteredBills(filtered);
  };

  const exportToExcel = async () => {
    setExporting(true);
    try {
      if (filteredBills.length === 0) {
        Alert.alert("No Data", "There are no bills to export");
        setExporting(false);
        return;
      }

      // Prepare data for Excel
      const data = filteredBills.map((bill, index) => ({
        "S.No": index + 1,
        "Bill Number": bill.bill_number,
        "Customer Name": bill.customer_name,
        "Customer Phone": bill.customer_phone || "",
        Date: new Date(bill.date).toLocaleDateString("en-IN"),
        Time: new Date(bill.date).toLocaleTimeString("en-IN"),
        "Items Count": bill.item_count || 0,
        "Total Amount (₹)": bill.total_amount,
        "Items List": bill.items_list || "",
        "Is Synced": bill.is_synced ? "Yes" : "No",
      }));

      // Create workbook
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reports");

      // Generate Excel file
      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

      // Save file
      const fileName = `Scrap_Reports_${Date.now()}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(
        FileSystem.documentDirectory!
      );
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory!, {
          intermediates: true,
        });
      }

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export Reports",
        });
      } else {
        Alert.alert(
          "Success",
          `Report exported successfully!\n\nFile: ${fileName}`
        );
      }
    } catch (error: any) {
      console.error("Error exporting to Excel:", error);
      Alert.alert(
        "Export Failed",
        error.message || "Failed to export report. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  const exportSummary = async () => {
    setExporting(true);
    try {
      if (filteredBills.length === 0) {
        Alert.alert("No Data", "There are no bills to generate summary");
        setExporting(false);
        return;
      }

      // Calculate summary
      const totalBills = filteredBills.length;
      const totalAmount = filteredBills.reduce(
        (sum, bill) => sum + bill.total_amount,
        0
      );
      const avgAmount = totalBills > 0 ? totalAmount / totalBills : 0;

      // Get date range
      const dates = filteredBills.map((bill) => new Date(bill.date));
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

      // Create summary data
      const summaryData = [
        ["SCAP BILLING SYSTEM - SUMMARY REPORT"],
        ["Generated on", new Date().toLocaleString("en-IN")],
        [""],
        [
          "Report Period",
          `${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`,
        ],
        ["Total Bills", totalBills],
        ["Total Amount (₹)", totalAmount.toFixed(2)],
        ["Average Bill Amount (₹)", avgAmount.toFixed(2)],
        [""],
        ["FILTERS APPLIED"],
        ["Customer Name", filters.customer || "All Customers"],
        ["Date From", filters.dateFrom || "Start"],
        ["Date To", filters.dateTo || "End"],
        [""],
        ["BILL DETAILS"],
        ["Bill No", "Customer", "Date", "Items Count", "Amount (₹)", "Status"],
        ...filteredBills.map((bill) => [
          bill.bill_number,
          bill.customer_name,
          new Date(bill.date).toLocaleDateString("en-IN"),
          bill.item_count || 0,
          `₹${bill.total_amount.toFixed(2)}`,
          bill.is_synced ? "Synced" : "Pending",
        ]),
      ];

      // Create workbook for summary
      const ws = XLSX.utils.aoa_to_sheet(summaryData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Summary");

      // Generate Excel file
      const wbout = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

      // Save file
      const fileName = `Summary_Report_${Date.now()}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Ensure directory exists
      const dirInfo = await FileSystem.getInfoAsync(
        FileSystem.documentDirectory!
      );
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory!, {
          intermediates: true,
        });
      }

      await FileSystem.writeAsStringAsync(fileUri, wbout, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Share file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export Summary Report",
        });
      } else {
        Alert.alert("Success", `Summary report exported successfully!`);
      }
    } catch (error: any) {
      console.error("Error exporting summary:", error);
      Alert.alert(
        "Export Failed",
        error.message || "Failed to export summary report. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  const renderBillItem = ({ item }: { item: any }) => (
    <View style={styles.billCard}>
      <View style={styles.billHeader}>
        <View>
          <Text style={styles.billCustomer}>{item.customer_name}</Text>
          <Text style={styles.billNumber}>{item.bill_number}</Text>
        </View>
        <Text style={styles.billAmount}>₹{item.total_amount.toFixed(2)}</Text>
      </View>

      <View style={styles.billDetails}>
        <View style={styles.billDetailRow}>
          <View style={styles.billDetailItem}>
            <Icon name="calendar-today" size={14} color="#6c757d" />
            <Text style={styles.billDetailText}>
              {new Date(item.date).toLocaleDateString("en-IN")}
            </Text>
          </View>

          <View style={styles.billDetailItem}>
            <Icon name="inventory" size={14} color="#6c757d" />
            <Text style={styles.billDetailText}>
              {item.item_count || 0} items
            </Text>
          </View>

          <View style={styles.billDetailItem}>
            <Icon
              name={item.is_synced ? "cloud-done" : "cloud-upload"}
              size={14}
              color={item.is_synced ? "#28a745" : "#ffc107"}
            />
            <Text
              style={[
                styles.billDetailText,
                { color: item.is_synced ? "#28a745" : "#ffc107" },
              ]}
            >
              {item.is_synced ? "Synced" : "Pending"}
            </Text>
          </View>
        </View>

        <Text style={styles.billItems} numberOfLines={2}>
          {item.items_list || "No items"}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <BackButton />
          <Text style={styles.headerTitle}>Reports</Text>
        </View>
        <Text style={styles.headerSubtitle}>View and export bill history</Text>
      </View>

      {/* Filters - Simplified */}
      <View style={styles.filtersCard}>
        <Text style={styles.filtersTitle}>Filters</Text>

        <TextInput
          style={styles.filterInput}
          placeholder="Customer Name"
          value={filters.customer}
          onChangeText={(text) => setFilters({ ...filters, customer: text })}
        />

        <View style={styles.filterRow}>
          <TextInput
            style={[styles.filterInput, { flex: 1 }]}
            placeholder="Date From (YYYY-MM-DD)"
            value={filters.dateFrom}
            onChangeText={(text) => setFilters({ ...filters, dateFrom: text })}
          />
          <TextInput
            style={[styles.filterInput, { flex: 1 }]}
            placeholder="Date To (YYYY-MM-DD)"
            value={filters.dateTo}
            onChangeText={(text) => setFilters({ ...filters, dateTo: text })}
          />
        </View>

        <TouchableOpacity
          style={styles.clearFiltersButton}
          onPress={() =>
            setFilters({
              customer: "",
              dateFrom: "",
              dateTo: "",
            })
          }
        >
          <Text style={styles.clearFiltersText}>Clear Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Export Buttons */}
      <View style={styles.exportButtons}>
        <TouchableOpacity
          style={[styles.exportButton, styles.exportExcelButton]}
          onPress={exportToExcel}
          disabled={exporting}
        >
          <Icon name="file-download" size={20} color="white" />
          <Text style={styles.exportButtonText}>
            {exporting ? "Exporting..." : "Export to Excel"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportButton, styles.exportSummaryButton]}
          onPress={exportSummary}
          disabled={exporting}
        >
          <Icon name="summarize" size={20} color="white" />
          <Text style={styles.exportButtonText}>
            {exporting ? "Exporting..." : "Summary Report"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>
          {filteredBills.length} Bills Found
        </Text>
        <Text style={styles.resultsTotal}>
          Total: ₹
          {filteredBills
            .reduce((sum, bill) => sum + bill.total_amount, 0)
            .toFixed(2)}
        </Text>
      </View>

      <FlatList
        data={filteredBills}
        renderItem={renderBillItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="receipt" size={48} color="#ddd" />
            <Text style={styles.emptyStateText}>No bills found</Text>
            <Text style={styles.emptyStateSubtext}>
              {bills.length === 0
                ? "Create your first bill"
                : "Try different filters"}
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
  header: {
    padding: 20,
    backgroundColor: "#4a6da7",
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    flex: 1,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 4,
  },
  filtersCard: {
    backgroundColor: "white",
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 16,
  },
  filterRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  filterInput: {
    borderWidth: 1,
    borderColor: "#dee2e6",
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 12,
  },
  clearFiltersButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  clearFiltersText: {
    color: "#6c757d",
    fontSize: 14,
  },
  exportButtons: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  exportButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 8,
  },
  exportExcelButton: {
    backgroundColor: "#28a745",
  },
  exportSummaryButton: {
    backgroundColor: "#17a2b8",
  },
  exportButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  resultsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
  },
  resultsTotal: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#4a6da7",
  },
  listContent: {
    padding: 16,
  },
  billCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  billAmount: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#4a6da7",
  },
  billDetails: {
    borderTopWidth: 1,
    borderTopColor: "#f8f9fa",
    paddingTop: 12,
  },
  billDetailRow: {
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
    fontSize: 12,
    color: "#6c757d",
  },
  billItems: {
    fontSize: 14,
    color: "#495057",
    fontStyle: "italic",
    lineHeight: 18,
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
});
