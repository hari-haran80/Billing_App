import { Tabs } from "expo-router";
import Icon from "react-native-vector-icons/MaterialIcons";

// Define the type for tabBarIcon props
type TabBarIconProps = {
  color: string;
  size: number;
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4a6da7",
        tabBarInactiveTintColor: "#7f8c8d",
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e9ecef",
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
        headerStyle: {
          backgroundColor: "#4a6da7",
        },
        headerTintColor: "#ffffff",
        headerTitleStyle: {
          fontWeight: "bold",
          fontSize: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Icon name="dashboard" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="create-bill"
        options={{
          title: "New Bill",
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Icon name="receipt" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Icon name="history" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="items-management"
        options={{
          title: "Items",
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Icon name="inventory" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Icon name="assessment" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: "Sync",
          tabBarIcon: ({ color, size }: TabBarIconProps) => (
            <Icon name="cloud-sync" size={size} color={color} />
          ),
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
