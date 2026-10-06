/** @file component tests for the Settings compact-layout switch and its preferences store */
import { MantineProvider } from '@mantine/core';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect } from 'chai';
import i18n from 'i18next';
import { afterEach, beforeEach, describe, it } from 'mocha';
import React, { act } from 'react';
import { initReactI18next } from 'react-i18next';
import Settings from '../src/pages/Settings';
import {
	DEFAULT_PREFERENCES,
	LEGACY_PREFERENCES_KEYS,
	PREFERENCES_KEY,
	__resetPreferencesForTests
} from '../src/store/preferences';

void i18n.use(initReactI18next).init({
	lng: 'en',
	fallbackLng: 'en',
	resources: {},
	keySeparator: false,
	interpolation: { escapeValue: false }
});

const LEGACY_KEY = LEGACY_PREFERENCES_KEYS[0]!;

function renderSettings() {
	return render(
		<MantineProvider>
			<Settings />
		</MantineProvider>
	);
}

function getSwitch(): HTMLInputElement {
	// Mantine renders the label and description inside one <label>, so match the
	// switch by its role and the start of its accessible name instead of exact label text
	return screen.getByRole('switch', { name: /^compact layout/i }) as HTMLInputElement;
}

async function flushDebouncedWrite() {
	await waitFor(() => expect(window.localStorage.getItem(PREFERENCES_KEY)).to.not.equal(null));
}

describe('Settings compact layout switch', () => {
	beforeEach(() => {
		window.localStorage.clear();
		__resetPreferencesForTests();
	});

	afterEach(() => {
		cleanup();
		window.localStorage.clear();
		__resetPreferencesForTests();
	});

	it('defaults to off when nothing is stored', () => {
		renderSettings();
		expect(getSwitch().checked).to.equal(false);
	});

	it('persists across remounts after toggling', async () => {
		const first = renderSettings();
		fireEvent.click(getSwitch());
		expect(getSwitch().checked).to.equal(true);
		await flushDebouncedWrite();
		expect(window.localStorage.getItem(PREFERENCES_KEY)).to.equal(JSON.stringify({ compactLayout: true }));

		// simulate a full reload: drop the component and the in-memory cache
		first.unmount();
		__resetPreferencesForTests();

		renderSettings();
		expect(getSwitch().checked).to.equal(true);
	});

	it('migrates the legacy unversioned key', () => {
		window.localStorage.setItem(LEGACY_KEY, JSON.stringify({ compactLayout: true }));

		renderSettings();

		expect(getSwitch().checked).to.equal(true);
		expect(window.localStorage.getItem(PREFERENCES_KEY)).to.equal(JSON.stringify({ compactLayout: true }));
		expect(window.localStorage.getItem(LEGACY_KEY)).to.equal(null);
	});

	it('falls back to defaults on corrupt data', () => {
		window.localStorage.setItem(PREFERENCES_KEY, '{not json');

		renderSettings();

		expect(getSwitch().checked).to.equal(DEFAULT_PREFERENCES.compactLayout);
	});

	it('falls back to defaults when the legacy value is corrupt', () => {
		window.localStorage.setItem(LEGACY_KEY, 'garbage');

		renderSettings();

		expect(getSwitch().checked).to.equal(DEFAULT_PREFERENCES.compactLayout);
		// corrupt legacy data is replaced by migrated defaults, not kept around
		expect(window.localStorage.getItem(PREFERENCES_KEY)).to.equal(JSON.stringify(DEFAULT_PREFERENCES));
		expect(window.localStorage.getItem(LEGACY_KEY)).to.equal(null);
	});

	it('syncs cross-tab via storage events without echoing a write', async () => {
		renderSettings();
		expect(getSwitch().checked).to.equal(false);

		const originalSetItem = window.Storage.prototype.setItem;
		let writes = 0;
		window.Storage.prototype.setItem = function (...args) {
			writes++;
			return originalSetItem.apply(this, args);
		};
		try {
			// another tab writes the new value...
			window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ compactLayout: true }));
			writes = 0;
			// ...and this tab only receives the storage event
			act(() => {
				window.dispatchEvent(new window.StorageEvent('storage', {
					key: PREFERENCES_KEY,
					oldValue: JSON.stringify({ compactLayout: false }),
					newValue: JSON.stringify({ compactLayout: true }),
					storageArea: window.localStorage
				}));
			});

			await waitFor(() => expect(getSwitch().checked).to.equal(true));
			// no echo: the storage event handler must not write back to localStorage
			expect(writes).to.equal(0);
		} finally {
			window.Storage.prototype.setItem = originalSetItem;
		}
	});
});
