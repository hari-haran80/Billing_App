// app/create-bill.tsx - COMPLETELY UPDATED WITH PRINTING
import { useTheme } from "@/constants/ThemeContext";
import * as Print from "expo-print";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/MaterialIcons";
import BillItemRow from "../../components/bill/BillItemRow";
import {
  addNewItem,
  getAllItems,
  getNextBillNumber,
  getWeightReduction,
  isDbInitialized,
  saveBill,
} from "../../lib/database";
import { PDFGenerator } from "../../lib/pdfGenerator";

interface BillItem {
  id: string;
  itemId: number | null;
  itemName: string;
  unitType: "weight" | "count";
  weights: Array<{ weight: string; weightMode: "normal" | "L" }>;
  quantity: string;
  price: string;
  amount: number;
}

export default function CreateBillScreen() {
  const { colors } = useTheme();
  const [billItems, setBillItems] = useState<BillItem[]>([
    {
      id: Date.now().toString(),
      itemId: null,
      itemName: "",
      unitType: "weight",
      weights: [{ weight: "", weightMode: "normal" }],
      quantity: "1",
      price: "",
      amount: 0,
    },
  ]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemUnitType, setNewItemUnitType] = useState<"weight" | "count">(
    "weight"
  );
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [selectedWeightMode, setSelectedWeightMode] = useState<"normal" | "L">(
    "normal"
  );
  const [weightReduction, setWeightReduction] = useState(0.1);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const total = billItems.reduce((sum, item) => sum + (item.amount || 0), 0);
    setTotalAmount(total);
  }, [billItems]);

  const loadData = async () => {
    try {
      const interval = setInterval(() => {
        if (isDbInitialized()) {
          clearInterval(interval);
          loadItems();
        }
      }, 500);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  const loadItems = async () => {
    try {
      const items = await getAllItems();
      const reduction = await getWeightReduction();
      setAvailableItems(items || []);
      setWeightReduction(reduction);
      setLoading(false);
    } catch (error) {
      console.error("Error loading items:", error);
      setLoading(false);
    }
  };

  const addNewBillItem = () => {
    setBillItems([
      ...billItems,
      {
        id: Date.now().toString(),
        itemId: null,
        itemName: "",
        unitType: "weight",
        weights: [{ weight: "", weightMode: selectedWeightMode }],
        quantity: "1",
        price: "",
        amount: 0,
      },
    ]);
  };

  const updateBillItem = (id: string, updates: Partial<BillItem>) => {
    setBillItems(
      billItems.map((item) => {
        if (item.id !== id) return item;

        const newItem = { ...item, ...updates };
        const price = parseFloat(newItem.price) || 0;

        if (newItem.unitType === "count") {
          // Count items: amount = quantity * price
          const quantity = parseInt(newItem.quantity) || 0;
          newItem.amount = quantity * price;
        } else {
          // Weight items: amount = total weight * price
          const totalWeight = newItem.weights.reduce((sum, weightEntry) => {
            return sum + (parseFloat(weightEntry.weight) || 0);
          }, 0);
          newItem.amount = totalWeight * price;
        }

        return newItem;
      })
    );
  };

  const handleItemSelect = async (id: string, itemId: number) => {
    const selectedItem = availableItems.find((i) => i.id === itemId);
    if (selectedItem) {
      const updates: Partial<BillItem> = {
        itemId,
        itemName: selectedItem.name,
        unitType: selectedItem.unit_type,
      };

      // Set price based on unit type
      if (selectedItem.unit_type === "count") {
        updates.price = selectedItem.last_price_per_unit?.toString() || "0";
        updates.quantity = "1";
      } else {
        updates.price = selectedItem.last_price_per_kg?.toString() || "0";
        // Initialize with one empty weight entry
        updates.weights = [{ weight: "", weightMode: selectedWeightMode }];
      }

      updateBillItem(id, updates);
    }
  };

  const handleAddNewItem = async () => {
    if (!newItemName.trim()) {
      Alert.alert("Error", "Please enter item name");
      return;
    }

    try {
      await addNewItem(
        newItemName.trim(),
        parseFloat(newItemPrice) || 0,
        newItemUnitType
      );

      setNewItemName("");
      setNewItemPrice("");
      setNewItemUnitType("weight");
      setShowNewItemModal(false);

      // Reload items
      await loadItems();

      Alert.alert("Success", "New item added successfully!");
    } catch (error) {
      console.error("Error adding new item:", error);
      Alert.alert("Error", error.message || "Failed to add new item");
    }
  };

  const handleSaveBill = async (printAfterSave: boolean = false) => {
    // Validate all items
    for (const item of billItems) {
      if (!item.itemId || !item.price) {
        Alert.alert("Error", "Please fill all item details");
        return;
      }

      if (item.unitType === "weight") {
        // Check if at least one weight entry has a value
        const hasValidWeight = item.weights.some(
          (weightEntry) =>
            weightEntry.weight && parseFloat(weightEntry.weight) > 0
        );
        if (!hasValidWeight) {
          Alert.alert("Error", "Please enter weight for weight-based items");
          return;
        }
      }

      if (
        item.unitType === "count" &&
        (!item.quantity || parseInt(item.quantity) <= 0)
      ) {
        Alert.alert("Error", "Please enter valid quantity for count items");
        return;
      }
    }

    setSaving(true);
    try {
      // Generate bill number
      const billNumber = await getNextBillNumber();

      // Prepare bill data
      const billData = {
        billNumber,
        totalAmount,
        items: billItems.map((item) => ({
          itemId: item.itemId,
          weight: item.unitType === "weight" ? item.weights.reduce((sum, w) => sum + (parseFloat(w.weight) || 0), 0) : 0,
          quantity: parseInt(item.quantity) || 1,
          weightMode: item.weights[0]?.weightMode || "normal",
          price: parseFloat(item.price),
          amount: item.amount,
        })),
      };

      // Save to database
      const billId = await saveBill(billData);

      if (printAfterSave) {
        await handlePrintBill(billId, billNumber);
      } else {
        Alert.alert("Success", "Bill saved successfully!");
        resetForm();
        setSaving(false);
      }
    } catch (error) {
      console.error("Error saving bill:", error);
      Alert.alert("Error", error.message || "Failed to save bill");
      setSaving(false);
    }
  };

  const handlePrintBill = async (billId: number, billNumber: string) => {
    setPrinting(true);
    try {
      // Prepare bill data for PDF
      const billData = {
        id: billId,
        billNumber,
        customerName: "Walk-in Customer",
        totalAmount,
        date: new Date().toISOString(),
        isSynced: false,
        items: billItems.map((item) => {
          const itemDetails = availableItems.find((i) => i.id === item.itemId);
          if (item.unitType === "count") {
            return {
              itemName: itemDetails?.name || item.itemName,
              unitType: "count",
              quantity: parseInt(item.quantity) || 1,
              pricePerUnit: parseFloat(item.price),
              amount: item.amount,
            };
          } else {
            // Calculate total weight from all weight entries
            const totalWeight = item.weights.reduce((sum, weightEntry) => {
              return sum + (parseFloat(weightEntry.weight) || 0);
            }, 0);

            // Calculate L weight (assuming L mode applies to total)
            const lWeight = item.weights.some((w) => w.weightMode === "L")
              ? totalWeight
              : 0;

            return {
              itemName: itemDetails?.name || item.itemName,
              unitType: "weight",
              originalWeight: totalWeight,
              lWeight: lWeight,
              reducedWeight: 0,
              finalWeight: totalWeight,
              weightMode: item.weights[0]?.weightMode || "normal",
              pricePerKg: parseFloat(item.price),
              amount: item.amount,
              weightEntries: item.weights, // Include individual weight entries for detailed display
            };
          }
        }),
      };

      // Generate PDF
      const pdfUri = await PDFGenerator.generatePDF(billData, "tamil");

      // Print the PDF
      await Print.printAsync({
        uri: pdfUri,
        printerUrl: "auto",
      });

      Alert.alert("Success", "Bill printed successfully!");
      resetForm();
    } catch (error) {
      console.error("Error printing bill:", error);
      Alert.alert(
        "Error",
        "Failed to print bill. Make sure printer is connected."
      );
    } finally {
      setPrinting(false);
      setSaving(false);
    }
  };

  const resetForm = () => {
    setBillItems([
      {
        id: Date.now().toString(),
        itemId: null,
        itemName: "",
        unitType: "weight",
        weights: [{ weight: "", weightMode: "normal" }],
        quantity: "1",
        price: "",
        amount: 0,
      },
    ]);
    setTotalAmount(0);
    setSelectedWeightMode("normal");
  };

  const toggleWeightMode = () => {
    const newMode = selectedWeightMode === "normal" ? "L" : "normal";
    setSelectedWeightMode(newMode);

    // Update all weight-based items
    setBillItems(
      billItems.map((item) => {
        if (item.unitType === "weight") {
          return { ...item, weightMode: newMode };
        }
        return item;
      })
    );
  };

  const styles = createStyles(colors);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>
              New Bill
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: colors.textSecondary }]}
            >
              Create and save bills
            </Text>
          </View>

          {/* Weight Mode Toggle */}
          <View
            style={[styles.card, { backgroundColor: colors.cardBackground }]}
          >
            <View style={styles.cardHeader}>
              <Icon name="scale" size={24} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Weight Mode
              </Text>
            </View>

            <View style={styles.weightModeContainer}>
              <TouchableOpacity
                style={[
                  styles.weightModeButton,
                  selectedWeightMode === "normal" && {
                    backgroundColor: colors.primary,
                  },
                ]}
                onPress={() => toggleWeightMode()}
              >
                <Text
                  style={[
                    styles.weightModeText,
                    selectedWeightMode === "normal" &&
                      styles.weightModeTextActive,
                  ]}
                >
                  Normal Mode
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.weightModeButton,
                  selectedWeightMode === "L" && {
                    backgroundColor: colors.warning,
                  },
                ]}
                onPress={() => toggleWeightMode()}
              >
                <Text
                  style={[
                    styles.weightModeText,
                    selectedWeightMode === "L" && styles.weightModeTextActive,
                  ]}
                >
                  L Mode (Reduced)
                </Text>
              </TouchableOpacity>
            </View>

            <Text
              style={[styles.weightModeInfo, { color: colors.textSecondary }]}
            >
              {selectedWeightMode === "normal"
                ? "Using actual machine weight"
                : `Using reduced weight (${weightReduction * 100}% reduction)`}
            </Text>
          </View>

          {/* Bill Items */}
          <View
            style={[styles.card, { backgroundColor: colors.cardBackground }]}
          >
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeader}>
                <Icon name="list-alt" size={24} color={colors.primary} />
                <Text style={[styles.cardTitle, { color: colors.text }]}>
                  Bill Items
                </Text>
              </View>
            </View>

            <View style={styles.buttonsContainer}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.secondary }]}
                onPress={() => setShowNewItemModal(true)}
              >
                <Icon name="add-circle" size={18} color="white" />
                <Text style={styles.buttonText}>New Item</Text>
              </TouchableOpacity>
            </View>

            {billItems.map((item, index) => (
              <View key={item.id}>
                <BillItemRow
                  index={index}
                  item={item}
                  availableItems={availableItems}
                  weightMode={selectedWeightMode}
                  onItemSelect={(itemId) => handleItemSelect(item.id, itemId)}
                  onUpdate={(updates) => updateBillItem(item.id, updates)}
                  onRemove={() =>
                    setBillItems(billItems.filter((i) => i.id !== item.id))
                  }
                />
              </View>
            ))}
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.primary }]}
              onPress={addNewBillItem}
            >
              <Icon name="add" size={16} color="white" />
              <Text style={styles.addButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>

          {/* Total Amount */}
          <View style={[styles.totalCard, { backgroundColor: colors.primary }]}>
            <View style={styles.totalHeader}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <View style={styles.itemCount}>
                <Text style={styles.itemCountText}>
                  {billItems.length} item(s)
                </Text>
              </View>
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalAmount}>₹{totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#dc3545" }]}
              onPress={resetForm}
            >
              <Icon name="refresh" size={20} color="white" />
              <Text style={styles.actionButtonText}>RESET</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionButton,
                { backgroundColor: colors.secondary },
              ]}
              onPress={() => handleSaveBill(false)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Icon name="save" size={20} color="white" />
                  <Text style={styles.actionButtonText}>SAVE</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#28a745" }]}
              onPress={() => handleSaveBill(true)}
              disabled={saving || printing}
            >
              {printing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Icon name="print" size={20} color="white" />
                  <Text style={styles.actionButtonText}>PRINT</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add New Item Modal */}
      <Modal
        visible={showNewItemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <View
              style={[styles.modalHeader, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.modalTitle}>Add New Item</Text>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Item Name *
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g., Copper, Plastic, etc."
                  placeholderTextColor={colors.textSecondary}
                  value={newItemName}
                  onChangeText={setNewItemName}
                />
              </View>

              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Item Type
                </Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={newItemUnitType}
                    onValueChange={(value) => setNewItemUnitType(value)}
                    style={[styles.picker, { color: colors.text }]}
                    dropdownIconColor={colors.textSecondary}
                  >
                    <Picker.Item
                      label="Weight (kg)"
                      value="weight"
                      color={colors.text}
                    />
                    <Picker.Item
                      label="Count (pieces)"
                      value="count"
                      color={colors.text}
                    />
                  </Picker>
                </View>
              </View>

              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  {newItemUnitType === "count"
                    ? "Price per unit (₹)"
                    : "Price per kg (₹)"}
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  value={newItemPrice}
                  onChangeText={setNewItemPrice}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View
              style={[styles.modalFooter, { borderTopColor: colors.border }]}
            >
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setShowNewItemModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.primary },
                ]}
                onPress={handleAddNewItem}
              >
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    keyboardView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 32,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
    },
    loadingText: {
      marginTop: 12,
      fontSize: 16,
    },
    header: {
      marginBottom: 20,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: "bold",
      marginBottom: 4,
    },
    headerSubtitle: {
      fontSize: 16,
    },
    card: {
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 20,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    cardTitle: {
      fontSize: 20,
      fontWeight: "bold",
      marginLeft: 12,
    },
    inputContainer: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
    },
    weightModeContainer: {
      flexDirection: "row",
      marginBottom: 12,
      gap: 12,
    },
    weightModeButton: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    weightModeText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    weightModeTextActive: {
      color: "white",
    },
    weightModeInfo: {
      fontSize: 13,
      textAlign: "center",
      fontStyle: "italic",
    },
    buttonsContainer: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 20,
      gap: 8,
    },
    button: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: 8,
      gap: 6,
    },
    buttonText: {
      color: "white",
      fontWeight: "600",
      fontSize: 14,
    },
    totalCard: {
      borderRadius: 12,
      padding: 20,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 3,
    },
    totalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    totalLabel: {
      fontSize: 20,
      fontWeight: "bold",
      color: "white",
    },
    itemCount: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    itemCountText: {
      color: "white",
      fontWeight: "600",
      fontSize: 14,
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    totalAmount: {
      fontSize: 36,
      fontWeight: "bold",
      color: "white",
    },

    actionButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
    },
    actionButtonsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 16,
      gap: 8,
    },

    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12,
      paddingVertical: 16,
      borderRadius: 8,
      gap: 8,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      alignItems: "center",
      padding: 20,
    },
    modalContent: {
      borderRadius: 12,
      width: "100%",
      maxWidth: 400,
      overflow: "hidden",
    },
    modalHeader: {
      padding: 24,
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "bold",
      color: "white",
      textAlign: "center",
    },
    modalBody: {
      padding: 24,
    },
    modalInputContainer: {
      marginBottom: 20,
    },
    modalLabel: {
      fontSize: 16,
      fontWeight: "600",
      marginBottom: 8,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 14,
      fontSize: 16,
    },
    helperText: {
      fontSize: 12,
      marginTop: 4,
      fontStyle: "italic",
    },
    itemTypeContainer: {
      flexDirection: "row",
      gap: 8,
    },
    itemTypeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    itemTypeText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    itemTypeTextActive: {
      color: "white",
    },
    modalFooter: {
      flexDirection: "row",
      justifyContent: "flex-end",
      padding: 20,
      borderTopWidth: 1,
      gap: 12,
    },
    modalButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: 8,
      minWidth: 100,
      alignItems: "center",
    },
    cancelButtonText: {
      fontWeight: "600",
      fontSize: 16,
    },
    addButtonText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 16,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
      marginTop: 8,
      marginBottom: 16,
    },
  });
