import { useTheme } from "@/constants/ThemeContext";
import * as Print from "expo-print";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import BillItemRow from "../components/bill/BillItemRow";
import BackButton from "../components/common/BackButton";
import { SelectionModal } from "../components/common/SelectionModal";
import {
    addNewItem,
    getAllItems,
    getBillDetails,
    getWeightReduction,
    isDbInitialized,
    updateBill,
} from "../lib/database";
import { PDFGenerator } from "../lib/pdfGenerator";

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

import { ScrollToTop } from "@/components/common/ScrollToTop";

export default function EditBillScreen() {
  const { billId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showUnitTypeModal, setShowUnitTypeModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemUnitType, setNewItemUnitType] = useState<"weight" | "count">("weight");
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [selectedWeightMode, setSelectedWeightMode] = useState<"normal" | "L">("normal");
  const [weightReduction, setWeightReduction] = useState(0.1);
  const [billNumber, setBillNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Scroll to top logic
  const [showScrollTop, setShowScrollTop] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: any) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowScrollTop(offsetY > 200);
  };

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!billId) {
        Alert.alert("Error", "No bill ID provided");
        router.back();
        return;
      }

      try {
        if (!isDbInitialized()) {
          // Quick wait for DB
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        await loadItems();
        await loadBillData(Number(billId));
      } catch (error) {
        console.error("Error initializing edit screen:", error);
        Alert.alert("Error", "Failed to load bill details");
        router.back();
      }
    };

    init();
  }, [billId]);

  // Calculate total amount whenever billItems change
  useEffect(() => {
    const total = billItems.reduce((sum, item) => sum + item.amount, 0);
    setTotalAmount(total);
  }, [billItems]);

  const loadItems = async () => {
    try {
      const items = await getAllItems();
      const reduction = await getWeightReduction();

      if (isMounted.current) {
        setAvailableItems(items || []);
        setWeightReduction(reduction);
      }
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const loadBillData = async (id: number) => {
    try {
      const bill = await getBillDetails(id);
      if (!bill) {
        Alert.alert("Error", "Bill not found");
        router.back();
        return;
      }

      setBillNumber(bill.bill_number || "");
      setCustomerName(bill.customer_name || "");
      setCustomerPhone(bill.customer_phone || "");

      const mappedItems: BillItem[] = bill.items.map((item: any) => ({
        id: Date.now().toString() + Math.random().toString(), // unique id
        itemId: item.item_id,
        itemName: item.item_name || item.bottle_display_name || "",
        unitType: item.unit_type || "weight",
        weights: [{ 
          weight: item.weight_mode === 'L' ? String(item.l_weight) : String(item.original_weight || item.final_weight), 
          weightMode: item.weight_mode 
        }],
        quantity: String(item.quantity || 1),
        price: String(item.unit_type === 'count' ? item.price_per_unit : item.price_per_kg),
        amount: item.amount
      }));

      setBillItems(mappedItems);
      // Set initial weight mode based on first item if any, otherwise default
      if (mappedItems.length > 0 && mappedItems[0].weights[0].weightMode) {
        setSelectedWeightMode(mappedItems[0].weights[0].weightMode);
      }

      setLoading(false);
    } catch (error) {
      console.error("Error loading bill data:", error);
      Alert.alert("Error", "Failed to load bill data");
    }
  };

  const addNewBillItem = () => {
    if (billItems.length >= 50) {
      Alert.alert("Limit Reached", "Maximum 50 items allowed per bill");
      return;
    }

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
          const quantity = parseInt(newItem.quantity) || 0;
          newItem.amount = quantity * price;
        } else {
          const weights = newItem.weights || [];
          const totalWeight = weights.reduce((sum, weightEntry) => {
            const weight = parseFloat(weightEntry?.weight || '0') || 0;
            return sum + (isNaN(weight) ? 0 : weight);
          }, 0);
          newItem.amount = totalWeight * price;
        }

        if (isNaN(newItem.amount) || !isFinite(newItem.amount)) {
          newItem.amount = 0;
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

      if (selectedItem.unit_type === "count") {
        updates.price = selectedItem.last_price_per_unit?.toString() || "0";
        updates.quantity = "1";
      } else {
        updates.price = selectedItem.last_price_per_kg?.toString() || "0";
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

      await loadItems();

      Alert.alert("Success", "New item added successfully!");
    } catch (error) {
      console.error("Error adding new item:", error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to add new item");
    }
  };

  const handleUpdateBill = async (printAfterSave: boolean = false) => {
    try {
      for (const item of billItems) {
        if (!item.itemId || !item.price) {
          Alert.alert("Error", "Please fill all item details");
          return;
        }

        if (item.unitType === "weight") {
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

      const billData = {
        billNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        totalAmount,
        items: billItems.map((item) => ({
          itemId: item.itemId,
          itemName: item.itemName, // Add itemName
          unitType: item.unitType, // Add unitType
          weight:
            item.unitType === "weight"
              ? item.weights.reduce(
                (sum, w) => sum + (parseFloat(w.weight) || 0),
                0
              ).toFixed(3)
              : 0,
          quantity: parseInt(item.quantity) || 1,
          weightMode: item.weights[0]?.weightMode || "normal",
          price: parseFloat(item.price),
          amount: item.amount,
        })),
      };

      await updateBill(Number(billId), billData);

      if (printAfterSave) {
        await handlePrintBill();
      } else {
        Alert.alert("Success", "Bill updated successfully!", [
            { text: "OK", onPress: () => router.back() }
        ]);
        setSaving(false);
      }
    } catch (error) {
      console.error("Error updating bill:", error);
      Alert.alert("Error", "Failed to update bill");
      setSaving(false);
    }
  };

  const handlePrintBill = async () => {
    setPrinting(true);
    try {
      const billData = {
        id: Number(billId),
        billNumber,
        customerName: customerName || "Walk-in Customer",
        customerPhone,
        totalAmount,
        date: new Date().toISOString(), // Use current date for reprint or fetch orig? Usually re-print uses current or orig. Let's stick to simple props for now.
        isSynced: false,
        items: billItems.map((item) => {
            const itemDetails = availableItems.find((i) => i.id === item.itemId);
            if (item.unitType === "count") {
              return {
                itemName: itemDetails?.name || item.itemName,
                unitType: "count" as const,
                quantity: parseInt(item.quantity) || 1,
                pricePerUnit: parseFloat(item.price),
                amount: item.amount,
              };
            } else {
              const totalWeight = item.weights.reduce((sum, weightEntry) => {
                return sum + (parseFloat(weightEntry.weight) || 0);
              }, 0);

              const isLMode = item.weights.some((w) => w.weightMode === "L");
              let originalWeight, lWeight, finalWeight, reducedWeight;

              if (isLMode) {
                lWeight = totalWeight;
                originalWeight = lWeight / (1 - weightReduction);
                finalWeight = originalWeight;
                reducedWeight = originalWeight - lWeight;
              } else {
                originalWeight = totalWeight;
                lWeight = 0;
                finalWeight = totalWeight;
                reducedWeight = 0;
              }

              return {
                itemName: itemDetails?.name || item.itemName,
                unitType: "weight" as const,
                originalWeight: Number(originalWeight.toFixed(3)),
                lWeight: Number(lWeight.toFixed(3)),
                reducedWeight: Number(reducedWeight.toFixed(3)),
                finalWeight: Number(finalWeight.toFixed(3)),
                weight: Number(originalWeight.toFixed(3)), // V1 PDF uses 'weight' for display in some cases
                weightMode: item.weights[0]?.weightMode || "normal",
                pricePerKg: parseFloat(item.price),
                amount: item.amount,
                weightEntries: item.weights, 
              };
            }
          }),
      };

      const pdfUri = await PDFGenerator.generatePDF(billData, "tamil");
      await Print.printAsync({
        uri: pdfUri,
        printerUrl: "auto",
      });

      Alert.alert("Success", "Bill printed successfully!", [
          { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error("Error printing bill:", error);
      Alert.alert("Print Error", "Failed to print bill");
    } finally {
      setPrinting(false);
      setSaving(false);
    }
  };

  const toggleWeightMode = () => {
    const newMode = selectedWeightMode === "normal" ? "L" : "normal";
    setSelectedWeightMode(newMode);

    setBillItems(
      billItems.map((item) => {
        if (item.unitType === "weight") {
          return { ...item, weights: item.weights.map(w => ({...w, weightMode: newMode})) };
        }
        return item;
      })
    );
  };

  const styles = useMemo(() => createStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading Bill...
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
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
        <View style={styles.header}>
            <BackButton />
            <View style={{marginLeft: 16}}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                Edit Bill
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {billNumber}
                </Text>
            </View>
        </View>

          {/* Customer Details */}
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
             <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 12 }]}>Customer Details</Text>
             <View style={styles.inputRow}>
                <View style={{flex: 1, marginRight: 8}}>
                    <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Name</Text>
                    <TextInput
                        style={[styles.input, {color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground}]}
                        value={customerName}
                        onChangeText={setCustomerName}
                        placeholder="Customer Name"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>
                <View style={{flex: 1, marginLeft: 8}}>
                    <Text style={[styles.inputLabel, {color: colors.textSecondary}]}>Phone</Text>
                    <TextInput
                        style={[styles.input, {color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground}]}
                        value={customerPhone}
                        onChangeText={setCustomerPhone}
                        placeholder="Phone Number"
                        keyboardType="phone-pad"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>
             </View>
          </View>

          {/* Weight Mode */}
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
              style={[
                styles.actionButton,
                { backgroundColor: colors.secondary },
              ]}
              onPress={() => handleUpdateBill(false)}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Icon name="save" size={20} color="white" />
                  <Text style={styles.actionButtonText}>UPDATE</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: "#28a745" }]}
              onPress={() => handleUpdateBill(true)}
              disabled={saving || printing}
            >
              {printing ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Icon name="print" size={20} color="white" />
                  <Text style={styles.actionButtonText}>UPDATE & PRINT</Text>
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
                <TouchableOpacity
                  style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.border }]}
                  onPress={() => setShowUnitTypeModal(true)}
                >
                  <Text style={[styles.dropdownText, { color: colors.text }]}>
                    {newItemUnitType === "weight" ? "Weight (kg)" : "Count (pieces)"}
                  </Text>
                  <Icon name="arrow-drop-down" size={24} color={colors.textSecondary} />
                </TouchableOpacity>

                <SelectionModal
                  visible={showUnitTypeModal}
                  onClose={() => setShowUnitTypeModal(false)}
                  onSelect={setNewItemUnitType}
                  title="Select Unit Type"
                  items={[
                    { label: "Weight (kg)", value: "weight" },
                    { label: "Count (pieces)", value: "count" },
                  ]}
                  selectedValue={newItemUnitType}
                />
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
      <ScrollToTop visible={showScrollTop} onPress={scrollToTop} />
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16
    },
    keyboardView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 100,
    },
    header: {
      padding: 20,
      flexDirection: "row",
      alignItems: 'center'
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "bold",
    },
    headerSubtitle: {
      fontSize: 14,
    },
    card: {
      margin: 16,
      marginTop: 0,
      borderRadius: 12,
      padding: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "600",
    },
    weightModeContainer: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 12,
    },
    weightModeButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      backgroundColor: "#e9ecef",
      alignItems: "center",
    },
    weightModeText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#495057",
    },
    weightModeTextActive: {
      color: "white",
    },
    buttonsContainer: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 16,
    },
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 6,
    },
    buttonText: {
      color: "white",
      fontSize: 12,
      fontWeight: "600",
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 12,
      borderRadius: 8,
      marginTop: 12,
    },
    addButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },
    totalCard: {
      margin: 16,
      marginTop: 0,
      borderRadius: 12,
      padding: 20,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    totalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    totalLabel: {
      fontSize: 18,
      color: "rgba(255, 255, 255, 0.9)",
      fontWeight: "500",
    },
    itemCount: {
      backgroundColor: "rgba(255, 255, 255, 0.2)",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    itemCountText: {
      fontSize: 12,
      color: "white",
    },
    totalRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      alignItems: "center",
    },
    totalAmount: {
      fontSize: 36,
      fontWeight: "bold",
      color: "white",
    },
    actionButtonsRow: {
      flexDirection: "row",
      gap: 12,
      padding: 16,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 16,
      borderRadius: 12,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    actionButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "bold",
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "center",
      padding: 20,
    },
    modalContent: {
      borderRadius: 16,
      overflow: "hidden",
      maxHeight: "80%",
    },
    modalHeader: {
      padding: 16,
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "white",
    },
    modalBody: {
      padding: 20,
    },
    modalInputContainer: {
      marginBottom: 16,
    },
    modalLabel: {
      fontSize: 14,
      fontWeight: "600",
      marginBottom: 8,
    },
    modalInput: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    dropdownButton: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
    },
    dropdownText: {
      fontSize: 16,
    },
    modalFooter: {
      flexDirection: "row",
      padding: 16,
      gap: 12,
      borderTopWidth: 1,
    },
    modalButton: {
      flex: 1,
      padding: 12,
      borderRadius: 8,
      alignItems: "center",
      borderWidth: 1,
      borderColor: "transparent",
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: "600",
    },
    inputRow: {
        flexDirection: 'row',
        marginBottom: 8
    },
    inputLabel: {
        fontSize: 12,
        marginBottom: 4
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 10,
        fontSize: 14
    }
  });
