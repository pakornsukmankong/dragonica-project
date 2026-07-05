// Build an EMVCo PromptPay QR payload entirely offline (no gateway). Given our
// own PromptPay id (a phone number, national/tax id, or e-wallet id) and an
// amount in Baht, this produces the exact string a Thai banking app expects to
// scan. Used by the "manual" payment provider while a real gateway is pending.
//
// Format reference: EMVCo QRCPS + Bank of Thailand PromptPay spec (tag 29).

const GUID_PROMPTPAY = 'A000000677010111';
const CURRENCY_THB = '764';
const COUNTRY_TH = 'TH';

// One EMVCo TLV field: 2-digit id + 2-digit length + value.
const field = (id: string, value: string): string =>
  `${id}${String(value.length).padStart(2, '0')}${value}`;

const digitsOnly = (id: string): string => id.replace(/[^0-9]/g, '');

// Phone → 0066xxxxxxxxx (13 digits); national/tax/e-wallet ids are used as-is.
const formatTarget = (id: string): string => {
  const n = digitsOnly(id);
  if (n.length >= 13) return n; // national id (13) / tax / e-wallet (15)
  return `0000000000000${n.replace(/^0/, '66')}`.slice(-13); // phone
};

// CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over the payload, as the spec
// requires for the trailing tag 63.
const crc16 = (data: string): string => {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
};

/**
 * Build a PromptPay QR payload string for `target` (our receiving id) and a THB
 * `amount`. Since the amount is embedded, the QR is one-time/dynamic (POI 12).
 */
export function buildPromptPayPayload(target: string, amount: number): string {
  const t = digitsOnly(target);
  const targetTag = t.length >= 15 ? '03' : t.length >= 13 ? '02' : '01';

  const merchant =
    field('00', GUID_PROMPTPAY) + field(targetTag, formatTarget(t));

  const body =
    field('00', '01') + // payload format indicator
    field('01', '12') + // point of initiation: dynamic (amount included)
    field('29', merchant) + // merchant account info (PromptPay)
    field('53', CURRENCY_THB) +
    field('54', amount.toFixed(2)) +
    field('58', COUNTRY_TH);

  // CRC is computed over everything up to and including the CRC tag+length.
  return body + '6304' + crc16(`${body}6304`);
}
