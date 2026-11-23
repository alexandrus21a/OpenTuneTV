import { NativeEventEmitter, NativeModules } from 'react-native';

const { OtaModule } = NativeModules as {
  OtaModule: {
    checkForUpdate(manifestUrl: string): Promise<string | null>;
    downloadUpdate(apkUrl: string): Promise<string>;
    canInstallUpdates(): Promise<boolean>;
    openInstallPermissionSettings(): void;
    installUpdate(apkPath: string): Promise<boolean>;
  };
};

export interface UpdateInfo {
  versionCode: number;
  versionName: string;
  apkUrl: string;
  notes?: string;
}

/**
 * Where the update manifest + APK live — this app is sideloaded (no
 * Play Store auto-update), so it has to check its own small JSON file.
 * Host it anywhere static (a GitHub raw URL, your own domain, S3) and
 * point this at it. See OtaModule.kt's doc comment for the JSON shape.
 */
export const OTA_MANIFEST_URL = 'https://REPLACE_ME/opentune-rn/update.json';

export async function checkForUpdate(manifestUrl: string = OTA_MANIFEST_URL): Promise<UpdateInfo | null> {
  const json = await OtaModule.checkForUpdate(manifestUrl);
  return json ? (JSON.parse(json) as UpdateInfo) : null;
}

export function downloadUpdate(apkUrl: string): Promise<string> {
  return OtaModule.downloadUpdate(apkUrl);
}

export function canInstallUpdates(): Promise<boolean> {
  return OtaModule.canInstallUpdates();
}

export function openInstallPermissionSettings(): void {
  OtaModule.openInstallPermissionSettings();
}

export function installUpdate(apkPath: string): Promise<boolean> {
  return OtaModule.installUpdate(apkPath);
}

/** Subscribes to download progress (0..1); returns an unsubscribe function. */
export function subscribeOtaProgress(listener: (fraction: number) => void): () => void {
  const emitter = new NativeEventEmitter(NativeModules.OtaModule);
  const sub = emitter.addListener('ota_progress', (event: { fraction: number }) => listener(event.fraction));
  return () => sub.remove();
}
