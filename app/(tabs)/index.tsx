// app/index.tsx - UPDATED DASHBOARD
import {
    getAllBills,
    getAllItems,
    getBottleTypes,
    isDbInitialized,
} from "@/lib/database";
import { Link, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function DashboardScreen() {
  const [stats, setStats] = useState({
    totalBills: 0,
    totalAmount: 0,
    totalItems: 0,
    totalBottles: 0,
    todayBills: 0,
    todayAmount: 0,
    pendingSync: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentBills, setRecentBills] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadDashboardData();

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      loadData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Wait for database to be initialized
      const checkDbInit = () => {
        return new Promise<void>((resolve) => {
          const interval = setInterval(() => {
            if (isDbInitialized()) {
              clearInterval(interval);
              resolve();
            }
          }, 500);
        });
      };

      await checkDbInit();
      await loadData();
    } catch (error) {
      console.error("Error loading dashboard data:", error);
      setLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const bills = await getAllBills();
      const items = await getAllItems();
      const bottleTypes = await getBottleTypes();

      // Calculate today's date
      const today = new Date();
      const todayString = today.toISOString().split("T")[0];

      // Filter today's bills
      const todayBills =
        bills?.filter((bill) => {
          const billDate = new Date(bill.date).toISOString().split("T")[0];
          return billDate === todayString;
        }) || [];

      // Calculate stats
      const totalBills = bills?.length || 0;
      const totalAmount =
        bills?.reduce((sum, bill) => sum + (bill.total_amount || 0), 0) || 0;
      const totalItems =
        items?.filter((item) => item.unit_type !== "count").length || 0;
      const totalBottles = bottleTypes?.length || 0;
      const todayBillsCount = todayBills.length;
      const todayAmount = todayBills.reduce(
        (sum, bill) => sum + (bill.total_amount || 0),
        0
      );
      const pendingSync = bills?.filter((b) => !b.is_synced).length || 0;

      setStats({
        totalBills,
        totalAmount,
        totalItems,
        totalBottles,
        todayBills: todayBillsCount,
        todayAmount,
        pendingSync,
      });

      // Get recent bills (last 5)
      const recent = bills?.slice(0, 5) || [];
      setRecentBills(recent);

      setLoading(false);
    } catch (error) {
      console.error("Error loading data:", error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a6da7" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadDashboardData}
            colors={["#16a085"]}
            tintColor="#16a085"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Icon name="dashboard" size={28} color="white" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Dashboard</Text>
            <Text style={styles.headerSubtitle}>Scrap Billing System</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <Link href="/create-bill" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#e3f2fd" }]}
                >
                  <Icon name="receipt" size={28} color="#1976d2" />
                </View>
                <Text style={styles.actionTitle}>New Bill</Text>
                <Text style={styles.actionSubtitle}>Create bill</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/history" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#e8f5e9" }]}
                >
                  <Icon name="history" size={28} color="#388e3c" />
                </View>
                <Text style={styles.actionTitle}>History</Text>
                <Text style={styles.actionSubtitle}>View bills</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/items-management" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#f3e5f5" }]}
                >
                  <Icon name="inventory" size={28} color="#7b1fa2" />
                </View>
                <Text style={styles.actionTitle}>Items</Text>
                <Text style={styles.actionSubtitle}>Manage items</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/weight-management" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#fff3e0" }]}
                >
                  <Icon name="scale" size={28} color="#f57c00" />
                </View>
                <Text style={styles.actionTitle}>Weight</Text>
                <Text style={styles.actionSubtitle}>L mode settings</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/reports" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#e1f5fe" }]}
                >
                  <Icon name="assessment" size={28} color="#0288d1" />
                </View>
                <Text style={styles.actionTitle}>Reports</Text>
                <Text style={styles.actionSubtitle}>View reports</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/sync" asChild>
              <TouchableOpacity style={styles.actionCard}>
                <View
                  style={[styles.actionIcon, { backgroundColor: "#fce4ec" }]}
                >
                  <Icon name="cloud-sync" size={28} color="#c2185b" />
                </View>
                <Text style={styles.actionTitle}>Sync</Text>
                <Text style={styles.actionSubtitle}>Sync data</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalBills}</Text>
              <Text style={styles.statLabel}>Total Bills</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                ₹{stats.totalAmount.toLocaleString()}
              </Text>
              <Text style={styles.statLabel}>Total Amount</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.todayBills}</Text>
              <Text style={styles.statLabel}>Today</Text>
              <Text style={styles.statSubtext}>
                ₹{stats.todayAmount.toFixed(2)}
              </Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.pendingSync}</Text>
              <Text style={styles.statLabel}>Pending Sync</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Bills</Text>
            <Link href="/history" asChild>
              <TouchableOpacity>
                <Text style={styles.viewAllText}>View All</Text>
              </TouchableOpacity>
            </Link>
          </View>

          {recentBills.length > 0 ? (
            <View style={styles.recentCard}>
              {recentBills.map((bill, index) => (
                <View key={bill.id} style={styles.recentItem}>
                  <TouchableOpacity
                    style={styles.recentItem}
                    onPress={() =>
                      router.push(`/bill-details?billId=${bill.id}`)
                    }
                  >
                    <View style={styles.recentItemLeft}>
                      <Text style={styles.recentCustomer}>
                        {bill.customer_name}
                      </Text>
                      <Text style={styles.recentBillNumber}>
                        {bill.bill_number}
                      </Text>
                    </View>
                    <View style={styles.recentItemRight}>
                      <Text style={styles.recentAmount}>
                        ₹{bill.total_amount.toFixed(2)}
                      </Text>
                      <Text style={styles.recentDate}>
                        {new Date(bill.date).toLocaleDateString("ta-IN")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Icon name="receipt" size={48} color="#ddd" />
              <Text style={styles.emptyStateText}>No bills yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Create your first bill
              </Text>
            </View>
          )}
        </View>

        {/* System Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Icon name="info" size={20} color="#4a6da7" />
            <Text style={styles.statusTitle}>System Status</Text>
          </View>
          <View style={styles.statusContent}>
            <View style={styles.statusItem}>
              <Icon name="check-circle" size={16} color="#28a745" />
              <Text style={styles.statusText}>Database: Connected</Text>
            </View>
            <View style={styles.statusItem}>
              <Icon name="check-circle" size={16} color="#28a745" />
              <Text style={styles.statusText}>Items: {stats.totalItems}</Text>
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
    backgroundColor: "#f5f7fa",
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
    backgroundColor: "#f5f7fa",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "#4a6da7",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerIcon: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.9)",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2c3e50",
  },
  viewAllText: {
    fontSize: 14,
    color: "#4a6da7",
    fontWeight: "600",
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  actionCard: {
    width: "30%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginHorizontal: "1.66%",
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    color: "#7f8c8d",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },
  statCard: {
    width: "48%",
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginHorizontal: "1%",
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 14,
    color: "#7f8c8d",
    marginBottom: 2,
  },
  statSubtext: {
    fontSize: 12,
    color: "#4a6da7",
    fontWeight: "500",
  },
  recentCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  recentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f9fa",
  },
  recentItemLeft: {
    flex: 1,
  },
  recentCustomer: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c3e50",
    marginBottom: 4,
  },
  recentBillNumber: {
    fontSize: 12,
    color: "#7f8c8d",
  },
  recentItemRight: {
    alignItems: "flex-end",
  },
  recentAmount: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#4a6da7",
    marginBottom: 4,
  },
  recentDate: {
    fontSize: 12,
    color: "#adb5bd",
  },
  emptyState: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 40,
    alignItems: "center",
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
  statusCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#2c3e50",
    marginLeft: 8,
  },
  statusContent: {
    paddingLeft: 8,
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    color: "#6c757d",
    marginLeft: 8,
  },
});
