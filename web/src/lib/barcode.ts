import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, type Result } from '@zxing/library';

/**
 * Edge barcode decoding.
 *
 * Two paths, best first:
 *  1. The native `BarcodeDetector` (Chrome on Android) — hardware-accelerated,
 *     near-zero battery cost, decodes on-device.
 *  2. ZXing in WASM/JS — the portable fallback, same role ZBar plays on native.
 *
 * Either way the frame never leaves the phone; only the decoded digits are
 * sent for verification. That matters on a metered connection.
 */

const FORMATS: BarcodeFormat[] = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
  BarcodeFormat.CODE_39,
  BarcodeFormat.QR_CODE,
  BarcodeFormat.DATA_MATRIX,
];

const NATIVE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code', 'data_matrix'];

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string; format: string }[]>;
}

function nativeDetector(): NativeDetector | null {
  const w = window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => NativeDetector };
  if (!w.BarcodeDetector) return null;
  try {
    return new w.BarcodeDetector({ formats: NATIVE_FORMATS });
  } catch {
    return null;
  }
}

export interface ScanHandle {
  stop: () => void;
}

/**
 * Attach a live scanner to a <video> element. Calls `onCode` once with the
 * first decoded value, then stops the camera.
 */
export async function startBarcodeScan(
  video: HTMLVideoElement,
  onCode: (code: string, format: string) => void,
  onError: (kind: 'denied' | 'no-camera' | 'error') => void,
): Promise<ScanHandle> {
  let stream: MediaStream | null = null;
  let raf = 0;
  let stopped = false;
  let reader: BrowserMultiFormatReader | null = null;

  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    reader?.reset();
    stream?.getTracks().forEach((tr) => tr.stop());
    stream = null;
  };

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      audio: false,
    });
  } catch (err) {
    const name = (err as DOMException)?.name;
    onError(name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'no-camera' : 'error');
    return { stop };
  }

  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play().catch(() => undefined);

  const native = nativeDetector();

  if (native) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const tick = async () => {
      if (stopped) return;
      if (video.readyState >= 2 && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        try {
          const hits = await native.detect(canvas);
          if (hits.length && !stopped) {
            onCode(hits[0].rawValue, hits[0].format);
            stop();
            return;
          }
        } catch {
          /* transient decode failure — keep scanning */
        }
      }
      raf = requestAnimationFrame(() => void tick());
    };
    void tick();
    return { stop };
  }

  // ZXing fallback.
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader = new BrowserMultiFormatReader(hints, 250);

  reader.decodeFromStream(stream, video, (result: Result | undefined) => {
    if (result && !stopped) {
      onCode(result.getText(), BarcodeFormat[result.getBarcodeFormat()]);
      stop();
    }
  }).catch(() => onError('error'));

  return { stop };
}

/**
 * GS1 check-digit validation for EAN/UPC. A retail barcode whose check digit
 * does not match is either mis-scanned or fabricated — worth flagging before
 * anything else runs.
 */
export function isValidGtin(code: string): boolean {
  const digits = code.replace(/\D/g, '');
  if (![8, 12, 13, 14].includes(digits.length)) return false;
  const body = digits.slice(0, -1).split('').reverse().map(Number);
  const check = Number(digits.slice(-1));
  const sum = body.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Country prefix from a GS1 barcode — 890 is India. */
export function gs1Origin(code: string): string | null {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 13) return null;
  const prefix = Number(digits.slice(0, 3));
  if (prefix === 890) return 'India';
  if (prefix >= 690 && prefix <= 699) return 'China';
  if (prefix >= 0 && prefix <= 139) return 'USA / Canada';
  if (prefix >= 400 && prefix <= 440) return 'Germany';
  if (prefix >= 500 && prefix <= 509) return 'United Kingdom';
  return 'Other';
}
