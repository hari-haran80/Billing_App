// app/items-management.tsx - SIMPLIFIED: Only Items (Weight/Count)
import {
  addNewItem,
  deleteItem,
  deleteMultipleItems,
  getAllItems,
  updateItemPrice,
} from "@/lib/database";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function ItemsManagementScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemUnitType, setNewItemUnitType] = useState<"weight" | "count">(
    "weight"
  );
  const [loading, setLoading] = useState(true);

  // Bulk selection states
  const [selectedItemIds, setSelectedItemIds] = useState<number[]>([]);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState("");
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const itemsData = await getAllItems();
      setItems(itemsData || []);
      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
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
      setShowAddModal(false);
      await loadData();
      Alert.alert("Success", "Item added successfully");
    } catch (error) {
      console.error("Error adding item:", error);
      Alert.alert("Error", (error as Error).message || "Failed to add item");
    }
  };

  const handleUpdatePrice = async (itemId: number, price: string) => {
    if (!price || isNaN(parseFloat(price))) {
      Alert.alert("Error", "Please enter a valid price");
      return;
    }

    try {
      await updateItemPrice(
        itemId,
        parseFloat(price),
        "weight" // Default to weight, will be overridden by unit_type
      );
      await loadData();
      setEditingItemId(null);
      setEditingPrice("");
    } catch (error) {
      console.error("Error updating price:", error);
      Alert.alert("Error", "Failed to update price");
    }
  };

  const handleDeleteItem = (id: number, name: string) => {
    Alert.alert("Delete Item", `Are you sure you want to delete "${name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItem(id);
            await loadData();
            Alert.alert("Success", "Item deleted successfully");
          } catch (error) {
            console.error("Error deleting item:", error);
            Alert.alert(
              "Error",
              (error as Error).message || "Failed to delete item"
            );
          }
        },
      },
    ]);
  };

  const handleUpdateItem = async (
    itemId: number,
    name: string,
    price: string
  ) => {
    if (!name.trim() || !price.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }

    try {
      // Update item name in database
      // TODO: Add database function to update item
      Alert.alert("Info", "Item update not fully implemented yet");

      // Update price
      await handleUpdatePrice(itemId, price);

      setEditingItemId(null);
      setEditingName("");
      setEditingPrice("");
    } catch (error) {
      console.error("Error updating item:", error);
      Alert.alert("Error", "Failed to update item");
    }
  };

  const startEditingPrice = (item: any) => {
    setEditingItemId(item.id);
    setEditingPrice(
      item.unit_type === "count"
        ? item.last_price_per_unit?.toString() || "0"
        : item.last_price_per_kg?.toString() || "0"
    );
  };

  const startEditingItem = (item: any) => {
    setEditingItemId(item.id);
    setEditingName(item.name);
    setEditingPrice(
      item.unit_type === "count"
        ? item.last_price_per_unit?.toString() || "0"
        : item.last_price_per_kg?.toString() || "0"
    );
  };

  // Bulk delete functions
  const handleBulkDelete = async () => {
    if (selectedItemIds.length === 0) {
      Alert.alert("Error", "Please select items to delete");
      return;
    }

    Alert.alert(
      "Delete Selected",
      `Are you sure you want to delete ${selectedItemIds.length} items?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteMultipleItems(selectedItemIds);
              setSelectedItemIds([]);
              await loadData();
              Alert.alert(
                "Success",
                `${selectedItemIds.length} items deleted successfully`
              );
            } catch (error) {
              console.error("Error bulk deleting:", error);
              Alert.alert(
                "Error",
                (error as Error).message || "Failed to delete selected items"
              );
            }
          },
        },
      ]
    );
  };

  const selectAllItems = () => {
    if (selectedItemIds.length === items.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(items.map((item) => item.id));
    }
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.itemCard}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => toggleItemSelection(item.id)}
      >
        <Icon
          name={
            selectedItemIds.includes(item.id)
              ? "check-box"
              : "check-box-outline-blank"
          }
          size={24}
          color={selectedItemIds.includes(item.id) ? "#4a6da7" : "#ccc"}
        />
      </TouchableOpacity>

      <View style={styles.itemContent}>
        {editingItemId === item.id ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editNameInput}
              value={editingName}
              onChangeText={setEditingName}
              placeholder="Item name"
            />
            <View style={styles.editPriceRow}>
              <TextInput
                style={styles.editPriceInput}
                value={editingPrice}
                onChangeText={setEditingPrice}
                keyboardType="decimal-pad"
                placeholder="Price"
              />
              <Text style={styles.priceLabel}>
                {item.unit_type === "count" ? "₹/each" : "₹/kg"}
              </Text>
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() =>
                  handleUpdateItem(item.id, editingName, editingPrice)
                }
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setEditingItemId(null)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.itemMainRow}>
              <View style={styles.itemNameContainer}>
                <Text
                  style={styles.itemName}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {item.name}
                </Text>
              </View>
              <View style={styles.itemPriceActionRow}>
                <TouchableOpacity
                  style={styles.priceDisplay}
                  onPress={() => startEditingPrice(item)}
                >
                  <Text style={styles.priceText}>
                    {item.unit_type === "count"
                      ? `₹${item.last_price_per_unit?.toFixed(2) || "0.00"}`
                      : `₹${item.last_price_per_kg?.toFixed(2) || "0.00"}`}
                  </Text>
                  <Text style={styles.priceLabel}>
                    {item.unit_type === "count" ? "per unit" : "per kg"}
                  </Text>
                </TouchableOpacity>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    onPress={() => startEditingItem(item)}
                    style={styles.editButton}
                  >
                    <Icon name="edit" size={20} color="#4a6da7" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteItem(item.id, item.name)}
                    style={styles.deleteButton}
                  >
                    <Icon name="delete" size={20} color="#dc3545" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            <View style={styles.itemDetailsRow}>
              <Text style={styles.itemDetails}>
                {item.unit_type === "count" ? "Count" : "Weight"}
              </Text>
            </View>
          </>
        )}
      </View>
    </View>
  );

  const toggleItemSelection = (id: number) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const renderBulkActions = () => {
    if (selectedItemIds.length > 0) {
      return (
        <View style={styles.bulkActions}>
          <TouchableOpacity
            style={styles.bulkActionButton}
            onPress={selectAllItems}
          >
            <Text style={styles.bulkActionText}>
              {selectedItemIds.length === items.length
                ? "Deselect All"
                : "Select All"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bulkActionButton, styles.deleteBulkButton]}
            onPress={handleBulkDelete}
          >
            <Icon name="delete" size={18} color="white" />
            <Text style={styles.bulkActionText}>
              Delete Selected ({selectedItemIds.length})
            </Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Items Management</Text>
        <Text style={styles.headerSubtitle}>
          Manage all items (weight and count)
        </Text>
      </View>

      {/* Bulk Actions */}
      {renderBulkActions()}

      {/* Add Button */}
      <TouchableOpacity
        style={[styles.addButton, styles.addItemButton]}
        onPress={() => setShowAddModal(true)}
      >
        <Icon name="add" size={24} color="white" />
        <Text style={styles.addButtonText}>Add New Item</Text>
      </TouchableOpacity>

      {/* Content */}
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="inventory" size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>No items found</Text>
            <Text style={styles.emptyStateSubtext}>Add your first item</Text>
          </View>
        }
      />

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[styles.modalHeader, { backgroundColor: "#4a6da7" }]}>
              <Text style={styles.modalTitle}>Add New Item</Text>
            </View>

            <View style={styles.modalBody}>
              <TextInput
                style={styles.modalInput}
                placeholder="Item Name (e.g., Copper, Plastic)"
                value={newItemName}
                onChangeText={setNewItemName}
              />

              <View style={styles.modalInputContainer}>
                <Text style={styles.modalLabel}>Unit Type</Text>
                <View style={styles.itemTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.itemTypeButton,
                      newItemUnitType === "weight" &&
                        styles.itemTypeButtonActive,
                    ]}
                    onPress={() => setNewItemUnitType("weight")}
                  >
                    <Text
                      style={[
                        styles.itemTypeButtonText,
                        newItemUnitType === "weight" &&
                          styles.itemTypeButtonTextActive,
                      ]}
                    >
                      Weight (kg)
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.itemTypeButton,
                      newItemUnitType === "count" &&
                        styles.itemTypeButtonActive,
                    ]}
                    onPress={() => setNewItemUnitType("count")}
                  >
                    <Text
                      style={[
                        styles.itemTypeButtonText,
                        newItemUnitType === "count" &&
                          styles.itemTypeButtonTextActive,
                      ]}
                    >
                      Count (pcs)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder={
                  newItemUnitType === "count"
                    ? "Price per unit (₹)"
                    : "Price per kg (₹)"
                }
                keyboardType="decimal-pad"
                value={newItemPrice}
                onChangeText={setNewItemPrice}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddItem}
              >
                <Text style={styles.saveButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    gap: 8,
  },
  activeTab: {
    backgroundColor: "#4a6da7",
  },
  tabText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6c757d",
  },
  activeTabText: {
    color: "white",
  },
  bulkActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  bulkActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
    gap: 8,
  },
  deleteBulkButton: {
    backgroundColor: "#dc3545",
    borderColor: "#dc3545",
  },
  bulkActionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#495057",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    margin: 16,
    padding: 16,
    borderRadius: 8,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addItemButton: {
    backgroundColor: "#28a745",
  },
  addButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  listContent: {
    padding: 16,
  },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "white",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  checkbox: {
    marginRight: 12,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
    flexDirection: "column",
  },
  itemMainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  itemNameContainer: {
    flex: 1,
    marginRight: 12,
    justifyContent: "center",
    minHeight: 24, // Ensures consistent height even when empty
  },
  itemName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    flexShrink: 1, // Prevents the text from expanding beyond its container
  },
  itemPriceActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    flexShrink: 0, // Prevents this container from shrinking
    gap: 12,
  },
  itemDetails: {
    fontSize: 12,
    color: "#6c757d",
  },
  itemDetailsRow: {
    marginTop: 2,
  },
  priceDisplay: {
    alignItems: "center",
    minWidth: 80, // Ensures price section has stable width
    paddingHorizontal: 8,
  },
  priceText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#28a745",
  },
  priceLabel: {
    fontSize: 11,
    color: "#6c757d",
    marginTop: 2,
  },
  editPriceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 100,
  },
  editPriceInput: {
    borderWidth: 1,
    borderColor: "#4a6da7",
    borderRadius: 6,
    padding: 6,
    width: 60,
    textAlign: "center",
    fontSize: 14,
  },
  deleteButton: {
    padding: 4,
  },
  editButton: {
    padding: 4,
  },
  itemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#adb5bd",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#ced4da",
  },
  editContainer: {
    flex: 1,
  },
  editNameInput: {
    borderWidth: 1,
    borderColor: "#4a6da7",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    marginBottom: 8,
  },
  editPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
  },
  saveButton: {
    backgroundColor: "#28a745",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  saveButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#6c757d",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  cancelButtonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 12,
    width: "100%",
    maxWidth: 400,
  },
  modalHeader: {
    padding: 20,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  modalBody: {
    padding: 20,
  },
  modalInputContainer: {
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
  },
  itemTypeContainer: {
    flexDirection: "row",
    gap: 8,
  },
  itemTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
    alignItems: "center",
  },
  itemTypeButtonActive: {
    backgroundColor: "#4a6da7",
    borderColor: "#4a6da7",
  },
  itemTypeButtonText: {
    fontSize: 14,
    color: "#495057",
  },
  itemTypeButtonTextActive: {
    color: "white",
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
});
