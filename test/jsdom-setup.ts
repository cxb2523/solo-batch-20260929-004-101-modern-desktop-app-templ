/** @file browser-environment shim so component tests can run under plain mocha */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'http://localhost/',
	pretendToBeVisual: true
});

const { window } = dom;

function expose(key: string, value: unknown) {
	Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

expose('window', window);
for (const key of [
	'document', 'localStorage', 'sessionStorage', 'navigator', 'location',
	'Event', 'EventTarget', 'CustomEvent', 'StorageEvent', 'KeyboardEvent', 'MouseEvent',
	'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'DocumentFragment',
	'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame',
	'MutationObserver', 'Storage', 'CustomEvent'
]) {
	if ((window as any)[key] !== undefined) expose(key, (window as any)[key]);
}

// jsdom does not implement matchMedia; Mantine's color-scheme handling needs it
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: (query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: () => { },
		removeListener: () => { },
		addEventListener: () => { },
		removeEventListener: () => { },
		dispatchEvent: () => false
	})
});

class ResizeObserverStub {
	observe() { }
	unobserve() { }
	disconnect() { }
}
Object.defineProperty(window, 'ResizeObserver', { writable: true, value: ResizeObserverStub });
expose('ResizeObserver', ResizeObserverStub);

// tell React 19 that tests run inside act()
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
