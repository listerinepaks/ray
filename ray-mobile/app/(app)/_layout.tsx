import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/constants/theme';

export default function AppGroupLayout() {
  const { user, booting } = useAuth();

  if (booting) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.bgPrimary,
        }}>
        <ActivityIndicator color={theme.textSecondary} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bgPrimary },
        headerTintColor: theme.textSecondary,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', fontSize: 17 },
        contentStyle: { backgroundColor: theme.bgPrimary },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ title: 'Ray', headerLargeTitle: true }} />
      <Stack.Screen
        name="moment/new"
        options={{
          title: 'New moment',
          presentation: 'modal',
        }}
      />
      <Stack.Screen name="moment/[id]" options={{ title: 'Moment' }} />
      <Stack.Screen
        name="moment/edit/[id]"
        options={{
          title: 'Edit moment',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}
