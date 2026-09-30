import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { getColorForItemType } from '../../utils/itemUtils';
import { generateItemTooltip } from '../../utils/itemUtils';
import { useLongPress } from '../../hooks/useLongPress';
import DynamicIcon from '../icons/DynamicIcon';
import './InventoryItem.css';

/**
 * Renders a single draggable and droppable inventory item.
 * Now supports a 'disabled' prop to prevent interaction when hidden.
 */
export default function InventoryItem({ item, onContextMenu, playerId, source, cellSize, containerId, isViewerDM, disabled = false }) {
  
  const { attributes, listeners, setNodeRef: setDraggableNodeRef, transform, isDragging } = useDraggable({
    id: item.id,
    data: { ownerId: playerId, item, source, containerId },
    disabled: disabled, // <--- Disable dragging
  });

  const { setNodeRef: setDroppableNodeRef } = useDroppable({
    id: item.id,
    data: { ownerId: playerId, item, source, containerId },
    disabled: disabled, // <--- Disable dropping onto this item
  });

  const longPressProps = useLongPress(
    (e) => {
      if (!disabled) onContextMenu(e, item, source);
    },
    500
  );

  const style = {
    gridColumn: source === 'grid' ? `${item.x + 1} / span ${item.w}` : undefined,
    gridRow: source === 'grid' ? `${item.y + 1} / span ${item.h}` : undefined,
    
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,

    visibility: isDragging ? 'hidden' : 'visible',
    
    zIndex: isDragging ? 20 : 10,
    width: (source === 'tray' || source === 'equipped') ? '100%' : undefined,
    height: (source === 'tray' || source === 'equipped') ? '100%' : undefined,
    
    // Optional: visual cue that it's disabled (though usually it's hidden anyway)
    opacity: disabled ? 0.5 : 1,
    pointerEvents: disabled ? 'none' : 'auto', 
  };

  const effectiveCellWidth = cellSize?.width > 0 ? cellSize.width : 80;
  const effectiveCellHeight = cellSize?.height > 0 ? cellSize.height : 80;
  const isTextVisible = effectiveCellWidth * item.w > 20 && effectiveCellHeight * item.h > 20;

  return (
    <div
      ref={(node) => {
        setDraggableNodeRef(node);
        setDroppableNodeRef(node);
      }}
      style={style}
      className="inventory-item"
      // Only show tooltip if not disabled
      data-tooltip-id={disabled ? undefined : "item-tooltip"}
      data-tooltip-html={disabled ? undefined : generateItemTooltip(item, isViewerDM)}
      {...longPressProps}
    >
      <div
        {...listeners}
        {...attributes}
        className={`${getColorForItemType(item.type)} inventory-item__surface`}
      >
        <div className="inventory-item__content">
          {/* Render the icon */}
          {item.icon && (
            <div className="inventory-item__icon">
              <DynamicIcon iconName={item.icon} className="inventory-item__icon-image" />
            </div>
          )}

          {isTextVisible && (
            <span className="inventory-item__name">
              {item.name}
            </span>
          )}
        </div>
        
        {item.stackable && item.quantity > 1 && isTextVisible && (
          <span className="inventory-item__quantity" style={{ WebkitTextStroke: '1px hsl(var(--color-background))' }}>
            {item.quantity}
          </span>
        )}
      </div>
    </div>
  );
}