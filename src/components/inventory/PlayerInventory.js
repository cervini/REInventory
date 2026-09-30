import React, { useMemo, useRef, useState } from 'react';
import { ArrowUturnLeftIcon, ChevronDownIcon, Cog6ToothIcon, CursorArrowRaysIcon, HandRaisedIcon, ScaleIcon, ShieldCheckIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import DraggableContainerCard from './DraggableContainerCard';
import ItemTray from './ItemTray';
import Wallet from './Wallet';
import WeightCounter from './WeightCounter';
import './InventoryGrid.css';

export default function PlayerInventory({
  playerId, inventoryData, campaign, playerProfiles, user,
  setEditingSettings, cellSizes, gridRefs, onContextMenu, onToggleEquipped, isEquippedVisible,
  isLootPile = false, onArrangeContainers, isArrangingContainers = false
}) {
  const panRef = useRef(null);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isPanMode, setIsPanMode] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false));
  // We use optional chaining (?.) to prevent errors if inventoryData is not ready.
  const containers = useMemo(() => {
    const list = Object.values(inventoryData?.containers || {});
    return list.sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 0;
      const orderB = b.order !== undefined ? b.order : 0;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
    });
  }, [inventoryData]);
  const isViewerDM = campaign?.dmId === user.uid;
  const isPlayerDM = campaign?.dmId === playerId;

  const totalWeightLbs = useMemo(() => {
    if (!inventoryData) return 0;
    const containerGridItems = containers
      .filter(c => c.trackWeight ?? true)
      .flatMap(c => c.gridItems || []);
    const equippedItems = inventoryData.equippedItems || [];

    // Items on the floor/ground (playerTrayItems) should not count towards encumbrance.
    // Only items in containers and equipped items affect the character's weight.
    const allItems = [...containerGridItems, ...equippedItems];
    return allItems.reduce((total, item) => {
      const weightValue = parseFloat(item.weight);
      if (!isNaN(weightValue)) {
        return total + (weightValue * (item.quantity || 1));
      }
      return total;
    }, 0);
  }, [inventoryData, containers]);

  const startPan = event => {
    if (event.button !== 0 || event.isPrimary === false || panRef.current || (!isPanMode && event.target.closest('.inventory-grid__container-card'))) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    panRef.current = { pointerId: event.pointerId, pointerX: event.clientX, pointerY: event.clientY, camera };
    setIsPanning(true);
  };

  const movePan = event => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setCamera({ x: pan.camera.x + event.clientX - pan.pointerX, y: pan.camera.y + event.clientY - pan.pointerY });
  };

  const endPan = event => {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleCanvasScroll = event => {
    const viewport = event.currentTarget;
    const { scrollLeft, scrollTop } = viewport;
    if (!scrollLeft && !scrollTop) return;
    viewport.scrollLeft = 0;
    viewport.scrollTop = 0;
    setCamera(previous => ({ x: previous.x - scrollLeft, y: previous.y - scrollTop }));
  };

  const handleCanvasKey = event => {
    if (event.target !== event.currentTarget) return;
    const offsets = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
    if (event.key === 'Home') {
      event.preventDefault();
      setCamera({ x: 0, y: 0 });
    } else if (offsets[event.key]) {
      event.preventDefault();
      const [x, y] = offsets[event.key];
      setCamera(previous => ({ x: previous.x + x, y: previous.y + y }));
    }
  };

  // The conditional return now correctly happens AFTER all hooks are called.
  if (!inventoryData) return null;

  const isMyInventory = user.uid === inventoryData.ownerId;
  const characterName = inventoryData.characterName || playerProfiles[playerId]?.displayName || 'Unnamed character';

  return (
    <section className={`inventory-grid__player-inventory${isLootPile ? '' : ' inventory-grid__player-inventory--regular'}${!isLootPile && !isPlayerDM ? ' inventory-grid__player-inventory--character' : ''}`} aria-label={isLootPile ? undefined : isPlayerDM ? 'DM workspace' : `${characterName} inventory`}>

      {/* 1. HIDE HEADER FOR LOOT PILE (No Name, Wallet, or Weight) */}
      {!isLootPile && (
        <div className="inventory-grid__sidebar">
          <div className="inventory-grid__player-header">
            <h3 className="inventory-grid__player-name">{isPlayerDM ? 'DM workspace' : characterName}</h3>
            {isMyInventory && !isPlayerDM && (
              <button
                type="button"
                onClick={() => setEditingSettings({
                  playerId: playerId,
                  currentSettings: inventoryData,
                  isDMInventory: isPlayerDM
                })}
                className="inventory-grid__player-action"
                aria-label={`Inventory settings for ${characterName}`}
                title="Inventory settings"
              >
                <Cog6ToothIcon className="inventory-grid__player-action-icon" aria-hidden="true" />
              </button>
            )}
          </div>
          {!isPlayerDM && (
            <>
              <div className="inventory-grid__player-details">
                <div className="inventory-grid__player-stat" role="group" aria-label="Coin pouch" title="Coin pouch">
                  <Wallet campaignId={campaign.id} inventoryId={playerId} currency={inventoryData.currency} canEdit={isMyInventory} />
                </div>
                <div className="inventory-grid__player-stat inventory-grid__player-stat--weight" role="group" aria-label="Carried weight" title="Carried weight">
                  <ScaleIcon className="inventory-grid__player-action-icon" aria-hidden="true" />
                  <WeightCounter currentWeight={totalWeightLbs} maxWeight={inventoryData.totalMaxWeight || 0} unit={inventoryData.weightUnit || 'lbs'} />
                </div>
              </div>
              <div className="inventory-grid__player-equipment">
                <button
                  type="button"
                  onClick={onToggleEquipped}
                  className="inventory-grid__player-action inventory-grid__equipment-toggle"
                  aria-label={isEquippedVisible ? 'Hide equipped items' : 'Show equipped items'}
                  aria-expanded={isEquippedVisible}
                  aria-controls={`equipped-${playerId}`}
                  title={isEquippedVisible ? 'Hide equipped items' : 'Show equipped items'}
                >
                  <ShieldCheckIcon className="inventory-grid__player-action-icon" aria-hidden="true" />
                  <span>Equipped</span>
                  <ChevronDownIcon className="inventory-grid__equipment-chevron" aria-hidden="true" />
                </button>
                <div id={`equipped-${playerId}`} className={`inventory-grid__equipped${isEquippedVisible ? ' inventory-grid__equipped--visible' : ''}`}>
                  <div className="inventory-grid__equipped-content">
                    <ItemTray
                      items={inventoryData.equippedItems || []}
                      containerId="equipped"
                      onContextMenu={onContextMenu}
                      playerId={playerId}
                      isViewerDM={isViewerDM}
                      emptyMessage="No items equipped."
                      source="equipped"
                      layout="horizontal"
                      disabled={!isEquippedVisible}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Main Content (Containers + Tray) */}
      <div className={isLootPile ? '' : 'inventory-grid__player-content'}>
        <div className="inventory-grid__player-sections">

          {/* Grids (Used by players) */}
          {!isPlayerDM && !isLootPile && (
            <div className="inventory-grid__bag-workspace">
              <div className="inventory-grid__bag-toolbar">
                <h4 className="inventory-grid__floor-title">Bags</h4>
                <div className="inventory-grid__bag-actions">
                  <div className="inventory-grid__canvas-modes" role="group" aria-label={`Canvas mode for ${characterName}`}>
                    <button type="button" className="inventory-grid__tool" aria-pressed={!isPanMode} aria-label={`Interact with items for ${characterName}`} title="Interact with items" onClick={() => setIsPanMode(false)}><CursorArrowRaysIcon className="inventory-grid__tool-icon" aria-hidden="true" /></button>
                    <button type="button" className="inventory-grid__tool" aria-pressed={isPanMode} aria-label={`Move canvas for ${characterName}`} title="Move canvas" onClick={() => setIsPanMode(true)}><HandRaisedIcon className="inventory-grid__tool-icon" aria-hidden="true" /></button>
                  </div>
                  <button type="button" className="inventory-grid__tool" onClick={() => setCamera({ x: 0, y: 0 })} aria-label={`Reset canvas view for ${characterName}`} title="Reset canvas view">
                    <ArrowUturnLeftIcon className="inventory-grid__tool-icon" aria-hidden="true" />
                  </button>
                {(isMyInventory || isViewerDM) && onArrangeContainers && (
                  <button type="button" className="inventory-grid__arrange" onClick={async () => {
                    if (await onArrangeContainers(containers)) setCamera({ x: 0, y: 0 });
                  }} disabled={isArrangingContainers || containers.length === 0} aria-label={`Arrange bags for ${characterName}`} title="Arrange bags">
                    <Squares2X2Icon className="inventory-grid__player-action-icon" aria-hidden="true" />
                    <span>{isArrangingContainers ? 'Arranging...' : 'Arrange bags'}</span>
                  </button>
                )}
                </div>
              </div>
              <div
                className={`inventory-grid__canvas-viewport${isPanning ? ' inventory-grid__canvas-viewport--panning' : ''}${isPanMode ? ' inventory-grid__canvas-viewport--move' : ''}`}
                role="region"
                aria-label={`${characterName} bag canvas`}
                tabIndex={0}
                onPointerDownCapture={startPan}
                onTouchStartCapture={event => { if (panRef.current) event.stopPropagation(); }}
                onContextMenuCapture={event => { if (isPanMode) { event.preventDefault(); event.stopPropagation(); } }}
                onPointerMove={movePan}
                onPointerUp={endPan}
                onPointerCancel={endPan}
                onLostPointerCapture={endPan}
                onScroll={handleCanvasScroll}
                onKeyDown={handleCanvasKey}
                style={{ backgroundPosition: `${camera.x}px ${camera.y}px` }}
              >
                <div id={`canvas-${playerId}`} className="inventory-grid__canvas" style={{ transform: `translate(${camera.x}px, ${camera.y}px)` }}>
                  {containers.map(container => (
                    <DraggableContainerCard
                      key={container.id}
                      container={container}
                      playerId={playerId}
                      isViewerDM={isViewerDM}
                      onContextMenu={onContextMenu}
                      cellSizes={cellSizes}
                      gridRefs={gridRefs}
                      isDraggable={!isPanMode && (isMyInventory || isViewerDM)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tray (Used by everyone) */}
          <div className="inventory-grid__floor">
            {/* 2. CHANGE TRAY LABEL: Hide 'Floor/Ground' for loot pile */}
            {!isLootPile && !isPlayerDM && (
              <h4 className="inventory-grid__floor-title">Floor / Ground</h4>
            )}

            <div className={`inventory-grid__tray${isLootPile ? ' inventory-grid__tray--loot' : ''}`}>
              <ItemTray
                items={inventoryData.trayItems || []}
                containerId="tray"
                onContextMenu={onContextMenu}
                playerId={playerId}
                isViewerDM={isViewerDM}
                emptyMessage={isLootPile ? "Empty" : isPlayerDM ? "No managed items." : "There is nothing on the ground."}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}