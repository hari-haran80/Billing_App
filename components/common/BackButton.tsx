import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
}

export default function BackButton({
  onPress,
  color = "#4a6da7",
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        // Fallback if no history (e.g. deep link) - mostly shouldn't happen with Stack
        router.replace("/(tabs)/history");
      }
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handlePress}>
      <Icon name="arrow-back" size={24} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    padding: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
});
