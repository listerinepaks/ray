import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId(): string | undefined {
  const fromExpoConfig = Constants.expoConfig?.extra?.eas?.projectId;
  if (typeof fromExpoConfig === 'string' && fromExpoConfig.length > 0) {
    return fromExpoConfig;
  }
  const fromEasConfig = Constants.easConfig?.projectId;
  if (typeof fromEasConfig === 'string' && fromEasConfig.length > 0) {
    return fromEasConfig;
  }
  return undefined;
}

export async function registerForPushToken(): Promise<string | null> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }
  const perms = await Notifications.getPermissionsAsync();
  let finalStatus = perms.status;
  if (finalStatus !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    finalStatus = asked.status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: getProjectId(),
    });
    return token.data ?? null;
  } catch {
    return null;
  }
}
