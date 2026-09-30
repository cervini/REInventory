import { getContainerDropPosition } from '../utils/gridUtils';

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