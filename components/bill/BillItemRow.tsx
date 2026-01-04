// components/bill/BillItemRow.tsx - UPDATED
import { useTheme } from "@/constants/ThemeContext";
import { Picker } from "@react-native-picker/picker";
import React from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface BillItemRowProps {
  index: number;
  item: any;
  availableItems: any[];
  weightMode: "normal" | "L";
  onItemSelect: (itemId: number) => void;
  onUpdate: (updates: any) => void;
  onRemove: () => void;
}

export default function BillItemRow({
  index,
  item,
  availableItems,
  weightMode,
  onItemSelect,
  onUpdate,
  onRemove,
}: BillItemRowProps) {
  const { colors } = useTheme();

  const handleQuantityChange = (value: string) => {
    onUpdate({ quantity: value });
  };

  const handleWeightChange = (value: string, index: number) => {
    const newWeights = [...(item.weights || [{ weight: "", weightMode }])];
    newWeights[index] = { ...newWeights[index], weight: value };
    onUpdate({ weights: newWeights });
  };

  const addWeightEntry = () => {
    const newWeights = [
      ...(item.weights || [{ weight: "", weightMode }]),
      { weight: "", weightMode },
    ];
    onUpdate({ weights: newWeights });
  };

  const removeWeightEntry = (index: number) => {
    if (item.weights && item.weights.length > 1) {
      const newWeights = item.weights.filter(
        (_: any, i: number) => i !== index
      );
      onUpdate({ weights: newWeights });
    }
  };

  const handleQuantityIncrement = () => {
    const currentQty = parseInt(item.quantity) || 0;
    onUpdate({ quantity: (currentQty + 1).toString() });
  };

  const handleQuantityDecrement = () => {
    const currentQty = parseInt(item.quantity) || 0;
    if (currentQty > 1) {
      onUpdate({ quantity: (currentQty - 1).toString() });
    }
  };

  const handlePriceChange = (value: string) => {
    onUpdate({ price: value });
  };

  const styles = createStyles(colors);

  // Show all available items
  const filteredItems = availableItems;

  return (
    <View style={styles.container}>
      {/* Row Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.indexCircle}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
          <Text style={styles.headerTitle}>Item #{index + 1}</Text>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.deleteButton}>
          <Icon name="close" size={22} color={colors.danger} />
        </TouchableOpacity>
      </View>

      {/* Item Selection */}
      <View style={styles.section}>
        <Text style={styles.label}>Item</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={item.itemId}
            onValueChange={onItemSelect}
            style={[styles.picker, { color: colors.text }]}
            dropdownIconColor={colors.textSecondary}
          >
            <Picker.Item
              label="Select item"
              value={null}
              color={colors.textSecondary}
            />
            {filteredItems.map((avItem) => (
              <Picker.Item
                key={avItem.id}
                label={`${avItem.name} - ${avItem.unit_type === "count" ? "₹" + (avItem.last_price_per_unit || 0) + "/each" : "₹" + (avItem.last_price_per_kg || 0) + "/kg"}`}
                value={avItem.id}
                color={colors.text}
              />
            ))}
          </Picker>
        </View>
      </View>

      {/* Input based on item type */}
      {item.itemId && (
        <View style={styles.section}>
          {item.unitType === "count" ? (
            <>
              <Text style={styles.label}>Quantity</Text>
              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={[
                    styles.quantityButton,
                    { backgroundColor: colors.danger },
                  ]}
                  onPress={handleQuantityDecrement}
                >
                  <Icon name="remove" size={20} color="white" />
                </TouchableOpacity>
                <TextInput
                  style={[
                    styles.quantityInput,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.info,
                      color: colors.text,
                    },
                  ]}
                  placeholder="1"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  value={item.quantity}
                  onChangeText={handleQuantityChange}
                />
                <TouchableOpacity
                  style={[
                    styles.quantityButton,
                    { backgroundColor: colors.success },
                  ]}
                  onPress={handleQuantityIncrement}
                >
                  <Icon name="add" size={20} color="white" />
                </TouchableOpacity>
                <Text
                  style={[styles.inputLabel, { color: colors.textSecondary }]}
                >
                  nos
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Weight Entries</Text>
              {(item.weights || [{ weight: "", weightMode }]).map(
                (weightEntry: any, weightIndex: number) => (
                  <View key={weightIndex} style={styles.weightEntryRow}>
                    <TextInput
                      style={[
                        styles.weightInput,
                        {
                          backgroundColor: colors.background,
                          borderColor:
                            weightEntry.weightMode === "L"
                              ? colors.warning
                              : colors.primary,
                          color: colors.text,
                        },
                      ]}
                      placeholder="0.00"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="decimal-pad"
                      value={weightEntry.weight}
                      onChangeText={(value) =>
                        handleWeightChange(value, weightIndex)
                      }
                    />
                    <TouchableOpacity
                      style={[
                        styles.weightModeButton,
                        {
                          backgroundColor:
                            weightEntry.weightMode === "L"
                              ? colors.warning
                              : colors.primary,
                        },
                      ]}
                      onPress={() => {
                        const newWeights = [
                          ...(item.weights || [{ weight: "", weightMode }]),
                        ];
                        newWeights[weightIndex] = {
                          ...newWeights[weightIndex],
                          weightMode:
                            newWeights[weightIndex].weightMode === "L"
                              ? "normal"
                              : "L",
                        };
                        onUpdate({ weights: newWeights });
                      }}
                    >
                      <Text style={styles.weightModeText}>
                        {weightEntry.weightMode === "L" ? "L" : "N"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.removeWeightButton,
                        {
                          backgroundColor:
                            (item.weights || []).length > 1
                              ? colors.danger
                              : colors.warning,
                        },
                      ]}
                      onPress={() => removeWeightEntry(weightIndex)}
                      disabled={(item.weights || []).length <= 1}
                    >
                      <Icon name="remove" size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                )
              )}
              <TouchableOpacity
                style={[
                  styles.addWeightButton,
                  { backgroundColor: colors.success },
                ]}
                onPress={addWeightEntry}
              >
                <Icon name="add" size={16} color="white" />
                <Text style={styles.addWeightText}>Add Weight Entry</Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.totalWeightText,
                  { color: colors.textSecondary },
                ]}
              >
                Total:{" "}
                {(item.weights || [{ weight: "0" }])
                  .reduce(
                    (sum: number, entry: any) =>
                      sum + (parseFloat(entry.weight) || 0),
                    0
                  )
                  .toFixed(2)}{" "}
                kg
              </Text>
            </>
          )}

          <View style={styles.inputRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.label}>
                {item.unitType === "count"
                  ? "Price per unit (₹)"
                  : "Price per kg (₹)"}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={item.price}
                onChangeText={handlePriceChange}
              />
            </View>

            <View style={styles.amountContainer}>
              <Text style={styles.label}>Amount (₹)</Text>
              <View
                style={[
                  styles.amountBox,
                  { backgroundColor: colors.success + "20" },
                ]}
              >
                <Text style={[styles.amountText, { color: colors.text }]}>
                  ₹{item.amount.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },
    indexCircle: {
      width: 32,
      height: 32,
      backgroundColor: colors.primary,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    indexText: {
      color: "white",
      fontWeight: "bold",
      fontSize: 16,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: colors.text,
      marginRight: 12,
    },
    deleteButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.danger + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    section: {
      marginBottom: 16,
    },
    label: {
      fontSize: 16,
      fontWeight: "600",
      color: colors.text,
      marginBottom: 8,
    },
    pickerContainer: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      overflow: "hidden",
    },
    picker: {
      height: 50,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 12,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    inputLabel: {
      fontSize: 14,
      fontWeight: "600",
      width: 40,
    },
    priceContainer: {
      flex: 1,
    },
    amountContainer: {
      flex: 1,
    },
    amountBox: {
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      alignItems: "center",
      justifyContent: "center",
      borderColor: colors.success,
    },
    amountText: {
      fontSize: 18,
      fontWeight: "bold",
    },
    quantityButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    quantityInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      textAlign: "center",
      maxWidth: 80,
    },
    weightEntryRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 8,
    },
    weightInput: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
    },
    weightModeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: "center",
      alignItems: "center",
    },
    weightModeText: {
      color: "white",
      fontSize: 12,
      fontWeight: "bold",
    },
    removeWeightButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: "center",
      alignItems: "center",
    },
    addWeightButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
      borderRadius: 8,
      gap: 8,
      marginTop: 8,
    },
    addWeightText: {
      color: "white",
      fontSize: 14,
      fontWeight: "600",
    },
    totalWeightText: {
      fontSize: 14,
      fontWeight: "600",
      textAlign: "right",
      marginTop: 8,
    },
  });
