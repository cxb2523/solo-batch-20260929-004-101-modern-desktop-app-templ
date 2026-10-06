/** @file versioned, localStorage-backed preferences with cross-tab sync */
import { useSyncExternalStore } from 'react';

// the storage key carries a version so the shape can evolve; unversioned keys
// written by older builds are migrated on first read
export const PREFERENCES_KEY = 'settings:v1';
export const LEGACY_PREFERENCES_KEYS = ['settings'];
const WRITE_DEBOUNCE_MS = 100;

export interface Preferences {
	compactLayout: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
	compactLayout: false
};

function safeGetItem(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		// privacy modes can throw on any storage access
		return null;
	}
}

function safeSetItem(key: string, value: string) {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// quota exceeded / privacy mode: keep the in-memory value, don't crash
	}
}

function safeRemoveItem(key: string) {
	try {
		window.localStorage.removeItem(key);
	} catch { }
}

/** Parses raw stored JSON; returns null when absent or corrupt (caller falls back to defaults). */
function parsePreferences(raw: string | null): Preferences | null {
	if (raw === null) return null;
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null) return null;
		if (typeof parsed.compactLayout !== 'boolean') return null;
		return { compactLayout: parsed.compactLayout };
	} catch {
		return null;
	}
}

/** Synchronous read so the very first frame already reflects the stored value. */
export function readPreferences(): Preferences {
	const versioned = parsePreferences(safeGetItem(PREFERENCES_KEY));
	if (versioned !== null) return versioned;
	for (const legacyKey of LEGACY_PREFERENCES_KEYS) {
		const raw = safeGetItem(legacyKey);
		if (raw === null) continue;
		// corrupt legacy data migrates to defaults rather than crashing
		const migrated = parsePreferences(raw) ?? { ...DEFAULT_PREFERENCES };
		safeSetItem(PREFERENCES_KEY, JSON.stringify(migrated));
		safeRemoveItem(legacyKey);
		return migrated;
	}
	return { ...DEFAULT_PREFERENCES };
}

type Listener = () => void;

/**
 * Module-level store: every hook instance in this tab shares one truth, so the
 * Settings switch and any layout reader can never diverge. Writes are debounced
 * and only ever happen in `set` — the storage-event handler updates memory only,
 * so a change never echoes back into localStorage.
 */
function createPreferencesStore() {
	let current: Preferences | undefined;
	const listeners = new Set<Listener>();
	let writeTimer: number | undefined;
	let listening = false;

	function get(): Preferences {
		if (current === undefined) current = readPreferences();
		return current;
	}

	function persist() {
		if (current !== undefined) safeSetItem(PREFERENCES_KEY, JSON.stringify(current));
	}

	function scheduleWrite() {
		window.clearTimeout(writeTimer);
		writeTimer = window.setTimeout(() => {
			writeTimer = undefined;
			persist();
		}, WRITE_DEBOUNCE_MS);
	}

	function notify() {
		listeners.forEach(listener => listener());
	}

	function set(patch: Partial<Preferences>) {
		const next = { ...get(), ...patch };
		if (next.compactLayout === current!.compactLayout) return;
		current = next;
		scheduleWrite();
		notify();
	}

	function onStorage(event: StorageEvent) {
		if (event.key !== null && event.key !== PREFERENCES_KEY && !LEGACY_PREFERENCES_KEYS.includes(event.key)) return;
		// another tab wrote (or storage was cleared): re-read, but never write back
		const next = readPreferences();
		if (next.compactLayout === get().compactLayout) return;
		current = next;
		notify();
	}

	function subscribe(listener: Listener) {
		if (!listening) {
			window.addEventListener('storage', onStorage);
			listening = true;
		}
		listeners.add(listener);
		get();
		return () => {
			listeners.delete(listener);
			if (listeners.size === 0) {
				window.removeEventListener('storage', onStorage);
				listening = false;
				// don't lose a pending debounced write when the last consumer unmounts
				window.clearTimeout(writeTimer);
				writeTimer = undefined;
				persist();
			}
		};
	}

	function reset() {
		window.clearTimeout(writeTimer);
		writeTimer = undefined;
		current = undefined;
	}

	return { get, set, subscribe, reset };
}

export const preferencesStore = createPreferencesStore();

/** Test-only: drop the cached value so the next read re-hits localStorage. */
export function __resetPreferencesForTests() {
	preferencesStore.reset();
}

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
	const preferences = useSyncExternalStore(preferencesStore.subscribe, preferencesStore.get);
	return [preferences, preferencesStore.set];
}

export function useCompactLayout(): [boolean, (compactLayout: boolean) => void] {
	const [preferences, setPreferences] = usePreferences();
	return [preferences.compactLayout, (compactLayout: boolean) => setPreferences({ compactLayout })];
}
