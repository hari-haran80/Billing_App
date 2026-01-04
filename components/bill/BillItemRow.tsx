// components/bill/BillItemRow.tsx - UPDATED
import { useTheme } from '@/constants/ThemeContext';
import { Picker } from '@react-native-picker/picker';
import React from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface BillItemRowProps {
  index: number;
  item: any;
  availableItems: any[];
  weightMode: 'normal' | 'L';
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

  const handleWeightChange = (value: string) => {
    onUpdate({ weight: value });
  };

  const handleQuantityChange = (value: string) => {
    onUpdate({ quantity: value });
  };

  const handlePriceChange = (value: string) => {
    onUpdate({ price: value });
  };

  const styles = createStyles(colors);

  // Show all items including bottles
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
          {item.unitType === 'count' && (
            <View style={[styles.categoryBadge, { backgroundColor: colors.info + '20' }]}>
              <Text style={[styles.categoryBadgeText, { color: colors.info }]}>Bottle</Text>
            </View>
          )}
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
            <Picker.Item label="Select item" value={null} color={colors.textSecondary} />
            {filteredItems.map((avItem) => (
              <Picker.Item
                key={avItem.id}
                label={`${avItem.name}${avItem.unit_type === 'count' ? ' (Bottle)' : ''} - ${avItem.unit_type === 'count' ? '₹' + (avItem.last_price_per_unit || 0) + '/each' : '₹' + (avItem.last_price_per_kg || 0) + '/kg'}`}
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
          {item.unitType === 'count' ? (
            <>
              <Text style={styles.label}>Quantity</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colors.background, 
                    borderColor: colors.info,
                    color: colors.text 
                  }]}
                  placeholder="1"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                  value={item.quantity}
                  onChangeText={handleQuantityChange}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>nos</Text>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>
                Weight (kg) {weightMode === 'L' && ' (L Mode)'}
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { 
                    backgroundColor: colors.background, 
                    borderColor: weightMode === 'L' ? colors.warning : colors.primary,
                    color: colors.text 
                  }]}
                  placeholder="0.00"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={item.weight}
                  onChangeText={handleWeightChange}
                />
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>kg</Text>
              </View>
            </>
          )}
          
          <View style={styles.inputRow}>
            <View style={styles.priceContainer}>
              <Text style={styles.label}>
                {item.unitType === 'count' ? 'Price per unit (₹)' : 'Price per kg (₹)'}
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.background, 
                  borderColor: colors.border,
                  color: colors.text 
                }]}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary}
                keyboardType="decimal-pad"
                value={item.price}
                onChangeText={handlePriceChange}
              />
            </View>
            
            <View style={styles.amountContainer}>
              <Text style={styles.label}>Amount (₹)</Text>
              <View style={[styles.amountBox, { backgroundColor: colors.success + '20' }]}>
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

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indexCircle: {
    width: 32,
    height: 32,
    backgroundColor: colors.primary,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  indexText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginRight: 12,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '600',
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
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: colors.success,
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});