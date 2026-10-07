/** @file single source of truth for user preferences persisted to localStorage */
import { useSyncExternalStore } from 'react';

// versioned key: bump the suffix and add the old key to LEGACY_KEYS when the shape changes
export const PREFERENCES_KEY = 'r2-t2:preferences:v1';
const LEGACY_KEYS = ['r2-t2:preferences', 'compactLayout'];
// debounce writes like src/tauri/storage.ts does
const WRITE_DELAY = 100;

export interface Preferences {
	compactLayout: boolean;
}

export const defaultPreferences: Preferences = {
	compactLayout: false,
};

function safeGet(key: string): string | null {
	try {
		return window.localStorage.getItem(key);
	} catch {
		// privacy mode can throw on any storage access
		return null;
	}
}

function safeSet(key: string, value: string) {
	try {
		window.localStorage.setItem(key, value);
	} catch {
		// quota exceeded / privacy mode: keep the in-memory value, app stays usable
	}
}

function safeRemove(key: string) {
	try {
		window.localStorage.removeItem(key);
	} catch { }
}

/** Parses a raw stored value into Preferences, or null if it is missing/corrupt. */
function parse(raw: string | null): Preferences | null {
	if (raw === null) return null;
	try {
		const parsed = JSON.parse(raw);
		if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
		if (typeof parsed.compactLayout !== 'boolean') return null;
		return { compactLayout: parsed.compactLayout };
	} catch {
		return null;
	}
}

/** Reads legacy (unversioned) keys, moves a valid value under the versioned key. */
function migrateLegacy(): Preferences | null {
	for (const key of LEGACY_KEYS) {
		const raw = safeGet(key);
		if (raw === null) continue;
		// legacy values were either a bare 'true'/'false' or a JSON preferences object
		const legacy = raw === 'true' || raw === 'false'
			? { compactLayout: raw === 'true' }
			: parse(raw);
		if (legacy !== null && typeof legacy.compactLayout === 'boolean') {
			const prefs = { ...defaultPreferences, compactLayout: legacy.compactLayout };
			safeSet(PREFERENCES_KEY, JSON.stringify(prefs));
			safeRemove(key);
			return prefs;
		}
		// corrupt legacy value: drop it so it does not shadow defaults forever
		safeRemove(key);
	}
	return null;
}

function loadPreferences(): Preferences {
	if (typeof window === 'undefined') return defaultPreferences;
	const stored = parse(safeGet(PREFERENCES_KEY));
	if (stored !== null) return stored;
	// bad data under the versioned key falls back to defaults
	const migrated = migrateLegacy();
	return migrated ?? defaultPreferences;
}

let current: Preferences = loadPreferences();
const listeners = new Set<() => void>();

function emit() {
	applyToDocument();
	listeners.forEach(listener => listener());
}

let writeTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleWrite(prefs: Preferences) {
	clearTimeout(writeTimer);
	writeTimer = setTimeout(() => safeSet(PREFERENCES_KEY, JSON.stringify(prefs)), WRITE_DELAY);
}

export function getPreferences(): Preferences {
	return current;
}

export function setPreference<K extends keyof Preferences>(key: K, value: Preferences[K]) {
	if (current[key] === value) return;
	current = { ...current, [key]: value };
	scheduleWrite(current);
	emit();
}

/** The compact layout preference also drives the layout via a document attribute. */
function applyToDocument() {
	if (typeof document === 'undefined') return;
	document.documentElement.dataset.compactLayout = String(current.compactLayout);
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

// cross-tab sync: the storage event only fires in *other* tabs, and applying a
// remote value never schedules a write, so this tab never echoes it back
if (typeof window !== 'undefined') {
	window.addEventListener('storage', (event: StorageEvent) => {
		if (event.key !== PREFERENCES_KEY || event.newValue === null) return;
		const next = parse(event.newValue);
		if (next === null) return;
		if (next.compactLayout === current.compactLayout) return;
		current = next;
		emit();
	});
	applyToDocument();
}

/** React binding: first render already sees the stored value (synchronous read). */
export function usePreferences(): Preferences {
	return useSyncExternalStore(subscribe, getPreferences, () => defaultPreferences);
}

/** Test hook: re-reads storage as if the page had just loaded. */
export function resetPreferencesForTests() {
	clearTimeout(writeTimer);
	current = loadPreferences();
	emit();
}
