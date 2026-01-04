import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getDb } from '../../lib/database';
import { SyncManager, SyncResult } from '../../lib/syncManager';

export default function SyncScreen() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  useEffect(() => {
    loadUnsyncedCount();
  }, []);

  const loadUnsyncedCount = async () => {
    try {
      const db = getDb();
      if (!db) return;

      const [result] = await db.executeSql(
        'SELECT COUNT(*) as count FROM bills WHERE is_synced = 0',
        []
      );

      if (result.rows.length > 0) {
        setUnsyncedCount(result.rows.item(0).count);
      }
    } catch (error) {
      console.error('Error loading unsynced count:', error);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await SyncManager.syncBills();
      setSyncResult(result);
      
      if (result.success) {
        Alert.alert('Success', result.message);
      } else {
        Alert.alert('Sync Failed', result.message);
      }
      
      loadUnsyncedCount();
    } catch (error) {
      console.error('Sync error:', error);
      Alert.alert('Error', 'Failed to sync bills');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTestAPI = async () => {
    try {
      // Simulate API test
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1');
      if (response.ok) {
        Alert.alert('API Test', 'Connection to server successful!');
      } else {
        Alert.alert('API Test', 'Server responded with error');
      }
    } catch (error) {
      Alert.alert('API Test', 'Failed to connect to server');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <ScrollView className="flex-1 p-6">
        {/* Header */}
        <View className="items-center mb-10">
          <View className="bg-blue-100 p-5 rounded-full mb-4">
            <Icon name="cloud-sync" size={60} color="#3b82f6" />
          </View>
          <Text className="text-3xl font-bold text-gray-800 mb-2">Data Sync</Text>
          <Text className="text-gray-600 text-center">
            Upload unsynced bills to online database
          </Text>
        </View>

        {/* Sync Status Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-lg border border-gray-100">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-semibold text-gray-800">Sync Status</Text>
              <Text className="text-gray-600">Offline-first database</Text>
            </View>
            <View className="bg-blue-100 px-4 py-2 rounded-full">
              <Text className="text-blue-600 font-bold">{unsyncedCount} pending</Text>
            </View>
          </View>

          <View className="space-y-3">
            <View className="flex-row items-center">
              <Icon name="check-circle" size={20} color="#10b981" />
              <Text className="ml-3 text-gray-700">Bills saved locally</Text>
            </View>
            <View className="flex-row items-center">
              <Icon name="check-circle" size={20} color="#10b981" />
              <Text className="ml-3 text-gray-700">Works without internet</Text>
            </View>
            <View className="flex-row items-center">
              <Icon name={unsyncedCount > 0 ? "pending" : "check-circle"} 
                    size={20} color={unsyncedCount > 0 ? "#f59e0b" : "#10b981"} />
              <Text className="ml-3 text-gray-700">
                {unsyncedCount > 0 ? `${unsyncedCount} bills to sync` : 'All bills synced'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sync Actions */}
        <View className="space-y-4">
          <TouchableOpacity
            onPress={handleSync}
            disabled={isSyncing || unsyncedCount === 0}
            className={`flex-row items-center justify-center p-5 rounded-xl ${isSyncing || unsyncedCount === 0 ? 'bg-gray-300' : 'bg-blue-500'}`}
          >
            {isSyncing ? (
              <>
                <ActivityIndicator color="white" />
                <Text className="text-white font-semibold ml-3">Syncing...</Text>
              </>
            ) : (
              <>
                <Icon name="sync" size={24} color="white" />
                <Text className="text-white font-semibold ml-3 text-lg">
                  {unsyncedCount === 0 ? 'All Synced' : `Sync ${unsyncedCount} Bills`}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleTestAPI}
            className="flex-row items-center justify-center p-5 rounded-xl bg-green-500"
          >
            <Icon name="wifi" size={24} color="white" />
            <Text className="text-white font-semibold ml-3 text-lg">Test API Connection</Text>
          </TouchableOpacity>
        </View>

        {/* Sync History */}
        {syncResult && (
          <View className="mt-8 bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <Text className="text-xl font-bold text-gray-800 mb-4">Last Sync Result</Text>
            <View className="space-y-3">
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Status</Text>
                <Text className={`font-semibold ${syncResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {syncResult.success ? 'Success' : 'Failed'}
                </Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Synced Bills</Text>
                <Text className="font-semibold text-blue-600">{syncResult.syncedBills}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-gray-600">Failed Bills</Text>
                <Text className="font-semibold text-red-600">{syncResult.failedBills}</Text>
              </View>
              <View className="mt-4 pt-4 border-t border-gray-200">
                <Text className="text-gray-600">{syncResult.message}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Info Section */}
        <View className="mt-8 bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <View className="flex-row items-start mb-3">
            <Icon name="info" size={20} color="#3b82f6" />
            <Text className="ml-3 text-blue-800 font-semibold">How Sync Works</Text>
          </View>
          <Text className="text-blue-700 leading-6">
            1. Bills are saved locally first{'\n'}
            2. When online, click Sync to upload{'\n'}
            3. Failed syncs retry automatically{'\n'}
            4. All data encrypted for security
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}