import { arrangeContainerPositions, getContainerDropPosition } from '../utils/gridUtils';
test('arranges bags into rows within the visible workspace', () => {
  expect(arrangeContainerPositions([
    { id: 'pack', width: 200, height: 160 },
    { id: 'pouch', width: 100, height: 80 },
    { id: 'chest', width: 250, height: 120 },
  ], 400)).toEqual([
    { id: 'pack', x: 16, y: 16 },
    { id: 'pouch', x: 232, y: 16 },
    { id: 'chest', x: 16, y: 192 },
  ]);
});

test('keeps oversized bags reachable and starts the next bag on a new row', () => {
  expect(arrangeContainerPositions([
    { id: 'large', width: 500, height: 240 },
    { id: 'small', width: 100, height: 80 },
  ], 320)).toEqual([
    { id: 'large', x: 16, y: 16 },
    { id: 'small', x: 16, y: 272 },
  ]);
  expect(arrangeContainerPositions([], 320)).toEqual([]);
});

const canvas = (left, top) => ({
  getBoundingClientRect: () => ({ left, top }),
  clientLeft: 1,
  clientTop: 1,
  clientWidth: 600,
  clientHeight: 800,
});

test('keeps a bag handle inside the canvas when dropped above its top edge', () => {
  expect(getContainerDropPosition(canvas(100, 200), {
    left: 130, top: 198, width: 200, height: 300,
  })).toEqual({ x: 29, y: 0, wasClamped: true });
});

test('uses the visible bag position after the page scrolls', () => {
  const position = getContainerDropPosition(canvas(100, -150), {
    left: 140, top: 120, width: 200, height: 300,
  });
  expect(position).toEqual({ x: 39, y: 269, wasClamped: false });
  expect(getContainerDropPosition(canvas(100, 200), {
    left: 140, top: 470, width: 200, height: 300,
  })).toEqual(position);
});

test('keeps the entire bag within the canvas at its right and bottom edges', () => {
  expect(getContainerDropPosition(canvas(100, 200), {
    left: 650, top: 900, width: 200, height: 300,
  })).toEqual({ x: 400, y: 500, wasClamped: true });
});

test('unbounded bag coordinates allow negative positions and positions past the viewport', () => {
  expect(getContainerDropPosition(canvas(100, 200), {
    left: -50, top: 50, width: 200, height: 300,
  }, { unbounded: true })).toEqual({ x: -151, y: -151, wasClamped: false });
  expect(getContainerDropPosition(canvas(-300, -400), {
    left: 12000, top: 8000, width: 200, height: 300,
  }, { unbounded: true })).toEqual({ x: 12299, y: 8399, wasClamped: false });
});