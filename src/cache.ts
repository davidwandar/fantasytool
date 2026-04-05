const CACHE_PREFIX = 'fantasy-tool';

interface CacheEnvelope<T> {
    expiresAt: number;
    value: T;
}

const fullKey = (key: string) => `${CACHE_PREFIX}:${key}`;

export async function getCached<T>(key: string): Promise<T | null> {
    const stored = await chrome.storage.local.get(fullKey(key));
    const envelope = stored[fullKey(key)] as CacheEnvelope<T> | undefined;

    if (!envelope) {
        return null;
    }

    if (Date.now() > envelope.expiresAt) {
        await chrome.storage.local.remove(fullKey(key));
        return null;
    }

    return envelope.value;
}

export async function setCached<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const envelope: CacheEnvelope<T> = {
        expiresAt: Date.now() + ttlMs,
        value,
    };

    await chrome.storage.local.set({ [fullKey(key)]: envelope });
}

export async function getOrFetchJson<T>(key: string, ttlMs: number, url: string): Promise<T> {
    const cached = await getCached<T>(key);
    if (cached) {
        return cached;
    }

    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText} for ${url}`);
    }

    const json = (await response.json()) as T;
    await setCached(key, json, ttlMs);
    return json;
}
