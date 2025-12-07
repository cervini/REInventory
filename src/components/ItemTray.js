import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import InventoryItem from './InventoryItem';


/**
 * Renders a droppable area for items that are not in a grid (e.g., on the floor).
 * It displays a list of items in a flexible row.
 * @param {object} props - The component props.
 * @param {string} props.playerId - The ID of the player who owns this tray.
 * @param {Array<object>} props.items - The array of item objects in the tray.
 * @param {Function} props.onContextMenu - The context menu handler.
 * @param {string} props.containerId - The ID representing this tray (e.g., 'tray', 'equipped', or a DM container ID).
 * @param {string} [props.source='tray'] - The source type for items in this tray.
 * @param {string} [props.emptyMessage] - A custom message to show when the tray is empty.
 * @param {boolean} [props.disabled=false] - Whether the droppable area is disabled.
 * @returns {JSX.Element}
 */
export default function ItemTray({ playerId, items, onContextMenu, isDM, containerId, isViewerDM, emptyMessage, source = 'tray', layout = 'horizontal', disabled = false }) {

    const { setNodeRef, isOver } = useDroppable({
      id: `${playerId}|${containerId}|${source}`,
      disabled,
    });

   return (
      <div 
        ref={setNodeRef} 
        className={`flex gap-2 rounded-md transition-colors duration-200 ${isOver ? 'bg-accent/10' : ''} ${layout === 'vertical' ? 'flex-col' : 'flex-wrap items-center min-h-[6rem]'}`}
        style={{ pointerEvents: disabled ? 'none' : 'auto' }} // Extra safety
      >
        {items.length === 0 && (
          <p className="text-text-muted text-sm px-4 font-fantasy italic w-full text-center">{emptyMessage || 'There is nothing on the ground.'}</p>
        )}
        {items.map(item => (
          <div key={item.id} className="w-20 h-20 flex-shrink-0">
            <InventoryItem
              item={item}
              containerId={containerId}
              onContextMenu={(e, item, itemSource) => !disabled && onContextMenu(e, item, playerId, itemSource, containerId)}
              playerId={playerId}
              isDM={isDM}
              source={source}
              isViewerDM={isViewerDM}
              cellSize={{ width: 80, height: 80 }}
              disabled={disabled}
            />
          </div>
        ))}
      </div>
  );
}