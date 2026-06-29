// Global test setup: jest-dom matchers + browser API stubs for jsdom.
import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom doesn't implement matchMedia — recharts / framer-motion may probe it.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

// jsdom lacks ResizeObserver — recharts ResponsiveContainer requires it.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// jsdom lacks IntersectionObserver — some lazy components probe it.
if (typeof window !== 'undefined' && !window.IntersectionObserver) {
  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  };
}

// scrollTo / scrollIntoView aren't implemented in jsdom.
if (typeof window !== 'undefined' && !window.scrollTo) {
  window.scrollTo = () => {};
}
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// Block accidental real network calls — tests should mock apiFetch / fetch.
if (typeof globalThis.fetch === 'function') {
  globalThis.fetch = vi.fn(() =>
    Promise.reject(new Error('Real fetch should not be called in tests')),
  );
}

afterEach(() => {
  cleanup();
});
