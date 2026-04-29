import { Tabs } from 'expo-router';
import { Colors } from '../../src/styles/colors';

export default function AppLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary600,
        tabBarInactiveTintColor: Colors.neutral400,
        tabBarStyle: { backgroundColor: Colors.white },
        headerStyle: { backgroundColor: Colors.primary700 },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'My Permits', tabBarLabel: 'Permits' }}
      />
    </Tabs>
  );
}
