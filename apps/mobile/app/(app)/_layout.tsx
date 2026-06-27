import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import { Colors } from '../../src/styles/colors';
import { flush } from '../../src/services/offline-queue.service';
import { apiClient } from '../../src/lib/api';

export default function AppLayout() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void flush(apiClient);
      }
    });
    return unsubscribe;
  }, []);

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
