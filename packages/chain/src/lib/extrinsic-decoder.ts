/**
 * Minimal extrinsic decoder for extracting signer and call data from raw extrinsics.
 *
 * Raw extrinsics from PAPI's `client.getBlockBody()` are full SCALE-encoded extrinsics
 * (compact length prefix + version byte + signer + signature + signed extensions + call data).
 * PAPI's `txFromCallData()` only accepts call data (the pallet+method+args portion).
 *
 * This utility bridges the gap by parsing the extrinsic envelope to extract:
 * 1. Whether the extrinsic is signed
 * 2. The signer's raw account ID (hex string, 0x-prefixed)
 * 3. The call data bytes (to pass to typedApi.txFromCallData)
 *
 * The call data boundary is determined using a per-chain `extrinsicExtraOffset` constant
 * from CHAIN_CONFIGS, which specifies how many additional bytes follow the common extensions
 * (Era, Nonce, Tip) before the call data begins.
 */

export interface DecodedExtrinsic {
  isSigned: boolean;
  signer: string | null; // hex AccountId (0x-prefixed, 64 hex chars) for signed; null for unsigned
  callData: Uint8Array; // raw call data bytes to feed to txFromCallData
}

/**
 * Decode a raw extrinsic from block body.
 *
 * @param rawExtrinsic Full SCALE-encoded extrinsic bytes (including compact length prefix)
 * @param extraOffset Number of bytes after common extensions (Era+Nonce+Tip) before call data.
 *        Obtained from ChainProperties.extrinsicExtraOffset.
 * @returns DecodedExtrinsic with signer and call data
 */
export function decodeExtrinsic(rawExtrinsic: Uint8Array, extraOffset: number): DecodedExtrinsic {
  let cursor = 0;

  // 1. Compact length prefix — total payload length in bytes
  const [totalLen, lenPrefixSize] = readCompact(rawExtrinsic, cursor);
  cursor += lenPrefixSize;
  const payloadStart = cursor;
  const payloadEnd = payloadStart + totalLen;

  // 2. Version byte: bit 7 = signed flag, bits 0-6 = extrinsic version (typically 4)
  const versionByte = rawExtrinsic[cursor++];
  const isSigned = (versionByte & 0x80) !== 0;

  // Unsigned extrinsic: call data starts right after version byte
  if (!isSigned) {
    return { isSigned: false, signer: null, callData: rawExtrinsic.slice(cursor, payloadEnd) };
  }

  // 3. MultiAddress (signer)
  const [signer, signerBytes] = readMultiAddress(rawExtrinsic, cursor);
  cursor += signerBytes;

  // 4. MultiSignature (skip over it)
  cursor += skipMultiSignature(rawExtrinsic, cursor);

  // 5. Common signed extensions: Era + Nonce + Tip
  cursor = skipCommonExtensions(rawExtrinsic, cursor);

  // 6. Skip chain-specific extra extension bytes (e.g., Option<AssetId>, MetadataHash Mode)
  cursor += extraOffset;

  // 7. Remaining bytes are call data
  if (cursor > payloadEnd) {
    throw new Error(
      `Extrinsic too short: cursor ${cursor} exceeds payload end ${payloadEnd} ` +
        `(extraOffset=${extraOffset}). Check extrinsicExtraOffset for this chain.`,
    );
  }

  return { isSigned: true, signer, callData: rawExtrinsic.slice(cursor, payloadEnd) };
}

// ──────────────────────────────────────────────────────────────────────────────
// SCALE Helpers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Read a SCALE compact-encoded integer. Returns [value, bytesConsumed].
 */
function readCompact(input: Uint8Array, offset: number): [number, number] {
  const first = input[offset];
  const mode = first & 0b11;

  if (mode === 0) return [first >>> 2, 1];
  if (mode === 1) return [((first | (input[offset + 1] << 8)) >>> 2) & 0x3fff, 2];
  if (mode === 2) {
    const v =
      ((first | (input[offset + 1] << 8) | (input[offset + 2] << 16) | (input[offset + 3] << 24)) >>> 2) & 0x3fffffff;
    return [v >>> 0, 4];
  }
  // Big-integer mode (mode === 3): length = (first >> 2) + 4
  const byteLen = (first >>> 2) + 4;
  return [0, 1 + byteLen];
}

/**
 * Returns just the byte count for a compact-encoded value.
 */
function compactSize(input: Uint8Array, offset: number): number {
  const mode = input[offset] & 0b11;
  if (mode === 0) return 1;
  if (mode === 1) return 2;
  if (mode === 2) return 4;
  return 1 + ((input[offset] >>> 2) + 4);
}

/**
 * Read a SCALE-encoded MultiAddress. Returns [hexAccountId, bytesConsumed].
 */
function readMultiAddress(input: Uint8Array, offset: number): [string, number] {
  const variant = input[offset];

  switch (variant) {
    case 0: {
      // Id(AccountId32)
      const accountId = input.slice(offset + 1, offset + 1 + 32);
      if (accountId.length !== 32) throw new Error('Truncated MultiAddress.Id');
      return [toHex(accountId), 1 + 32];
    }
    case 1: {
      // Index(Compact<u32>)
      const [, compactBytes] = readCompact(input, offset + 1);
      return ['', 1 + compactBytes];
    }
    case 2: {
      // Raw(Vec<u8>)
      const [len, lenBytes] = readCompact(input, offset + 1);
      return [toHex(input.slice(offset + 1 + lenBytes, offset + 1 + lenBytes + len)), 1 + lenBytes + len];
    }
    case 3: {
      // Address32
      const addr = input.slice(offset + 1, offset + 1 + 32);
      if (addr.length !== 32) throw new Error('Truncated MultiAddress.Address32');
      return [toHex(addr), 1 + 32];
    }
    case 4: {
      // Address20
      const addr = input.slice(offset + 1, offset + 1 + 20);
      if (addr.length !== 20) throw new Error('Truncated MultiAddress.Address20');
      return [toHex(addr), 1 + 20];
    }
    default:
      throw new Error(`Unsupported MultiAddress variant: ${variant}`);
  }
}

/**
 * Skip a SCALE-encoded MultiSignature. Returns bytes consumed.
 */
function skipMultiSignature(input: Uint8Array, offset: number): number {
  const variant = input[offset];
  switch (variant) {
    case 0:
      return 1 + 64; // Ed25519
    case 1:
      return 1 + 64; // Sr25519
    case 2:
      return 1 + 65; // Ecdsa
    default:
      throw new Error(`Unsupported MultiSignature variant: ${variant}`);
  }
}

/**
 * Skip the common signed extension "extra" fields present on all Substrate chains:
 * Era (CheckMortality), Nonce (CheckNonce), and Tip (ChargeTransactionPayment/ChargeAssetTxPayment).
 *
 * Extensions with empty extra data (CheckNonZeroSender, CheckSpecVersion,
 * CheckTxVersion, CheckGenesis) contribute 0 bytes.
 *
 * Returns the updated cursor position after these fields.
 */
function skipCommonExtensions(input: Uint8Array, cursor: number): number {
  // Era: 0x00 = Immortal (1 byte), else Mortal (2 bytes)
  cursor += input[cursor] === 0x00 ? 1 : 2;
  // Nonce: Compact<u32> or Compact<u64>
  cursor += compactSize(input, cursor);
  // Tip: Compact<u128>
  cursor += compactSize(input, cursor);
  return cursor;
}

function toHex(bytes: Uint8Array): string {
  return (
    '0x' +
    Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
}
