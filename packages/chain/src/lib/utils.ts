/**
 * Shared utilities for the chain service.
 *
 * This module centralizes address encoding helpers, replacing the PJS
 * dependency on @polkadot/util-crypto with native implementations.
 */

import { createHash } from 'crypto';

// ──────────────────────────────────────────────────────────────────────────────
// SS58 Address Encoding (replaces @polkadot/util-crypto encodeAddress)
// ──────────────────────────────────────────────────────────────────────────────

const SS58_PREFIX = Buffer.from('SS58PRE');
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Encode a raw account ID (hex or Uint8Array) to SS58 format.
 *
 * @param accountId Hex string (0x-prefixed) or Uint8Array (32 bytes for AccountId32)
 * @param ss58Format The SS58 network prefix (e.g. 0 for Polkadot, 2 for Kusama)
 * @returns SS58-encoded address string
 */
export function encodeAddress(accountId: string | Uint8Array, ss58Format: number): string {
  const pubkey = typeof accountId === 'string' ? hexToBytes(accountId) : accountId;

  // Build prefix bytes
  const prefixBytes =
    ss58Format < 64
      ? Uint8Array.of(ss58Format)
      : Uint8Array.of(((ss58Format & 0xfc) >> 2) | 0x40, (ss58Format >> 8) | ((ss58Format & 0x03) << 6));

  // payload = prefix + public key
  const payload = new Uint8Array(prefixBytes.length + pubkey.length);
  payload.set(prefixBytes);
  payload.set(pubkey, prefixBytes.length);

  // checksum = first 2 bytes of blake2b-512("SS58PRE" + payload)
  const hash = createHash('blake2b512');
  hash.update(SS58_PREFIX);
  hash.update(payload);
  const checksum = hash.digest().subarray(0, 2);

  // result = base58(payload + checksum)
  const full = new Uint8Array(payload.length + 2);
  full.set(payload);
  full.set(checksum, payload.length);

  return base58Encode(full);
}

// ──────────────────────────────────────────────────────────────────────────────
// MultiAddress Resolution
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Resolve a PAPI MultiAddress enum value to a plain SS58 string.
 *
 * PAPI represents MultiAddress as an enum:
 *   { type: "Id", value: "SS58String" }
 *   { type: "Address32", value: "0xhex..." }
 *   { type: "Address20", value: "0xhex..." }
 *   { type: "Index", value: number }
 *
 * If the input is already a plain string (SS58), it is returned as-is.
 */
export function resolveMultiAddress(multiAddr: any): string {
  if (typeof multiAddr === 'string') return multiAddr;
  if (multiAddr?.type === 'Id' && multiAddr.value) return String(multiAddr.value);
  if (multiAddr?.type === 'Address32' && multiAddr.value) return String(multiAddr.value);
  if (multiAddr?.type === 'Address20' && multiAddr.value) return String(multiAddr.value);
  if (multiAddr?.type === 'Index') return `index:${multiAddr.value}`;
  return String(multiAddr);
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal Helpers
// ──────────────────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(h.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(h.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function base58Encode(input: Uint8Array): string {
  // Count leading zeros
  let zeros = 0;
  while (zeros < input.length && input[zeros] === 0) zeros++;

  // Convert to base58 using BigInt arithmetic
  let num = BigInt(0);
  for (const byte of input) {
    num = num * 256n + BigInt(byte);
  }

  let encoded = '';
  while (num > 0n) {
    const remainder = Number(num % 58n);
    num = num / 58n;
    encoded = BASE58_ALPHABET[remainder] + encoded;
  }

  // Prepend '1' for each leading zero byte
  return BASE58_ALPHABET[0].repeat(zeros) + encoded;
}
