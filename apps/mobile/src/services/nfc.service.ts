/**
 * NFC service — abstraction over the native NFC module.
 *
 * The actual NFC library (expo-nfc / react-native-nfc-manager) is injected at
 * startup so this module remains testable without native code.
 *
 * Platform notes (from CLAUDE.md):
 *   iOS  : requires NFCReaderUsageDescription + NFC entitlement in EAS profile
 *   Android: requires NFC permission in app.json
 */

export interface NfcScanResult {
  /** Raw tag identifier string (hex-encoded serial or NDEF text payload) */
  tag_id: string;
}

export class NfcError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NOT_SUPPORTED'
      | 'PERMISSION_DENIED'
      | 'CANCELLED'
      | 'TIMEOUT'
      | 'UNKNOWN'
  ) {
    super(message);
    this.name = 'NfcError';
  }
}

/** Maximum time to wait for an NFC tap (ms) */
const SCAN_TIMEOUT_MS = 30_000;

let _isSupported: boolean | null = null;

/**
 * Returns whether NFC is available on this device.
 * Result is cached after the first call.
 */
export async function isNfcSupported(): Promise<boolean> {
  if (_isSupported !== null) return _isSupported;
  try {
    // Dynamically import so the module is optional at build time
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const NfcManager = (await import('react-native-nfc-manager')).default as any;
    await NfcManager.start();
    _isSupported = (await NfcManager.isSupported()) as boolean;
  } catch {
    _isSupported = false;
  }
  return _isSupported;
}

/**
 * Initiates an NFC scan and resolves with the tag_id once a tag is read.
 * Rejects with an NfcError if the device does not support NFC, the user
 * cancels, or the scan times out.
 */
export async function scanNfcTag(): Promise<NfcScanResult> {
  const supported = await isNfcSupported();
  if (!supported) {
    throw new NfcError('NFC is not supported on this device', 'NOT_SUPPORTED');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const NfcManager = (await import('react-native-nfc-manager')).default as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { NfcTech } = await import('react-native-nfc-manager') as any;

  return new Promise<NfcScanResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      void NfcManager.cancelTechnologyRequest();
      reject(new NfcError('NFC scan timed out', 'TIMEOUT'));
    }, SCAN_TIMEOUT_MS);

    NfcManager.requestTechnology(NfcTech.NfcA)
      .then(() => NfcManager.getTag())
      .then((tag: { id: string } | null) => {
        clearTimeout(timeout);
        if (!tag?.id) {
          reject(new NfcError('No tag data received', 'UNKNOWN'));
          return;
        }
        // Convert byte array ID to uppercase hex string
        const tag_id =
          typeof tag.id === 'string'
            ? tag.id.toUpperCase()
            : Buffer.from(tag.id as unknown as Uint8Array)
                .toString('hex')
                .toUpperCase();
        resolve({ tag_id });
      })
      .catch((err: Error) => {
        clearTimeout(timeout);
        if (err.message?.includes('cancelled') || err.message?.includes('UserCancel')) {
          reject(new NfcError('NFC scan cancelled', 'CANCELLED'));
        } else {
          reject(new NfcError(err.message ?? 'NFC error', 'UNKNOWN'));
        }
      })
      .finally(() => {
        void NfcManager.cancelTechnologyRequest();
      });
  });
}
