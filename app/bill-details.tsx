// app/bill-details.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useLocalSearchParams, router } from 'expo-router';
import { getBillDetails } from '@/lib/database';

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
      console.error('Error loading bill details:', error);
    } finally {
      setLoading(false);
    }
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
          <TouchableOpacity 
            style={styles.backButtonHeader}
            onPress={() => router.back()}
          >
            <Icon name="arrow-back" size={24} color="#4a6da7" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bill Details</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.billHeader}>
            <View>
              <Text style={styles.billNumber}>Bill: {bill.bill_number}</Text>
              <Text style={styles.billCustomer}>{bill.customer_name}</Text>
              {bill.customer_phone && (
                <Text style={styles.billPhone}>Phone: {bill.customer_phone}</Text>
              )}
            </View>
            <Text style={styles.billAmount}>₹{bill.total_amount.toFixed(2)}</Text>
          </View>

          <View style={styles.dateSection}>
            <Icon name="calendar-today" size={18} color="#6c757d" />
            <Text style={styles.dateText}>
              {new Date(bill.date).toLocaleDateString()} • {new Date(bill.date).toLocaleTimeString()}
            </Text>
          </View>

          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Items ({bill.items?.length || 0})</Text>
            
            {bill.items?.map((item: any, index: number) => (
              <View key={index} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>
                    {item.bottle_display_name || item.item_name}
                  </Text>
                  <Text style={styles.itemAmount}>₹{item.amount.toFixed(2)}</Text>
                </View>
                
                {item.unit_type === 'count' ? (
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetail}>
                      Quantity: {item.quantity} nos × ₹{item.price_per_unit?.toFixed(2)}/each
                    </Text>
                  </View>
                ) : (
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemDetail}>
                      Weight: {item.final_weight?.toFixed(3)} kg × ₹{item.price_per_kg?.toFixed(2)}/kg
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.totalSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount</Text>
              <Text style={styles.totalValue}>₹{bill.total_amount.toFixed(2)}</Text>
            </View>
            
            <View style={styles.statusRow}>
              <Icon 
                name={bill.is_synced ? "cloud-done" : "cloud-upload"} 
                size={20} 
                color={bill.is_synced ? "#28a745" : "#ffc107"} 
              />
              <Text style={[
                styles.statusText,
                { color: bill.is_synced ? "#28a745" : "#ffc107" }
              ]}>
                {bill.is_synced ? 'Synced to server' : 'Pending sync'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    color: '#dc3545',
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: '#4a6da7',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#4a6da7',
  },
  backButtonHeader: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  billNumber: {
    fontSize: 16,
    color: '#6c757d',
    marginBottom: 4,
  },
  billCustomer: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  billPhone: {
    fontSize: 14,
    color: '#6c757d',
  },
  billAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4a6da7',
  },
  dateSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f9fa',
  },
  dateText: {
    fontSize: 14,
    color: '#6c757d',
    marginLeft: 8,
  },
  itemsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
  },
  itemCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#28a745',
  },
  itemDetails: {
    marginLeft: 8,
  },
  itemDetail: {
    fontSize: 14,
    color: '#6c757d',
  },
  lWeightNote: {
    fontSize: 12,
    color: '#ffc107',
    fontStyle: 'italic',
    marginTop: 2,
  },
  totalSection: {
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
    paddingTop: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4a6da7',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});