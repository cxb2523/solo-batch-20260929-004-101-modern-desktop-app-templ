import './setup-jsdom';
import { MantineProvider } from '@mantine/core';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { expect } from 'chai';
import Settings from '../src/pages/Settings';
import {
	PREFERENCES_KEY,
	defaultPreferences,
	getPreferences,
	resetPreferencesForTests,
} from '../src/store/preferences';

// longer than the debounced write delay in src/store/preferences.ts
const WRITE_WAIT_MS = 200;
const TOGGLE_LABEL = '紧凑布局';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function renderSettings() {
	return render(<MantineProvider><Settings /></MantineProvider>);
}

function toggle(): HTMLInputElement {
	// labelled 紧凑布局; Mantine wraps label + description, so query by role
	expect(screen.getByText(TOGGLE_LABEL)).to.exist;
	return screen.getByRole('switch') as HTMLInputElement;
}

function dispatchStorageEvent(newValue: string | null) {
	const event: any = new window.Event('storage');
	event.key = PREFERENCES_KEY;
	event.newValue = newValue;
	event.oldValue = null;
	event.storageArea = window.localStorage;
	act(() => { window.dispatchEvent(event); });
}

describe('Settings compact layout preference', () => {
	beforeEach(() => {
		window.localStorage.clear();
		resetPreferencesForTests();
	});

	afterEach(() => {
		cleanup();
		window.localStorage.clear();
		resetPreferencesForTests();
	});

	it('defaults to off when nothing is stored', () => {
		renderSettings();
		expect(toggle().checked).to.equal(false);
		expect(document.documentElement.dataset.compactLayout).to.equal('false');
	});

	it('stays on after remounting once toggled', async () => {
		const first = renderSettings();
		fireEvent.click(toggle());
		expect(toggle().checked).to.equal(true);
		await sleep(WRITE_WAIT_MS); // debounced write
		expect(window.localStorage.getItem(PREFERENCES_KEY)).to.equal(JSON.stringify({ compactLayout: true }));

		first.unmount();
		resetPreferencesForTests(); // simulate a fresh page load
		renderSettings();
		expect(toggle().checked).to.equal(true);
		expect(document.documentElement.dataset.compactLayout).to.equal('true');
	});

	it('migrates a legacy unversioned value into the versioned key', () => {
		window.localStorage.setItem('compactLayout', 'true');
		resetPreferencesForTests();
		renderSettings();
		expect(toggle().checked).to.equal(true);
		expect(window.localStorage.getItem('compactLayout')).to.equal(null);
		expect(window.localStorage.getItem(PREFERENCES_KEY)).to.equal(JSON.stringify({ compactLayout: true }));
	});

	it('falls back to defaults on corrupt JSON', () => {
		window.localStorage.setItem(PREFERENCES_KEY, '{not valid json');
		resetPreferencesForTests();
		renderSettings();
		expect(toggle().checked).to.equal(defaultPreferences.compactLayout);
	});

	it('falls back to defaults on a wrong-shaped value', () => {
		window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ compactLayout: 'yes' }));
		resetPreferencesForTests();
		renderSettings();
		expect(toggle().checked).to.equal(defaultPreferences.compactLayout);
	});

	it('syncs from other tabs via the storage event without echoing a write', async () => {
		renderSettings();
		const originalSetItem = window.Storage.prototype.setItem;
		let writes = 0;
		window.Storage.prototype.setItem = function (this: Storage, ...args: [string, string]) {
			writes++;
			return originalSetItem.apply(this, args);
		};
		try {
			dispatchStorageEvent(JSON.stringify({ compactLayout: true }));
			expect(toggle().checked).to.equal(true);
			expect(getPreferences().compactLayout).to.equal(true);
			await sleep(WRITE_WAIT_MS);
			expect(writes).to.equal(0); // remote value is applied, never re-written
		} finally {
			window.Storage.prototype.setItem = originalSetItem;
		}
	});
});
