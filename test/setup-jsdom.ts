/** @file jsdom globals for component tests; must be imported before any React/app module */
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
	url: 'http://localhost/',
	pretendToBeVisual: true,
});

const { window } = dom;
const global = globalThis as any;

function setGlobal(key: string, value: unknown) {
	// node 21+ defines some globals (e.g. navigator) as getter-only
	Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
}

global.window = window;
global.document = window.document;
setGlobal('navigator', window.navigator);
setGlobal('localStorage', window.localStorage);
setGlobal('StorageEvent', window.StorageEvent);
setGlobal('CustomEvent', window.CustomEvent);
setGlobal('getComputedStyle', window.getComputedStyle.bind(window));
setGlobal('requestAnimationFrame', window.requestAnimationFrame?.bind(window) ?? ((cb: FrameRequestCallback) => setTimeout(cb, 0)));
setGlobal('cancelAnimationFrame', window.cancelAnimationFrame?.bind(window) ?? clearTimeout);

// Mantine color scheme handling needs matchMedia, which jsdom does not implement
window.matchMedia = window.matchMedia ?? ((query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: () => { },
	removeListener: () => { },
	addEventListener: () => { },
	removeEventListener: () => { },
	dispatchEvent: () => false,
} as MediaQueryList));
global.matchMedia = window.matchMedia;

global.ResizeObserver = global.ResizeObserver ?? class {
	observe() { }
	unobserve() { }
	disconnect() { }
};

global.IS_REACT_ACT_ENVIRONMENT = true;
