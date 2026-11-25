import 'server-only';
import crypto from 'node:crypto';

/**
 * Зөвхөн сервер талд хадгалагдах Pro coupon кодын SHA-256 хэшүүд (клиент талд ил гарахгүй).
 * Нэмэлтээр орчны хувьсагчаас PRO_COUPON_CODES (таслалаар тусгаарласан) уншина.
 */
const PRO_COUPON_HASHES = [
  '4132b3666a70c1f31b60e25c3e8473f109bdb30ff5cc31efdc6ccb9b1e58a76b',
  'b4470616f22668daed7d84af50a9d429c90392055fe95d2b0640f92c1b6ebc87',
  '2f703f6c475a9164d676e3fc706e9cef8f2e478f76be46166209787e4d5d16f2',
  'af6470f0b69610fe2c808653b14ac5bcbdb397248ea43dcaf45fc5ae157d0609',
  'ccd3666db5bc5fe4043e1fa5da7004d46b01254021a85b09e2d8c3c105274a15',
];

function safeHexEqual(aHex: string, bHex: string): boolean {
  const a = Buffer.from(aHex, 'hex');
  const b = Buffer.from(bHex, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyProCouponCode(rawCode: string): string | null {
  const normalized = rawCode.trim().toUpperCase();
  if (normalized.length < 4) return null;

  const inputHash = crypto.createHash('sha256').update(normalized).digest('hex');
  for (const h of PRO_COUPON_HASHES) {
    if (safeHexEqual(inputHash, h)) return normalized;
  }

  const envCodes = (process.env.PRO_COUPON_CODES || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
  for (const code of envCodes) {
    const envHash = crypto.createHash('sha256').update(code).digest('hex');
    if (safeHexEqual(inputHash, envHash)) return normalized;
  }

  return null;
}
