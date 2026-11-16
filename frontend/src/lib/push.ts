import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import { registerPushToken } from '../services/api';

/**
 * Push notifications for hunts. expo-notifications is a native module: builds
 * made before it was added (and Expo Go) don't have it, so everything here is
 * loaded lazily and fails quietly there. Android also needs the project's FCM
 * credentials in EAS before a token can be issued.
 */
let registered = false;

/** `ask`: show the permission prompt (when a hunt is created); otherwise only register if already allowed. */
export async function registerForPush(ask = false): Promise<void> {
  if (registered || Platform.OS === 'web') return;
  try {
    const Notifications = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'WearWise', importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await registerPushToken(data, Platform.OS);
    registered = true;
    // A tap on a hunt notification opens the hunts screen.
    Notifications.addNotificationResponseReceivedListener((response) => {
      const type = response.notification.request.content.data?.type;
      if (type === 'hunt') router.push('/hunts');
    });
  } catch {
    // No native module in this build, no FCM credentials yet, or offline: pushes simply stay off.
  }
}
