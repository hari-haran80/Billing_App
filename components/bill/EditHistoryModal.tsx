import { useTheme } from "@/constants/ThemeContext";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";
import { getAllItems, getBillEditHistory } from "../../lib/database";

interface EditHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  billId: number | null;
}

export const EditHistoryModal = ({
  visible,
  onClose,
  billId,
}: EditHistoryModalProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [history, setHistory] = useState<any[]>([]);
  const [itemsMap, setItemsMap] = useState<Record<number, string>>({}); // Map ID -> Name
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && billId) {
      loadHistoryAndItems();
    }
  }, [visible, billId]);

  const loadHistoryAndItems = async () => {
    if (!billId) return;
    setLoading(true);
    try {
      const [historyData, allItems] = await Promise.all([
        getBillEditHistory(billId),
        getAllItems(),
      ]);
      setHistory(historyData || []);
      
      // Create items map
      const map: Record<number, string> = {};
      allItems.forEach((i: any) => {
        map[i.id] = i.name;
      });
      setItemsMap(map);

    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderHistoryItem = ({ item }: { item: any }) => {
    const previousData = JSON.parse(item.previous_data || "{}");
    const newData = JSON.parse(item.new_data || "{}");
    const date = new Date(item.created_at).toLocaleString();

    // Calculate diffs
    const oldItems = previousData.items || [];
    const newItems = newData.items || [];
    
    // ... diff logic ...
    const changes: string[] = [];
    
    // Compare totals
    if (Math.abs(previousData.totalAmount - newData.totalAmount) > 0.01) {
        changes.push(`Total Amount: ₹${previousData.totalAmount?.toFixed(2)} ➔ ₹${newData.totalAmount.toFixed(2)}`);
    }

    // Helper to normalize item data
    const getItemProps = (i: any) => {
        const id = i.itemId || i.item_id;
        const name = i.itemName || i.name || i.item_name || itemsMap[id] || "Unknown Item";
        
        // Weight: Try 'weight' (frontend) first, then DB fields
        let weight = parseFloat(i.weight);
        if (isNaN(weight)) {
             // Fallback to DB fields
             weight = parseFloat(i.final_weight) || parseFloat(i.original_weight) || parseFloat(i.l_weight) || 0;
        }

        // Qty
        const quantity = parseInt(i.quantity) || 1;

        // Price
        let price = parseFloat(i.price);
        if (isNaN(price)) {
            price = parseFloat(i.price_per_kg) || parseFloat(i.price_per_unit) || 0;
        }

        return { id, name, weight, quantity, price };
    };

    // Compare Items with normalized data
    const oldItemsMap = new Map();
    oldItems.forEach((i: any) => {
        const { id, name } = getItemProps(i);
        // Prefer ID for matching, fallback to Name
        const key = id ? `ID_${id}` : `NAME_${name}`;
        oldItemsMap.set(key, i);
    });

    const newItemsProcessed = new Set();

    newItems.forEach((rawNewItem: any) => {
        const newItem = getItemProps(rawNewItem);
        const key = newItem.id ? `ID_${newItem.id}` : `NAME_${newItem.name}`;
        
        newItemsProcessed.add(key);
        
        const rawOldItem = oldItemsMap.get(key);

        if (!rawOldItem) {
             changes.push(`Added: ${newItem.name}`);
        } else {
             const oldItem = getItemProps(rawOldItem);

             // Compare Weight
             if (Math.abs(oldItem.weight - newItem.weight) > 0.001) {
                 changes.push(`${newItem.name} (Weight): ${oldItem.weight.toFixed(3)} ➔ ${newItem.weight.toFixed(3)}`);
             }

             // Compare Quantity
             if (oldItem.quantity !== newItem.quantity) {
                 changes.push(`${newItem.name} (Qty): ${oldItem.quantity} ➔ ${newItem.quantity}`);
             }

             // Compare Price
             if (Math.abs(oldItem.price - newItem.price) > 0.01) {
                 changes.push(`${newItem.name} (Price): ₹${oldItem.price.toFixed(2)} ➔ ₹${newItem.price.toFixed(2)}`);
             }
        }
    });

    // Check for removed items
    oldItemsMap.forEach((rawOldItem, key) => {
        if (!newItemsProcessed.has(key)) {
            const { name } = getItemProps(rawOldItem);
            changes.push(`Removed: ${name}`);
        }
    });

    return (
      <View style={styles.historyItem}>
        {/* ... Header ... */}
        <View style={styles.historyHeader}>
          <Text style={styles.historyDate}>{date}</Text>
          <View style={styles.chip}>
            <Text style={styles.chipText}>Edited</Text>
          </View>
        </View>

        <View style={styles.diffContainer}>
            {changes.length > 0 ? (
                changes.map((change, idx) => (
                    <Text key={idx} style={styles.diffText}>• {change}</Text>
                ))
            ) : (
                <Text style={styles.diffText}>No specific changes detected</Text>
            )}
        </View>


        {/* Item List Snapshot */}
        <View style={styles.itemsSnapshot}>
            <Text style={styles.snapshotTitle}>Items (Snapshot):</Text>
            {newItems.map((i: any, idx: number) => {
                // Heuristic: if weight exists and > 0, treat as weight item
                const hasWeight = parseFloat(i.weight) > 0;
                const isWeightType = i.unitType === 'weight' || (hasWeight && i.unitType !== 'count');
                
                const weightDisplay = isWeightType
                    ? `${(parseFloat(i.weight) || 0).toFixed(3)} kg` 
                    : `${i.quantity} nos`;
                
                // Name resolution: Snapshot Name -> DB Name -> Unknown
                const name = i.itemName || i.name || i.item_name || itemsMap[i.itemId] || "Unknown Item";

                return (
                    <View key={idx} style={styles.itemRow}>
                        <Text style={styles.itemName}>• {name}</Text>
                        <Text style={styles.itemDetails}>{weightDisplay} x ₹{i.price || i.price_per_unit || i.price_per_kg}</Text>
                        <Text style={styles.itemAmount}>₹{i.amount?.toFixed(2)}</Text>
                    </View>
                );
            })}
        </View>
      </View>
    );
  };
    // ... rest of component

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}
        >
          <View style={[styles.modalHeader, { backgroundColor: colors.primary }]}>
            <Text style={styles.modalTitle}>Edit History</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : history.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No edit history found.
              </Text>
            </View>
          ) : (
            <FlatList
              data={history}
              renderItem={renderHistoryItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      justifyContent: "flex-end",
    },
    modalContent: {
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      height: "80%",
      overflow: "hidden",
    },
    modalHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      padding: 16,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: "bold",
      color: "white",
    },
    loaderContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyText: {
      fontSize: 16,
    },
    listContent: {
      padding: 16,
    },
    historyItem: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    historyDate: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    chip: {
      backgroundColor: colors.info + "20",
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 12,
    },
    chipText: {
      fontSize: 12,
      color: colors.info,
      fontWeight: '600'
    },
    diffContainer: {
        marginBottom: 12,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    diffText: {
        fontSize: 14,
        color: colors.text,
        marginBottom: 4,
        fontWeight: '500'
    },
    itemsSnapshot: {
        gap: 8
    },
    snapshotTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.textSecondary,
        marginBottom: 4
    },
    itemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    itemName: {
        flex: 2,
        fontSize: 14,
        color: colors.text
    },
    itemDetails: {
        flex: 2,
        fontSize: 12,
        color: colors.textSecondary,
        textAlign: 'right',
        marginRight: 8
    },
    itemAmount: {
        flex: 1,
        fontSize: 14,
        fontWeight: 'bold',
        color: colors.text,
        textAlign: 'right'
    }
  });
