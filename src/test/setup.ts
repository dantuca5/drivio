import 'fake-indexeddb/auto';

if (typeof window !== 'undefined') {
  // jsdom nu are matchMedia; aplicația îl folosește pentru tema de sistem și „reducere mișcare”.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}
