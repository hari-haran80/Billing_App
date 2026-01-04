// Update the HistoryScreen component in history.tsx
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getAllBills, getDb } from '../../lib/database';

export default function HistoryScreen() {
  const router = useRouter();
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 10;

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      const db = getDb();
      if (!db) {
        setTimeout(loadBills, 500);
        return;
      }

      const billsData = await getAllBills();
      setBills(billsData || []);
      setLoading(false);
      setRefreshing(false);
    } catch (error) {
      console.error('Error loading bills:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMoreBills = async () => {
    if (loadingMore || !hasMore) return;
    
    setLoadingMore(true);
    try {
      // Simulate pagination - you can implement actual pagination with your database
      // For now, we'll just show all bills and handle infinite scroll
      setTimeout(() => {
        setPage(prev => prev + 1);
        setLoadingMore(false);
        // If we have less than pageSize items left, stop loading more
        if (bills.length < page * pageSize) {
          setHasMore(false);
        }
      }, 500);
    } catch (error) {
      console.error('Error loading more bills:', error);
      setLoadingMore(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    setHasMore(true);
    loadBills();
  };

  const handleBillPress = (billId: number) => {
    router.push(`/bill-details?billId=${billId}`);
  };

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4a6da7" />
      </View>
    );
  };

  const renderBillItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.billCard}
      onPress={() => handleBillPress(item.id)}
    >
      <View style={styles.billHeader}>
        <View>
          <Text style={styles.billCustomer}>{item.customer_name}</Text>
          <Text style={styles.billNumber}>Bill: {item.bill_number}</Text>
        </View>
        
        <View style={styles.billStatusContainer}>
          <View 
            style={[
              styles.billStatus,
              { backgroundColor: item.is_synced ? '#28a745' : '#ffc107' }
            ]}
          />
          <Text style={styles.billStatusText}>
            {item.is_synced ? 'Synced' : 'Pending'}
          </Text>
        </View>
      </View>
      
      <View style={styles.billDetails}>
        <View style={styles.billDetailItem}>
          <Icon name="calendar-today" size={16} color="#6c757d" />
          <Text style={styles.billDetailText}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.billDetailItem}>
          <Icon name="inventory" size={16} color="#6c757d" />
          <Text style={styles.billDetailText}>
            {item.item_count || 0} items
          </Text>
        </View>
        
        <View style={styles.billDetailItem}>
          <Icon name="currency-rupee" size={16} color="#6c757d" />
          <Text style={styles.billDetailText}>
            ₹{item.total_amount.toFixed(2)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.billItems} numberOfLines={1}>
        {item.items_list || 'No items'}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6da7" />
        <Text style={styles.loadingText}>Loading bills...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Bill History</Text>
        <Text style={styles.headerSubtitle}>Tap on a bill to view details</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Total Bills</Text>
          <Text style={styles.statValue}>{bills.length}</Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Synced</Text>
          <Text style={[styles.statValue, { color: '#28a745' }]}>
            {bills.filter(b => b.is_synced).length}
          </Text>
        </View>
        
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Pending</Text>
          <Text style={[styles.statValue, { color: '#ffc107' }]}>
            {bills.filter(b => !b.is_synced).length}
          </Text>
        </View>
      </View>

      {/* Bills List with Pagination */}
      <FlatList
        data={bills.slice(0, page * pageSize)}
        renderItem={renderBillItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#16a085']}
            tintColor="#16a085"
          />
        }
        onEndReached={loadMoreBills}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Icon name="receipt" size={64} color="#ddd" />
            <Text style={styles.emptyStateText}>No bills found</Text>
            <Text style={styles.emptyStateSubtext}>
              Create your first bill in the New Bill tab
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
  header: {
    padding: 20,
    backgroundColor: '#4a6da7',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 12,
    color: '#6c757d',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  listContent: {
    padding: 16,
  },
  billCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 12,
  },
  billCustomer: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  billNumber: {
    fontSize: 14,
    color: '#6c757d',
  },
  billStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  billStatus: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  billStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6c757d',
  },
  billDetails: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 16,
  },
  billDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  billDetailText: {
    fontSize: 14,
    color: '#6c757d',
  },
  billItems: {
    fontSize: 14,
    color: '#495057',
    fontStyle: 'italic',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8f9fa',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#adb5bd',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#ced4da',
  },
  footerLoader: {
    padding: 20,
    alignItems: 'center',
  },
});