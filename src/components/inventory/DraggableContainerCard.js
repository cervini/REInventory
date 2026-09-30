import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import PlayerInventoryGrid from './PlayerInventoryGrid';
import './InventoryGrid.css';

export default function DraggableContainerCard({ container, playerId, isViewerDM, onContextMenu, cellSizes, gridRefs, isDraggable }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${playerId}|${container.id}|container`,
    data: { type: 'container', playerId, container },
    disabled: !isDraggable
  });

  const style = {
    position: 'absolute',
    left: container.x || 0,
    top: container.y || 0,
    transform: transform ? CSS.Translate.toString(transform) : undefined,
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 50 : 10,
  };

  return (
    <div
      id={`container-card-${playerId}-${container.id}`}
      ref={setNodeRef}
      style={style}
      className="inventory-grid__container-card"
    >
      <div className="inventory-grid__container-card-header">
        <div
          className="inventory-grid__container-card-handle"
          {...(isDraggable ? { ...attributes, ...listeners } : {})}
          title={isDraggable ? "Drag to Move" : undefined}
        >
          {isDraggable && (
            <div className="inventory-grid__container-card-grip">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="inventory-grid__container-card-grip-icon">
                <path fillRule="evenodd" d="M9 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm7.5-15a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm0 7.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <h3 className="inventory-grid__container-card-name">{container.name}</h3>
        </div>
      </div>
      <div className="inventory-grid__container-card-grid">
        <PlayerInventoryGrid
          items={container.gridItems || []}
          gridWidth={container.gridWidth}
          gridHeight={container.gridHeight}
          containerId={container.id}
          onContextMenu={onContextMenu}
          playerId={playerId}
          setGridRef={(node) => (gridRefs.current[container.id] = node)}
          cellSize={cellSizes[container.id]}
          isViewerDM={isViewerDM}
        />
      </div>
    </div>
  );
}