import type { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type { PolkadotClient } from 'polkadot-api';
import type { RuntimeClient } from '../types';

/**
 * Per-address storage query with three selectable engines (config: `chain.storageQueryEngine`).
 *
 * - `chainHead` / `legacyRpc` — *batched*: both encode keys and decode values identically, differing
 *   only in the wire fetch (see the two `*Fetch` functions below).
 * - `getValues` — *un-batched baseline*: the pre-migration path, PAPI's typed
 *   `runtimeClient.query.<Pallet>.<Storage>.getValues()`, which opens one `chainHead_v1_storage`
 *   operation per key. Kept as an A/B/C comparison point to confirm in k8s whether batching helps.
 *
 * **Why three engines.** PAPI has no batched storage-query API, so `getValues()` opens one operation
 * per key — with multiple monitored accounts that serialized behind the node's concurrent-operation limit
 * and pushed block processing from ~100–300ms (pjs) to 2.5–4s. The two batched engines were written to
 * work around it, and A/B/C testing confirmed `chainHead` as the default (lowest latency, clear
 * CPU/memory headroom). Upstream issue: https://github.com/polkadot-api/polkadot-api/issues/1420
 *
 * TODO: once PAPI ships a batched storage API, drop all three engines and the config switch in favour
 * of it.
 *
 * Assumes polkadot-api 2.0.1 internals (pinned exactly in package.json, guarded by tests/integration):
 * codecs come only from the unstable `___INTERNAL_DO_NOT_USE` (no public accessor), and `legacyRpc`
 * also uses `_request`, which PAPI marks "unstable across minor versions". A version bump may break
 * either and must be re-verified.
 */
export type StorageQueryEngine = 'chainHead' | 'legacyRpc' | 'getValues';

interface StorageCodecs {
  keys: { enc: (...args: unknown[]) => string };
  value: { dec: (data: string) => unknown };
  fallback: unknown;
}

interface RuntimeContext {
  dynamicBuilder: {
    buildStorage: (pallet: string, storageName: string) => StorageCodecs;
  };
}

interface StorageQueryItem {
  key: string;
  type: 'value';
}

interface StorageQueryResult {
  key: string;
  value?: string;
}

interface InternalChainHead {
  getRuntimeContext$: (at: string | null) => Observable<RuntimeContext>;
  // Live follower emits `StorageQueryResult[]`; the archive path (block not pinned) emits one at a
  // time. `chainHeadFetch` normalizes both.
  storageQueries$: (
    at: string | null,
    queries: StorageQueryItem[],
    childTrie: string | null,
  ) => Observable<StorageQueryResult[] | StorageQueryResult>;
}

type StorageChangeSet = { block: string; changes: [string, string | null][] };

/** The only per-engine difference: encoded keys -> map of encoded key to raw (still-encoded) value. */
type FetchRaw = (encodedKeys: string[], blockHash: string) => Promise<Map<string, string>>;

/** `chainHead`: one batched `chainHead_v1_storage` operation. */
function chainHeadFetch(chainHead: InternalChainHead): FetchRaw {
  return async (encodedKeys, blockHash) => {
    const queries: StorageQueryItem[] = encodedKeys.map(key => ({ key, type: 'value' }));
    const rawByKey = new Map<string, string>();

    await new Promise<void>((resolve, reject) => {
      const subscription = chainHead.storageQueries$(blockHash, queries, null).subscribe({
        next: itemOrItems => {
          const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
          for (const item of items) {
            if (item.value !== undefined) {
              rawByKey.set(item.key, item.value);
            }
          }
        },
        error: err => {
          subscription.unsubscribe();
          reject(err);
        },
        complete: () => {
          subscription.unsubscribe();
          resolve();
        },
      });
    });

    return rawByKey;
  };
}

/**
 * `legacyRpc`: one stateless `state_queryStorageAt` call (no concurrent-operation limit). Splits the
 * batch and retries (capped) on failure, since some nodes cap per-call key count with no stated limit.
 */
function legacyRpcFetch(client: PolkadotClient): FetchRaw {
  async function fetchChanges(keys: string[], blockHash: string, splitsLeft = 3): Promise<Map<string, string>> {
    if (keys.length === 0) return new Map();

    try {
      const [{ changes }] = await client._request<StorageChangeSet[], [string[], string]>('state_queryStorageAt', [
        keys,
        blockHash,
      ]);
      const result = new Map<string, string>();
      for (const [key, value] of changes) {
        if (value !== null) result.set(key, value);
      }
      return result;
    } catch (error) {
      if (splitsLeft <= 0 || keys.length <= 1) throw error;
      const mid = Math.floor(keys.length / 2);
      const [left, right] = await Promise.all([
        fetchChanges(keys.slice(0, mid), blockHash, splitsLeft - 1),
        fetchChanges(keys.slice(mid), blockHash, splitsLeft - 1),
      ]);
      return new Map([...left, ...right]);
    }
  }

  return (encodedKeys, blockHash) => fetchChanges(encodedKeys, blockHash);
}

export function createStorageQuery(
  engine: StorageQueryEngine,
  client: PolkadotClient,
  runtimeClient: RuntimeClient,
) {
  // `getValues`: the un-batched baseline. PAPI's typed API returns already-decoded values, so it
  // bypasses the codec + `fetchRaw` path entirely and matches the same `(T | undefined)[]` contract.
  if (engine === 'getValues') {
    return {
      async queryValues<T>(
        pallet: string,
        storageName: string,
        keyArgsList: unknown[][],
        blockHash: string,
      ): Promise<(T | undefined)[]> {
        if (keyArgsList.length === 0) return [];
        return runtimeClient.query[pallet][storageName].getValues(keyArgsList, { at: blockHash });
      },
    };
  }

  const chainHead = (client as unknown as { ___INTERNAL_DO_NOT_USE: InternalChainHead }).___INTERNAL_DO_NOT_USE;
  const fetchRaw: FetchRaw = engine === 'legacyRpc' ? legacyRpcFetch(client) : chainHeadFetch(chainHead);

  return {
    async queryValues<T>(
      pallet: string,
      storageName: string,
      keyArgsList: unknown[][],
      blockHash: string,
    ): Promise<(T | undefined)[]> {
      if (keyArgsList.length === 0) return [];

      const ctx = await firstValueFrom(chainHead.getRuntimeContext$(blockHash));
      const codecs = ctx.dynamicBuilder.buildStorage(pallet, storageName);

      const encodedKeys = keyArgsList.map(args => codecs.keys.enc(...args));
      const rawByKey = await fetchRaw(encodedKeys, blockHash);

      return encodedKeys.map(key => {
        const raw = rawByKey.get(key);
        return (raw === undefined ? codecs.fallback : codecs.value.dec(raw)) as T | undefined;
      });
    },
  };
}
