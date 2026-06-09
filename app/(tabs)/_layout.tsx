import { Tabs } from 'expo-router';
import { Compass, Map, Search, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0b1220',
          borderTopColor: '#1f2937',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Passport',
          tabBarIcon: ({ color }) => <Compass color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="passport"
        options={{
          title: 'Map',
          tabBarIcon: ({ color }) => <Map color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
          tabBarIcon: ({ color }) => <Search color={color} size={20} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User color={color} size={20} />,
        }}
      />
    </Tabs>
  );
}
