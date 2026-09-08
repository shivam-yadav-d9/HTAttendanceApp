import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#ff7b00",
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="attend"
        options={{
          title: "Attend",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />

      {/* <Tabs.Screen
        name="voice"
        options={{
          title: "Voice",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="mic-outline" size={size} color={color} />
          ),
        }}
      /> */}

      <Tabs.Screen
        name="LMS"
        options={{
          title: "LMS",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="clipboard-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="targets"
        options={{
          title: "Targets",
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="radio-button-on-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />

  <Tabs.Screen
  name="barcode"
  options={{
    title: "New Lead",
    tabBarIcon: ({ color, size }) => (
      <Ionicons
        name="person-add-outline"
        size={size}
        color={color}
      />
    ),
  }}
/>

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />


    </Tabs>
  );
}