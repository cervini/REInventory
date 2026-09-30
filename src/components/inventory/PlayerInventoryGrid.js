import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import InventoryItem from './InventoryItem';
import './PlayerInventoryGrid.css';

/**
 * Renders the droppable grid area for a single container. It displays the grid background,
 * an "Empty" message if applicable, and all the `InventoryItem` components within it.
 * @param {object} props - The component props.
 * @param {Array<object>} props.items - The array of item objects in the grid.
 * @param {number} props.gridWidth - The width of the grid in cells.
 * @param {number} props.gridHeight - The height of the grid in cells.
 * @param {string} props.containerId - The ID of the container this grid belongs to.
 * @param {Function} props.onContextMenu - The context menu handler passed down from the parent.
 * @param {string} props.playerId - The ID of the player who owns this grid.
 * @param {Function} props.setGridRef - A function to pass the grid's DOM node ref to the parent.
 * @param {object} props.cellSize - The calculated width and height of a single grid cell.
 * @returns {JSX.Element}
 */
export default function PlayerInventoryGrid({ items, gridWidth, gridHeight, containerId, onContextMenu, playerId, setGridRef, cellSize, isViewerDM }) {
  
  const { setNodeRef, isOver } = useDroppable({ id: `${playerId}|${containerId}|grid` });

  const combinedRef = (node) => {
      setNodeRef(node);
      if (setGridRef) {
        setGridRef(node);
      }
    };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridWidth}, var(--cell-size, 2.5rem))`,
    gridTemplateRows: `repeat(${gridHeight}, var(--cell-size, 2.5rem))`,
    width: `calc(${gridWidth} * var(--cell-size, 2.5rem) + ${gridWidth - 1}px)`,
    height: `calc(${gridHeight} * var(--cell-size, 2.5rem) + ${gridHeight - 1}px)`,
    gap: '1px',
  };

  return (
    // The unnecessary wrapper div has been removed.
    <div
      ref={combinedRef}
      style={gridStyle}
      className={`player-inventory-grid${isOver ? ' player-inventory-grid--over' : ''}`}
    >
      <div className="player-inventory-grid__cells" style={gridStyle}>
        {Array.from({ length: gridWidth * gridHeight }).map((_, index) => (
          <div key={index} className="player-inventory-grid__cell"></div>
        ))}
      </div>
      
      {items?.length === 0 && (
        <div className="player-inventory-grid__empty">
          <p className="player-inventory-grid__empty-label">Empty.</p>
        </div>
      )}
      
      {items?.map(item => (
        <InventoryItem
          key={item.id}
          item={item}
          containerId={containerId}
          onContextMenu={(e, item, source) => onContextMenu(e, item, playerId, source, containerId)}
          playerId={playerId}
          source="grid"
          cellSize={cellSize}
          isViewerDM={isViewerDM}
        />
      ))}
    </div>
  );
}