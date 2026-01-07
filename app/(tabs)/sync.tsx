import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";
import { getDb } from "../../lib/database";
import {
    SyncManager,
    SyncResult,
    getApiBaseUrl,
    setApiBaseUrl,
} from "../../lib/syncManager";

const { width } = Dimensions.get("window");

// AsyncStorage keys
const STORAGE_KEYS = {
  BACKEND_URL: "backend_base_url",
};

// Define types for database query results
interface CountResult {
  count: number;
}

interface QueueCountResult {
  count: number;
}

export default function SyncScreen() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(false);
  const [backendStatus, setBackendStatus] = useState<
    "checking" | "online" | "offline"
  >("checking");
  const [syncQueueCount, setSyncQueueCount] = useState(0);
  const [syncProgress, setSyncProgress] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // New states for backend URL management
  const [backendUrl, setBackendUrl] = useState(
    "https://wnzjtvbh-8000.inc1.devtunnels.ms"
  );
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [tempBackendUrl, setTempBackendUrl] = useState("");
  const [isUrlTestLoading, setIsUrlTestLoading] = useState(false);

  useEffect(() => {
    loadUnsyncedCount();
    checkNetworkStatus();
    loadBackendUrl();

    // Set up network listener
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected || false);
    });

    return () => unsubscribe();
  }, []);

  const loadUnsyncedCount = async () => {
    try {
      const db = getDb();
      if (!db) return;

      const result = await db.getFirstAsync<CountResult>(
        "SELECT COUNT(*) as count FROM bills WHERE is_synced = 0"
      );

      if (result) {
        setUnsyncedCount(result.count || 0);
      }

      const queueResult = await db.getFirstAsync<QueueCountResult>(
        "SELECT COUNT(*) as count FROM sync_queue"
      );

      if (queueResult) {
        setSyncQueueCount(queueResult.count || 0);
      }
    } catch (error) {
      console.error("Error loading unsynced count:", error);
    }
  };

  const loadBackendUrl = async () => {
    try {
      // Load saved backend URL from AsyncStorage
      const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.BACKEND_URL);
      if (savedUrl) {
        setBackendUrl(savedUrl);
        // Update SyncManager with the saved URL
        setApiBaseUrl(savedUrl);
      }
      // Check backend status with the current URL
      checkBackendStatus();
    } catch (error) {
      console.error("Error loading backend URL:", error);
    }
  };

  const saveBackendUrl = async (url: string) => {
    try {
      // Validate URL format
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        Alert.alert(
          "Invalid URL",
          "Please enter a valid URL starting with http:// or https://"
        );
        return false;
      }

      // Remove trailing slash if present
      const cleanUrl = url.replace(/\/$/, "");

      // Save to AsyncStorage
      await AsyncStorage.setItem(STORAGE_KEYS.BACKEND_URL, cleanUrl);

      // Update state and SyncManager
      setBackendUrl(cleanUrl);
      setApiBaseUrl(cleanUrl);

      // Test the new URL
      checkBackendStatus();

      return true;
    } catch (error) {
      console.error("Error saving backend URL:", error);
      Alert.alert("Error", "Failed to save backend URL");
      return false;
    }
  };

  const checkNetworkStatus = async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected || false);
  };

  const checkBackendStatus = async () => {
    try {
      setBackendStatus("checking");

      // Use the current backend URL
      const testUrl = `${getApiBaseUrl()}/api/sync-status/`;

      // Create AbortController for timeout functionality
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(testUrl, {
        method: "GET",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        setBackendStatus("online");
      } else {
        setBackendStatus("offline");
      }
    } catch (error) {
      console.error("Backend check error:", error);
      setBackendStatus("offline");
    }
  };

  const handleSync = async () => {
    if (unsyncedCount === 0) {
      Alert.alert("No Data to Sync", "All bills are already synced!");
      return;
    }

    if (!isOnline) {
      Alert.alert(
        "No Internet",
        "Please connect to the internet to sync data."
      );
      return;
    }

    if (backendStatus === "offline") {
      Alert.alert("Server Offline", "Backend server is currently unavailable.");
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);

    const progressInterval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + 10;
      });
    }, 300);

    try {
      const result = await SyncManager.syncBills();
      setSyncResult(result);

      clearInterval(progressInterval);
      setSyncProgress(100);

      if (result.success) {
        Alert.alert(
          "✅ Success",
          `Synced ${result.syncedBills} bills successfully!`
        );
      } else {
        Alert.alert("⚠️ Sync Partial", result.message);
      }

      loadUnsyncedCount();
      checkBackendStatus();

      setTimeout(() => setSyncProgress(0), 2000);
    } catch (error) {
      console.error("Sync error:", error);
      Alert.alert("❌ Error", "Failed to sync bills. Please try again.");
    } finally {
      setIsSyncing(false);
      clearInterval(progressInterval);
    }
  };

  const handleTestSync = async () => {
    try {
      Alert.alert("Test Sync", "Sending test bill to backend...");

      const sampleBill: any = {};
      sampleBill["billNumber"] = `TEST-${Date.now()}`;
      sampleBill["customerName"] = "Test Customer";
      sampleBill["customerPhone"] = "1234567890";
      sampleBill["totalAmount"] = 100.0;
      sampleBill["date"] = new Date().toISOString();
      sampleBill["items"] = [
        {
          itemName: "Copper Wire",
          unitType: "weight",
          originalWeight: 10.0,
          lWeight: 0,
          reducedWeight: 0,
          quantity: 1,
          finalWeight: 10.0,
          weightMode: "normal",
          pricePerKg: 50.0,
          pricePerUnit: 0.0,
          amount: 500.0,
        },
      ];

      // Create AbortController for timeout functionality
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${getApiBaseUrl()}/api/sync-bill/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sampleBill),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      Alert.alert(
        response.ok ? "✅ Test Success" : "❌ Test Failed",
        `Status: ${response.status}\n${responseText.substring(0, 200)}`
      );
    } catch (error: any) {
      console.error("Test error:", error);
      Alert.alert("❌ Test Error", error.message);
    }
  };

  const handleTestAPI = async () => {
    setIsUrlTestLoading(true);
    try {
      await checkBackendStatus();
      if (backendStatus === "online") {
        Alert.alert(
          "✅ API Test",
          `Backend server is online and responding!\n\nURL: ${getApiBaseUrl()}`
        );
      } else {
        Alert.alert(
          "❌ API Test",
          `Backend server is offline or unreachable\n\nURL: ${getApiBaseUrl()}`
        );
      }
    } finally {
      setIsUrlTestLoading(false);
    }
  };

  const handleTestSpecificUrl = async (url: string) => {
    setIsUrlTestLoading(true);
    try {
      // Create AbortController for timeout functionality
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${url}/api/sync-status/`, {
        method: "GET",
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        Alert.alert(
          "✅ Connection Successful",
          `Server at ${url} is responding correctly.`
        );
        return true;
      } else {
        Alert.alert(
          "⚠️ Connection Issue",
          `Server at ${url} responded with status: ${response.status}`
        );
        return false;
      }
    } catch (error: any) {
      Alert.alert(
        "❌ Connection Failed",
        `Failed to connect to ${url}\n\nError: ${error.message}`
      );
      return false;
    } finally {
      setIsUrlTestLoading(false);
    }
  };

  const handleResetDatabase = async () => {
    Alert.alert(
      "⚠️ Reset Database",
      "This will delete ALL local data and reset the database to initial state. This action cannot be undone!\n\nAre you absolutely sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Reset Everything",
          style: "destructive",
          onPress: async () => {
            try {
              const { resetDatabase } = await import("../../lib/database");
              await resetDatabase();
              Alert.alert("✅ Success", "Database reset successfully");
              loadUnsyncedCount();
            } catch (error) {
              console.error("Reset error:", error);
              Alert.alert("❌ Error", "Failed to reset database");
            }
          },
        },
      ]
    );
  };

  const handleClearSyncData = async () => {
    Alert.alert(
      "Clear Sync Status",
      "This will mark all bills as unsynced and clear sync history. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          onPress: async () => {
            try {
              await SyncManager.clearSyncData();
              Alert.alert("Success", "Sync data cleared");
              loadUnsyncedCount();
            } catch (error) {
              Alert.alert("Error", "Failed to clear sync data");
            }
          },
        },
      ]
    );
  };

  const handleResetBackendUrl = async () => {
    Alert.alert("Reset Backend URL", "Reset to default backend URL?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reset",
        onPress: async () => {
          const defaultUrl = "https://wnzjtvbh-8000.inc1.devtunnels.ms";
          await saveBackendUrl(defaultUrl);
          Alert.alert("✅ Success", "Backend URL reset to default");
        },
      },
    ]);
  };

  const openUrlEditor = () => {
    setTempBackendUrl(backendUrl);
    setIsEditingUrl(true);
  };

  const closeUrlEditor = () => {
    setIsEditingUrl(false);
    setTempBackendUrl("");
  };

  const saveUrl = async () => {
    if (!tempBackendUrl.trim()) {
      Alert.alert("Error", "Please enter a backend URL");
      return;
    }

    const success = await saveBackendUrl(tempBackendUrl.trim());
    if (success) {
      Alert.alert("✅ Success", "Backend URL updated successfully");
      closeUrlEditor();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "#10b981";
      case "offline":
        return "#ef4444";
      case "checking":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const renderStatusBadge = (label: string, value: any, color: string) => (
    <View style={styles.statusBadge}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={styles.statusLabel}>{label}: </Text>
      <Text style={[styles.statusValue, { color }]}>{value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#3b82f6" barStyle="light-content" />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>Cloud Sync</Text>
              <Text style={styles.headerSubtitle}>
                Upload bills to online database
              </Text>
            </View>
            <View style={styles.headerIcon}>
              <Icon name="cloud-upload" size={28} color="white" />
            </View>
          </View>

          {/* Status Row */}
          <View style={styles.statusRow}>
            {renderStatusBadge("Pending", `${unsyncedCount} bills`, "#f59e0b")}
            {renderStatusBadge(
              "Online",
              isOnline ? "Yes" : "No",
              isOnline ? "#10b981" : "#ef4444"
            )}
            {renderStatusBadge(
              "Server",
              backendStatus,
              getStatusColor(backendStatus)
            )}
          </View>
        </View>

        {/* Backend URL Display Card */}
        <View style={styles.urlCard}>
          <View style={styles.urlHeader}>
            <View style={styles.urlIconContainer}>
              <Icon name="dns" size={20} color="#3b82f6" />
            </View>
            <View style={styles.urlInfo}>
              <Text style={styles.urlLabel}>Backend Server</Text>
              <Text style={styles.urlValue} numberOfLines={2}>
                {backendUrl}
              </Text>
            </View>
            <TouchableOpacity
              onPress={openUrlEditor}
              style={styles.urlEditButton}
            >
              <Icon name="edit" size={18} color="#3b82f6" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={handleTestAPI}
            style={styles.urlTestButton}
            disabled={isUrlTestLoading}
          >
            {isUrlTestLoading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Icon name="wifi" size={16} color="white" />
                <Text style={styles.urlTestButtonText}>Test Connection</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Sync Progress Card */}
        {(isSyncing || syncProgress > 0) && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size={24} color="#3b82f6" />
              <Text style={styles.progressTitle}>Syncing in Progress...</Text>
            </View>

            <View style={styles.progressContainer}>
              <View style={styles.progressInfo}>
                <Text style={styles.progressLabel}>Progress</Text>
                <Text style={styles.progressPercent}>{syncProgress}%</Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${syncProgress}%` }]}
                />
              </View>
            </View>

            <Text style={styles.progressSubtext}>
              {syncResult?.syncedBills || 0} bills synced •{" "}
              {syncResult?.failedBills || 0} failed
            </Text>
          </View>
        )}

        {/* Sync Action Card */}
        <View style={styles.syncCard}>
          <View style={styles.syncIconContainer}>
            <Icon name="sync" size={40} color="#3b82f6" />
          </View>
          <Text style={styles.syncTitle}>
            {unsyncedCount === 0 ? "All Synced! 🎉" : "Sync Pending Bills"}
          </Text>
          <Text style={styles.syncDescription}>
            {unsyncedCount === 0
              ? "All your data is backed up in the cloud"
              : `You have ${unsyncedCount} bill${unsyncedCount > 1 ? "s" : ""} waiting to sync`}
          </Text>

          <TouchableOpacity
            onPress={handleSync}
            disabled={
              isSyncing ||
              unsyncedCount === 0 ||
              !isOnline ||
              backendStatus === "offline"
            }
            style={[
              styles.syncButton,
              (isSyncing ||
                unsyncedCount === 0 ||
                !isOnline ||
                backendStatus === "offline") &&
                styles.syncButtonDisabled,
            ]}
            activeOpacity={0.9}
          >
            {isSyncing ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={styles.syncButtonText}>Syncing...</Text>
              </>
            ) : (
              <>
                <Icon name="cloud-upload" size={24} color="white" />
                <Text style={styles.syncButtonText}>
                  {unsyncedCount === 0
                    ? "All Synced"
                    : `Sync ${unsyncedCount} Bill${unsyncedCount > 1 ? "s" : ""}`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {(!isOnline || backendStatus === "offline") && (
            <View style={styles.warningBox}>
              <View style={styles.warningHeader}>
                <Icon name="wifi-off" size={20} color="#ef4444" />
                <Text style={styles.warningTitle}>
                  {!isOnline
                    ? "No internet connection"
                    : "Backend server offline"}
                </Text>
              </View>
              <Text style={styles.warningText}>
                Connect to internet and ensure server is running to sync data
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={handleTestSync}
              style={styles.testSyncButton}
              activeOpacity={0.9}
            >
              <Icon name="send" size={20} color="white" />
              <Text style={styles.actionButtonText}>Test Sync</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowAdvanced(!showAdvanced)}
              style={styles.advancedButton}
              activeOpacity={0.9}
            >
              <Icon name="settings" size={20} color="white" />
              <Text style={styles.actionButtonText}>Advanced</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Last Sync Result */}
        {syncResult && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Icon name="history" size={24} color="#3b82f6" />
              <Text style={styles.resultTitle}>Last Sync Result</Text>
            </View>

            <View style={styles.resultStats}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Synced Bills</Text>
                <Text style={styles.statValueSuccess}>
                  {syncResult.syncedBills}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Failed Bills</Text>
                <Text style={styles.statValueError}>
                  {syncResult.failedBills}
                </Text>
              </View>
            </View>

            <View style={styles.resultMessageBox}>
              <Text
                style={[
                  styles.resultStatus,
                  syncResult.success ? styles.successText : styles.errorText,
                ]}
              >
                {syncResult.success ? "✅ Success" : "⚠️ Partial Success"}
              </Text>
              <Text style={styles.resultMessage}>{syncResult.message}</Text>
            </View>
          </View>
        )}

        {/* Advanced Settings */}
        {showAdvanced && (
          <View style={styles.advancedSection}>
            <Text style={styles.advancedTitle}>Advanced Settings</Text>

            <View style={styles.statsContainer}>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Unsynced Bills:</Text>
                <Text style={styles.statValue}>{unsyncedCount}</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Sync Queue:</Text>
                <Text style={styles.statValue}>{syncQueueCount}</Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Network:</Text>
                <Text
                  style={[
                    styles.statValue,
                    isOnline ? styles.onlineText : styles.offlineText,
                  ]}
                >
                  {isOnline ? "Connected" : "Disconnected"}
                </Text>
              </View>

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>Backend:</Text>
                <View style={styles.statusIndicator}>
                  <View
                    style={[
                      styles.statusCircle,
                      { backgroundColor: getStatusColor(backendStatus) },
                    ]}
                  />
                  <Text style={styles.statusText}>{backendStatus}</Text>
                </View>
              </View>
            </View>

            <View style={styles.advancedActions}>
              <TouchableOpacity
                onPress={handleClearSyncData}
                style={styles.clearSyncButton}
              >
                <Icon name="refresh" size={18} color="#d97706" />
                <Text style={styles.clearSyncText}>Reset Sync Status</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResetBackendUrl}
                style={styles.resetUrlButton}
              >
                <Icon name="restore" size={18} color="#3b82f6" />
                <Text style={styles.resetUrlText}>Reset Backend URL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResetDatabase}
                style={styles.resetDbButton}
              >
                <Icon name="delete-forever" size={18} color="#dc2626" />
                <Text style={styles.resetDbText}>Reset Database</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Information Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Icon name="info" size={24} color="#3b82f6" />
            <Text style={styles.infoTitle}>How Sync Works</Text>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoItem}>
              <Icon name="check-circle" size={18} color="#10b981" />
              <Text style={styles.infoText}>
                Bills are saved locally first and work offline
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Icon name="check-circle" size={18} color="#10b981" />
              <Text style={styles.infoText}>
                Auto-sync when you have internet connection
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Icon name="check-circle" size={18} color="#10b981" />
              <Text style={styles.infoText}>
                Failed syncs retry automatically on next attempt
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Icon name="check-circle" size={18} color="#10b981" />
              <Text style={styles.infoText}>
                Backend URL can be changed for different servers
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* URL Editor Modal */}
      <Modal
        visible={isEditingUrl}
        transparent
        animationType="slide"
        onRequestClose={closeUrlEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Icon name="edit" size={24} color="white" />
              <Text style={styles.modalTitle}>Edit Backend URL</Text>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalLabel}>
                Enter the backend server URL
              </Text>

              <TextInput
                style={styles.urlInput}
                value={tempBackendUrl}
                onChangeText={setTempBackendUrl}
                placeholder="https://your-server.com"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                autoFocus
              />

              <View style={styles.urlExamples}>
                <Text style={styles.urlExamplesTitle}>Examples:</Text>
                <Text style={styles.urlExample}>• https://localhost:8000</Text>
                <Text style={styles.urlExample}>
                  • http://192.168.1.100:8000
                </Text>
                <Text style={styles.urlExample}>• https://your-domain.com</Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                onPress={closeUrlEditor}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleTestSpecificUrl(tempBackendUrl)}
                style={styles.modalTestButton}
                disabled={isUrlTestLoading}
              >
                {isUrlTestLoading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.modalTestText}>Test</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={saveUrl}
                style={styles.modalSaveButton}
                disabled={!tempBackendUrl.trim()}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },

  // Header Styles
  header: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
  },
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
  },

  // Status Badge
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusLabel: {
    fontSize: 12,
    color: "#374151",
  },
  statusValue: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Backend URL Card
  urlCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  urlHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  urlIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: "#eff6ff",
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  urlInfo: {
    flex: 1,
  },
  urlLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 2,
  },
  urlValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "500",
  },
  urlEditButton: {
    padding: 8,
  },
  urlTestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  urlTestButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },

  // Progress Card
  progressCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginLeft: 12,
  },
  progressContainer: {
    marginBottom: 8,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: "#6b7280",
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3b82f6",
  },
  progressBar: {
    height: 8,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#3b82f6",
    borderRadius: 4,
  },
  progressSubtext: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 8,
  },

  // Sync Card
  syncCard: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  syncIconContainer: {
    width: 80,
    height: 80,
    backgroundColor: "#e0e7ff",
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  syncTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
    textAlign: "center",
  },
  syncDescription: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: "100%",
    marginBottom: 16,
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  syncButtonDisabled: {
    backgroundColor: "#d1d5db",
    shadowColor: "transparent",
  },
  syncButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginLeft: 12,
  },

  // Warning Box
  warningBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 16,
    width: "100%",
  },
  warningHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#dc2626",
    marginLeft: 8,
  },
  warningText: {
    fontSize: 14,
    color: "#b91c1c",
    lineHeight: 20,
  },

  // Quick Actions
  actionsSection: {
    marginHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  testSyncButton: {
    flex: 1,
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    marginRight: 8,
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  advancedButton: {
    flex: 1,
    backgroundColor: "#6b7280",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    marginLeft: 8,
    shadowColor: "#6b7280",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  actionButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },

  // Last Sync Result
  resultCard: {
    backgroundColor: "#eff6ff",
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e40af",
    marginLeft: 12,
  },
  resultStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statLabel: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  statValueSuccess: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#10b981",
  },
  statValueError: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#ef4444",
  },
  resultMessageBox: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  resultStatus: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  successText: {
    color: "#10b981",
  },
  errorText: {
    color: "#ef4444",
  },
  resultMessage: {
    fontSize: 14,
    color: "#374151",
    lineHeight: 20,
  },

  // Advanced Section
  advancedSection: {
    backgroundColor: "white",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  advancedTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 20,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },

  statValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1f2937",
  },
  onlineText: {
    color: "#10b981",
  },
  offlineText: {
    color: "#ef4444",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusCircle: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 15,
    color: "#1f2937",
  },
  advancedActions: {
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    gap: 10,
  },
  clearSyncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
    borderRadius: 8,
    paddingVertical: 12,
  },
  clearSyncText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#92400e",
    marginLeft: 8,
  },
  resetUrlButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#93c5fd",
    borderRadius: 8,
    paddingVertical: 12,
  },
  resetUrlText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#1e40af",
    marginLeft: 8,
  },
  resetDbButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#f87171",
    borderRadius: 8,
    paddingVertical: 12,
  },
  resetDbText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#991b1b",
    marginLeft: 8,
  },

  // Information Card
  infoCard: {
    backgroundColor: "#eff6ff",
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1e40af",
    marginLeft: 12,
  },
  infoList: {
    gap: 12,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  infoText: {
    fontSize: 15,
    color: "#1e40af",
    marginLeft: 12,
    flex: 1,
    lineHeight: 22,
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  modalHeader: {
    backgroundColor: "#3b82f6",
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    marginLeft: 12,
  },
  modalBody: {
    padding: 24,
  },
  modalLabel: {
    fontSize: 16,
    color: "#374151",
    marginBottom: 16,
    lineHeight: 22,
  },
  urlInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
    marginBottom: 20,
  },
  urlExamples: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    padding: 12,
  },
  urlExamplesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  urlExample: {
    fontSize: 13,
    color: "#6b7280",
    marginLeft: 8,
    marginBottom: 4,
  },
  modalFooter: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6b7280",
  },
  modalTestButton: {
    flex: 1,
    backgroundColor: "#10b981",
    paddingVertical: 16,
    alignItems: "center",
  },
  modalTestText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: "#3b82f6",
    paddingVertical: 16,
    alignItems: "center",
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
  },
});
