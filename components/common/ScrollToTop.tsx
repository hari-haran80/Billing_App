import { useTheme } from "@/constants/ThemeContext";
import React, { useEffect, useMemo, useRef } from "react";
import {
    Animated,
    StyleSheet,
    TouchableOpacity
} from "react-native";
import Icon from "react-native-vector-icons/MaterialIcons";

interface ScrollToTopProps {
  onPress: () => void;
  visible: boolean;
}

export const ScrollToTop = ({ onPress, visible }: ScrollToTopProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible && (fadeAnim as any)._value === 0) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onPress}
      >
        <Icon name="keyboard-arrow-up" size={32} color="white" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      position: "absolute",
      bottom: 20,
      right: 20,
      zIndex: 1000,
    },
    button: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: "center",
      alignItems: "center",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
  });
