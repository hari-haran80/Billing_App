// app/weight-management.tsx - NEW SCREEN
import { getWeightReduction, updateWeightReduction } from "@/lib/database";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "react-native-vector-icons/MaterialIcons";

export default function WeightManagementScreen() {
  const [reduction, setReduction] = useState("0.1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadReduction();
  }, []);

  const loadReduction = async () => {
    try {
      const reductionValue = await getWeightReduction();
      setReduction(reductionValue.toString());
      setLoading(false);
    } catch (error) {
      console.error("Error loading weight reduction:", error);
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const reductionValue = parseFloat(reduction);
    if (isNaN(reductionValue) || reductionValue < 0 || reductionValue >= 1) {
      Alert.alert(
        "Error",
        "Please enter a valid reduction value between 0 and 1 (e.g., 0.1 for 100g per kg)"
      );
      return;
    }

    setSaving(true);
    try {
      await updateWeightReduction(reductionValue);
      Alert.alert("Success", "Weight reduction setting updated successfully", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)"),
        },
      ]);
    } catch (error) {
      console.error("Error saving reduction:", error);
      Alert.alert("Error", "Failed to save weight reduction setting");
    } finally {
      setSaving(false);
    }
  };

  const calculateExamples = () => {
    const reductionValue = parseFloat(reduction) || 0.1;

    // Example 1: 1kg in normal mode
    const normal1kg = 1;
    const l1kg = normal1kg * (1 - reductionValue);

    // Example 2: 900g shown in L mode
    const l900g = 0.9;
    const normal900g = l900g / (1 - reductionValue);

    return {
      normal1kg: normal1kg.toFixed(3),
      l1kg: l1kg.toFixed(3),
      l900g: l900g.toFixed(3),
      normal900g: normal900g.toFixed(3),
    };
  };

  const examples = calculateExamples();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Weight Management</Text>
        <Text style={styles.headerSubtitle}>
          Configure L mode weight reduction
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Icon name="scale" size={28} color="#4a6da7" />
          <Text style={styles.cardTitle}>L Mode Weight Reduction</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Reduction per kg (0 to 1)</Text>
          <Text style={styles.description}>
            Enter the reduction factor for L mode. Example: 0.1 means 100g
            reduction per 1kg (10%)
          </Text>

          <TextInput
            style={styles.input}
            value={reduction}
            onChangeText={setReduction}
            keyboardType="decimal-pad"
            placeholder="0.1"
          />

          <View style={styles.infoRow}>
            <Icon name="info" size={16} color="#17a2b8" />
            <Text style={styles.infoText}>
              Current setting: {reduction} ({parseFloat(reduction) * 100}%)
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <Text style={styles.saveButtonText}>Saving...</Text>
          ) : (
            <>
              <Icon name="save" size={20} color="white" />
              <Text style={styles.saveButtonText}>Save Settings</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Examples */}
      <View style={styles.examplesCard}>
        <Text style={styles.examplesTitle}>Examples with current setting</Text>

        <View style={styles.exampleRow}>
          <View style={styles.exampleColumn}>
            <Text style={styles.exampleLabel}>Normal Mode (1kg)</Text>
            <View style={styles.exampleValue}>
              <Text style={styles.exampleNumber}>1.000</Text>
              <Text style={styles.exampleUnit}>kg</Text>
            </View>
          </View>

          <Icon name="arrow-forward" size={24} color="#6c757d" />

          <View style={styles.exampleColumn}>
            <Text style={styles.exampleLabel}>L Mode Shows</Text>
            <View style={styles.exampleValue}>
              <Text style={styles.exampleNumber}>{examples.l1kg}</Text>
              <Text style={styles.exampleUnit}>kg</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.exampleRow}>
          <View style={styles.exampleColumn}>
            <Text style={styles.exampleLabel}>L Mode (900g)</Text>
            <View style={styles.exampleValue}>
              <Text style={styles.exampleNumber}>0.900</Text>
              <Text style={styles.exampleUnit}>kg</Text>
            </View>
          </View>

          <Icon name="arrow-forward" size={24} color="#6c757d" />

          <View style={styles.exampleColumn}>
            <Text style={styles.exampleLabel}>Actual Weight</Text>
            <View style={styles.exampleValue}>
              <Text style={styles.exampleNumber}>{examples.normal900g}</Text>
              <Text style={styles.exampleUnit}>kg</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How L Mode Works</Text>
        <Text style={styles.infoText}>
          • In L mode, the weight machine shows reduced weight{"\n"}• For
          example, if reduction is 0.1 (10%):{"\n"}• Machine shows 900g for
          actual 1kg weight{"\n"}• Database stores BOTH actual and L weight
          values{"\n"}• Customer receipt shows only the L weight{"\n"}• Admin
          can see both values in reports
        </Text>
      </View>
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
  card: {
    backgroundColor: "white",
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2c3e50",
    marginLeft: 12,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: "600",
    color: "#495057",
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 16,
    lineHeight: 20,
  },
  input: {
    borderWidth: 2,
    borderColor: "#4a6da7",
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    textAlign: "center",
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#17a2b8",
  },
  saveButton: {
    backgroundColor: "#28a745",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 8,
    gap: 12,
  },
  saveButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  examplesCard: {
    backgroundColor: "white",
    margin: 16,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  examplesTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#2c3e50",
    marginBottom: 20,
    textAlign: "center",
  },
  exampleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  exampleColumn: {
    flex: 1,
    alignItems: "center",
  },
  exampleLabel: {
    fontSize: 14,
    color: "#6c757d",
    marginBottom: 8,
    textAlign: "center",
  },
  exampleValue: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  exampleNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#4a6da7",
  },
  exampleUnit: {
    fontSize: 14,
    color: "#6c757d",
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: "#e9ecef",
    marginVertical: 20,
  },
  infoCard: {
    backgroundColor: "#e3f2fd",
    margin: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#bbdefb",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1565c0",
    marginBottom: 12,
  },
});
