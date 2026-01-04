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
import Icon from "react-native-vector-icons/MaterialIcons";
import BillItemRow from "../../components/bill/BillItemRow";
import {
  addBottleType,
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
  itemCategory: string;
  unitType: "weight" | "count";
  weight: string;
  quantity: string;
  weightMode: "normal" | "L";
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
      itemCategory: "",
      unitType: "weight",
      weight: "",
      quantity: "1",
      weightMode: "normal",
      price: "",
      amount: 0,
    },
  ]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showNewBottleModal, setShowNewBottleModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("general");
  const [newItemUnitType, setNewItemUnitType] = useState<"weight" | "count">(
    "weight"
  );
  const [newBottleName, setNewBottleName] = useState("");
  const [newBottleDisplayName, setNewBottleDisplayName] = useState("");
  const [newBottlePrice, setNewBottlePrice] = useState("");
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
        itemCategory: "",
        unitType: "weight",
        weight: "",
        quantity: "1",
        weightMode: selectedWeightMode,
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
          // Bottles: amount = quantity * price
          const quantity = parseInt(newItem.quantity) || 0;
          newItem.amount = quantity * price;
        } else {
          // Weight items: amount = weight * price
          const weight = parseFloat(newItem.weight) || 0;
          newItem.amount = weight * price;
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
        itemCategory: selectedItem.category,
        unitType: selectedItem.unit_type,
      };

      // Set price based on unit type
      if (selectedItem.unit_type === "count") {
        updates.price = selectedItem.last_price_per_unit?.toString() || "0";
        updates.quantity = "1";
      } else {
        updates.price = selectedItem.last_price_per_kg?.toString() || "0";
        updates.weight = "";
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
        newItemCategory,
        newItemUnitType
      );

      setNewItemName("");
      setNewItemPrice("");
      setNewItemCategory("general");
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

  const handleAddNewBottle = async () => {
    if (!newBottleName.trim() || !newBottleDisplayName.trim()) {
      Alert.alert("Error", "Please enter bottle code and display name");
      return;
    }

    try {
      await addBottleType(
        newBottleName.trim(),
        newBottleDisplayName.trim(),
        parseFloat(newBottlePrice) || 0
      );

      setNewBottleName("");
      setNewBottleDisplayName("");
      setNewBottlePrice("");
      setShowNewBottleModal(false);

      // Reload items
      await loadItems();

      Alert.alert("Success", "New bottle type added successfully!");
    } catch (error) {
      console.error("Error adding new bottle:", error);
      Alert.alert("Error", error.message || "Failed to add new bottle");
    }
  };

  const handleSaveBill = async (printAfterSave: boolean = false) => {
    // Validate all items
    for (const item of billItems) {
      if (!item.itemId || !item.price) {
        Alert.alert("Error", "Please fill all item details");
        return;
      }

      if (item.unitType === "weight" && !item.weight) {
        Alert.alert("Error", "Please enter weight for weight-based items");
        return;
      }

      if (
        item.unitType === "count" &&
        (!item.quantity || parseInt(item.quantity) <= 0)
      ) {
        Alert.alert("Error", "Please enter valid quantity for bottle items");
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
          weight: item.unitType === "weight" ? parseFloat(item.weight) || 0 : 0,
          quantity: parseInt(item.quantity) || 1,
          weightMode: item.weightMode,
          price: parseFloat(item.price),
          amount: item.amount,
        })),
      };

      // Save to database
      const billId = await saveBill(billData);

      if (printAfterSave) {
        await handlePrintBill(billId, billNumber);
      } else {
        Alert.alert("Success", "Bill saved successfully!", [
          {
            text: "Create New Bill",
            onPress: () => {
              resetForm();
              setSaving(false);
            },
          },
          {
            text: "Print Bill",
            onPress: () => handlePrintBill(billId, billNumber),
          },
          {
            text: "OK",
            onPress: () => setSaving(false),
          },
        ]);
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
            return {
              itemName: itemDetails?.name || item.itemName,
              unitType: "weight",
              originalWeight: parseFloat(item.weight) || 0,
              lWeight:
                item.weightMode === "L" ? parseFloat(item.weight) || 0 : 0,
              reducedWeight: 0,
              finalWeight: parseFloat(item.weight) || 0,
              weightMode: item.weightMode,
              pricePerKg: parseFloat(item.price),
              amount: item.amount,
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
        itemCategory: "",
        unitType: "weight",
        weight: "",
        quantity: "1",
        weightMode: "normal",
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

              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#17a2b8" }]}
                onPress={() => setShowNewBottleModal(true)}
              >
                <Icon name="local-drink" size={18} color="white" />
                <Text style={styles.buttonText}>New Bottle</Text>
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
                <View style={styles.itemTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.itemTypeButton,
                      newItemUnitType === "weight" && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                    onPress={() => setNewItemUnitType("weight")}
                  >
                    <Text
                      style={[
                        styles.itemTypeText,
                        newItemUnitType === "weight" &&
                          styles.itemTypeTextActive,
                      ]}
                    >
                      Weight Item
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.itemTypeButton,
                      newItemUnitType === "count" && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                    onPress={() => setNewItemUnitType("count")}
                  >
                    <Text
                      style={[
                        styles.itemTypeText,
                        newItemUnitType === "count" &&
                          styles.itemTypeTextActive,
                      ]}
                    >
                      Bottle
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Category
                </Text>
                <View style={styles.categoryContainer}>
                  {["metal", "plastic", "paper", "other"].map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.categoryButton,
                        newItemCategory === category && {
                          backgroundColor: colors.primary,
                        },
                      ]}
                      onPress={() => setNewItemCategory(category)}
                    >
                      <Text
                        style={[
                          styles.categoryButtonText,
                          newItemCategory === category && { color: "white" },
                        ]}
                      >
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
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

      {/* Add New Bottle Modal */}
      <Modal
        visible={showNewBottleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewBottleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.cardBackground },
            ]}
          >
            <View style={[styles.modalHeader, { backgroundColor: "#17a2b8" }]}>
              <Text style={styles.modalTitle}>Add New Bottle Type</Text>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Bottle Code *
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
                  placeholder="e.g., beer_bottle"
                  placeholderTextColor={colors.textSecondary}
                  value={newBottleName}
                  onChangeText={setNewBottleName}
                  autoCapitalize="none"
                />
                <Text
                  style={[styles.helperText, { color: colors.textSecondary }]}
                >
                  Unique code without spaces (used internally)
                </Text>
              </View>

              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Display Name *
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
                  placeholder="e.g., Beer Bottle"
                  placeholderTextColor={colors.textSecondary}
                  value={newBottleDisplayName}
                  onChangeText={setNewBottleDisplayName}
                />
                <Text
                  style={[styles.helperText, { color: colors.textSecondary }]}
                >
                  Name shown to customers
                </Text>
              </View>

              <View style={styles.modalInputContainer}>
                <Text style={[styles.modalLabel, { color: colors.text }]}>
                  Price per unit (₹) *
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
                  value={newBottlePrice}
                  onChangeText={setNewBottlePrice}
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
                onPress={() => setShowNewBottleModal(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: "#17a2b8" }]}
                onPress={handleAddNewBottle}
              >
                <Text style={styles.addButtonText}>Add Bottle</Text>
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
    categoryContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    categoryButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 6,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    categoryButtonText: {
      fontSize: 14,
      color: colors.text,
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
