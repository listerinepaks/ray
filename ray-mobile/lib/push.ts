import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const LOG_PREFIX = '[RayPush]';

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
    console.info(`${LOG_PREFIX} Skipping push registration (platform=${Platform.OS}).`);
    return null;
  }
  const perms = await Notifications.getPermissionsAsync();
  let finalStatus = perms.status;
  if (finalStatus !== 'granted') {
    const asked = await Notifications.requestPermissionsAsync();
    finalStatus = asked.status;
  }
  if (finalStatus !== 'granted') {
    console.warn(`${LOG_PREFIX} Notification permission not granted (status=${finalStatus}).`);
    return null;
  }
  try {
    const projectId = getProjectId();
    if (!projectId) {
      console.warn(
        `${LOG_PREFIX} No EAS projectId in app config; getExpoPushTokenAsync may fail. Set extra.eas.projectId or use EAS build.`,
      );
    }
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    const data = token.data ?? null;
    if (data) {
      const hint = data.length > 32 ? `${data.slice(0, 32)}…` : data;
      console.info(`${LOG_PREFIX} Expo push token obtained (${hint}).`);
    }
    return data;
  } catch (err) {
    console.warn(`${LOG_PREFIX} getExpoPushTokenAsync failed:`, err);
    return null;
  }
}
