/**
 * Checks if an item is or would be out of the grid bounds
 * @param {number} X The X coordinate (considering the top leftest tile) where the item is placed
 * @param {number} Y The Y coordinate (considering the top leftest tile) where the item is placed
 * @param {object} item The item beingo considered
 * @param {number} gridWidth The width (in tiles) of the grid where `item` is placed on
 * @param {number} gridHeight The height (in tiles) of the grid where `item` is placed on
 * @returns {boolean} true if `item` has at least a tile out of the inventory
 */
export function outOfBounds(X, Y, item, gridWidth, gridHeight) {
  if (X < 0 || X > gridWidth - item.w || Y < 0 || Y > gridHeight - item.h) {
    return true;
  }
  return false;
}

/**
 * Returns the coordinates of all the tiles occupied by an item
 * @param {number} X The X coordinate (considering the top leftest tile) where the item is placed
 * @param {number} Y The Y coordinate (considering the top leftest tile) where the item is placed 
 * @param {number} W The width of the item in tiles
 * @param {number} H The height of the item in tiles
 * @returns {Set.string} A set containing the coordinate of all the tiles occupied by the item
 */
export function occupiedTiles(X, Y, W, H) {
    let set = new Set();
    for (let i = 0; i < W; i++) for (let j = 0; j < H; j++) set.add(`${X + i},${Y + j}`);
    return set;
}

/**
 * Checks if two items would occupy at least one tile concurrently
 * @param {number} X The X coordinate (considering the top leftest tile) where the item is placed
 * @param {number} Y The Y coordinate (considering the top leftest tile) where the item is placed 
 * @param {object} activeItem The first item (ideally the one being dropped)
 * @param {object} passiveItem The second item (ideally the one on the grid)
 * @returns {boolean} true if `activeItem` is being dropped on at least one tile of `passiveItem`
 */
export function onOtherItem(X, Y, activeItem, passiveItem) {
    let set1 = occupiedTiles(X, Y, activeItem.w, activeItem.h);
    let set2 = occupiedTiles(passiveItem.x, passiveItem.y, passiveItem.w, passiveItem.h);
    // If the two sets have at least one tile in common the item are one "on top of" the other
    for (const tile of set1) { if (set2.has(tile)) return true; }
    return false;
}

/**
 * Finds the first available top-left coordinate (x, y) in a grid where a new
 * item can be placed without colliding with existing items.
 * @param {object[]} items An array of existing items already on the grid.
 * @param {object} newItem The new item to find a slot for. Must have `w` and `h` properties.
 * @param {number} gridWidth The total width of the grid.
 * @param {number} gridHeight The total height of the grid.
 * @returns {{x: number, y: number} | null} An object with `{x, y}` coordinates for the first available slot, or `null` if no slot is found.
 */
export function findFirstAvailableSlot(items, newItem, gridWidth, gridHeight) {
  // Iterate through every possible top-left position for the new item.
  for (let y = 0; y <= gridHeight - newItem.h; y++) {
    for (let x = 0; x <= gridWidth - newItem.w; x++) {
      // Check if placing the new item at (x, y) would overlap with any existing item.
      const isColliding = items.some(existingItem =>
        onOtherItem(x, y, newItem, existingItem)
      );
      // If there's no collision, we've found our slot.
      if (!isColliding) {
        return { x, y };
      }
    }
  }
  // If the loops complete without finding a spot, no slot is available.
  return null;
}

export function arrangeContainerPositions(containers, availableWidth, gap = 16) {
  let x = gap;
  let y = gap;
  let rowHeight = 0;
  return containers.map(container => {
    if (x > gap && x + container.width + gap > availableWidth) {
      x = gap;
      y += rowHeight + gap;
      rowHeight = 0;
    }
    const position = { id: container.id, x, y };
    x += container.width + gap;
    rowHeight = Math.max(rowHeight, container.height);
    return position;
  });
}

export function getContainerDropPosition(canvasElement, overlayRect, { unbounded = false } = {}) {
  const canvasRect = canvasElement.getBoundingClientRect();
  const maxX = Math.max(0, canvasElement.clientWidth - overlayRect.width);
  const maxY = Math.max(0, canvasElement.clientHeight - overlayRect.height);
  const x = overlayRect.left - canvasRect.left - canvasElement.clientLeft;
  const y = overlayRect.top - canvasRect.top - canvasElement.clientTop;
  if (unbounded) return { x, y, wasClamped: false };
  const boundedX = Math.max(0, Math.min(x, maxX));
  const boundedY = Math.max(0, Math.min(y, maxY));

  return { x: boundedX, y: boundedY, wasClamped: boundedX !== x || boundedY !== y };
}