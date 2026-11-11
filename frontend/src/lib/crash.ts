import { Platform } from 'react-native';
import { reportCrash } from '../services/api';

/**
 * Send JavaScript errors nobody caught to the server, where the admin panel's
 * Errors page lists them with the platform and app version. The error still
 * goes on to React Native's own handler afterwards, so nothing about how the
 * app behaves on a crash changes. In development the red box is enough.
 */
let installed = false;

export function installCrashReporter() {
  if (installed || __DEV__) return;
  const utils = (globalThis as any).ErrorUtils;
  if (!utils?.getGlobalHandler) return;
  installed = true;
  const previous = utils.getGlobalHandler();
  let sent = 0;
  utils.setGlobalHandler((error: any, isFatal?: boolean) => {
    if (sent >= 5) return previous?.(error, isFatal);
    sent += 1;
    const message = String(error?.message ?? error ?? 'Unknown error').slice(0, 2000);
    const sending = reportCrash({
      message: error?.name && !message.startsWith(error.name) ? `${error.name}: ${message}` : message,
      stack: String(error?.stack ?? '').slice(0, 8000),
      fatal: !!isFatal,
      device: `${Platform.OS} ${Platform.Version}`,
    });
    // A fatal error ends the app in the next handler: give the report a moment to leave first.
    if (isFatal) Promise.race([sending, new Promise((r) => setTimeout(r, 1500))]).finally(() => previous?.(error, isFatal));
    else previous?.(error, isFatal);
  });
}
