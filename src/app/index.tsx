import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { getToken } from '@/lib/auth';

export default function Index() {
  useEffect(() => {
    getToken().then((token) => {
      router.replace(token ? '/home' : '/login');
    });
  }, []);
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" /></View>;
}
