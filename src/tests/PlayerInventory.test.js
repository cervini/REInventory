import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlayerInventory from '../components/inventory/PlayerInventory';
import { InventoryItemVisual } from '../components/inventory/InventoryItem';
import InventoryActions from '../components/inventory/InventoryActions';

jest.mock('../components/icons/DynamicIcon', () => ({
  __esModule: true,
  default: ({ className }) => require('react').createElement('svg', { className }),
}));
jest.mock('../components/inventory/DraggableContainerCard', () => ({ container }) =>
  require('react').createElement('div', { 'data-testid': 'container-card' }, container.name));
jest.mock('../components/inventory/ItemTray', () => ({ containerId, items, emptyMessage }) =>
  require('react').createElement('div', { 'data-testid': `tray-${containerId}`, 'data-empty-message': emptyMessage }, items.length));
jest.mock('../components/inventory/Wallet', () => () =>
  require('react').createElement('span', { 'data-testid': 'wallet' }));
jest.mock('../components/inventory/WeightCounter', () => ({ currentWeight }) =>
  require('react').createElement('span', { 'data-testid': 'carried-weight' }, currentWeight));

const inventoryData = {
  ownerId: 'player',
  characterName: 'Adventurer',
  containers: {
    pack: { id: 'pack', name: 'Pack', order: 2, gridItems: [{ weight: '2', quantity: 3 }] },
    chest: { id: 'chest', name: 'Chest', order: 1, trackWeight: false, gridItems: [{ weight: '100' }] },
  },
  equippedItems: [{ weight: '1', quantity: 2 }],
  trayItems: [{ weight: '50' }],
};

const props = {
  playerId: 'player',
  inventoryData,
  campaign: { id: 'campaign', dmId: 'dm' },
  playerProfiles: {},
  user: { uid: 'player' },
  setEditingSettings: () => {},
  cellSizes: {},
  gridRefs: { current: {} },
  onContextMenu: () => {},
  onToggleEquipped: () => {},
  isEquippedVisible: true,
};

test('sorts containers and counts only carried and equipped weight', () => {
  render(<PlayerInventory {...props} />);

  expect(screen.getAllByTestId('container-card').map(card => card.textContent)).toEqual(['Chest', 'Pack']);
  expect(screen.getByTestId('carried-weight')).toHaveTextContent('8');
  expect(screen.getByTestId('tray-equipped')).toBeInTheDocument();
  expect(screen.getByTestId('tray-tray')).toBeInTheDocument();
});

test('hides wallet and settings on the DM inventory but keeps them on a player inventory', () => {
  const { container, rerender } = render(<PlayerInventory {...props} />);
  expect(container.querySelectorAll('.inventory-grid__player-action')).toHaveLength(2);
  expect(screen.getByTestId('wallet')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Floor / Ground' })).toBeInTheDocument();

  rerender(<PlayerInventory
    {...props}
    playerId="dm"
    user={{ uid: 'dm' }}
    inventoryData={{ ...inventoryData, ownerId: 'dm' }}
  />);
  expect(container.querySelectorAll('.inventory-grid__player-action')).toHaveLength(0);
  expect(screen.queryByTestId('wallet')).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'DM workspace' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'DM workspace' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Managed items' })).not.toBeInTheDocument();
  expect(screen.queryByText('Floor / Ground')).not.toBeInTheDocument();
  expect(screen.getByTestId('tray-tray')).toHaveAttribute('data-empty-message', 'No managed items.');
  expect(screen.getByTestId('tray-tray')).toBeInTheDocument();
});

test('shows only the shared tray for a loot pile', () => {
  render(<PlayerInventory {...props} isLootPile />);

  expect(screen.queryByText('Adventurer')).not.toBeInTheDocument();
  expect(screen.queryByTestId('container-card')).not.toBeInTheDocument();
  expect(screen.queryByTestId('carried-weight')).not.toBeInTheDocument();
  expect(screen.getByTestId('tray-tray')).toBeInTheDocument();
});

test('character controls identify settings and expose the equipment drawer state', () => {
  const onToggleEquipped = jest.fn();
  const setEditingSettings = jest.fn();
  const { rerender } = render(<PlayerInventory {...props} onToggleEquipped={onToggleEquipped} setEditingSettings={setEditingSettings} />);
  expect(screen.getByRole('region', { name: 'Adventurer inventory' })).toBeInTheDocument();
  const equipped = screen.getByRole('button', { name: 'Hide equipped items' });
  expect(equipped).toHaveAttribute('aria-expanded', 'true');
  expect(document.getElementById(equipped.getAttribute('aria-controls'))).toHaveClass('inventory-grid__equipped--visible');
  userEvent.click(equipped);
  expect(onToggleEquipped).toHaveBeenCalledTimes(1);
  userEvent.click(screen.getByRole('button', { name: 'Inventory settings for Adventurer' }));
  expect(setEditingSettings).toHaveBeenCalledWith({ playerId: 'player', currentSettings: inventoryData, isDMInventory: false });
  rerender(<PlayerInventory {...props} isEquippedVisible={false} />);
  expect(screen.getByRole('button', { name: 'Show equipped items' })).toHaveAttribute('aria-expanded', 'false');
});

test('keeps item icons, clipped names, and quantities in drag previews', () => {
  const item = { name: 'Long item name', type: 'misc', icon: 'bag', stackable: true, quantity: 3 };
  const { container } = render(<div className="inventory-item"><InventoryItemVisual item={item} isTextVisible /></div>);

  expect(container.querySelector('.inventory-item__icon-image')).toBeInTheDocument();
  expect(screen.getByText('Long item name')).toHaveClass('inventory-item__name');
  expect(screen.getByText('3')).toHaveClass('inventory-item__quantity');
});

test('toolbar inventory tools give players named item actions without DM controls', () => {
  const onOpenCompendium = jest.fn();
  const onAddItem = jest.fn();
  render(<InventoryActions isDM={false} onOpenCompendium={onOpenCompendium} onAddItem={onAddItem} />);
  expect(screen.getByRole('group', { name: 'Inventory tools' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Inventory tools' })).not.toHaveClass('inventory-grid__tools--floating');
  userEvent.click(screen.getByRole('button', { name: 'Add Item from Compendium' }));
  userEvent.click(screen.getByRole('button', { name: 'Create New Item' }));
  expect(onOpenCompendium).toHaveBeenCalledTimes(1);
  expect(onAddItem).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Create Merchant' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Manage campaign' })).not.toBeInTheDocument();
  screen.getAllByRole('button').forEach(button => {
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('title');
  });
});

test('toolbar inventory tools preserve the merchant action for the DM', () => {
  const onCreateMerchant = jest.fn();
  render(<InventoryActions isDM onOpenCompendium={jest.fn()} onAddItem={jest.fn()} onCreateMerchant={onCreateMerchant} />);
  userEvent.click(screen.getByRole('button', { name: 'Create Merchant' }));
  expect(onCreateMerchant).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('button')).toHaveLength(3);
});

test('character controls and equipment share a rail beside the bag workspace', () => {
  const onArrangeContainers = jest.fn();
  const { container, rerender } = render(<PlayerInventory {...props} onArrangeContainers={onArrangeContainers} />);
  const rail = container.querySelector('.inventory-grid__sidebar');
  expect(rail).toContainElement(screen.getByRole('heading', { name: 'Adventurer' }));
  expect(rail).toContainElement(screen.getByTestId('wallet'));
  expect(rail).toContainElement(screen.getByRole('group', { name: 'Coin pouch' }));
  expect(rail).toContainElement(screen.getByRole('group', { name: 'Carried weight' }));
  expect(screen.queryByText('Coin pouch')).not.toBeInTheDocument();
  expect(screen.queryByText('Carried weight')).not.toBeInTheDocument();
  expect(rail).toContainElement(screen.getByTestId('tray-equipped'));
  expect(rail).toContainElement(screen.getByRole('button', { name: 'Inventory settings for Adventurer' }));
  expect(container.querySelector('.inventory-grid__canvas-viewport')).toContainElement(container.querySelector('#canvas-player'));
  userEvent.click(screen.getByRole('button', { name: 'Arrange bags for Adventurer' }));
  expect(onArrangeContainers).toHaveBeenCalledWith([inventoryData.containers.chest, inventoryData.containers.pack]);
  rerender(<PlayerInventory {...props} user={{ uid: 'other' }} onArrangeContainers={onArrangeContainers} />);
  expect(screen.queryByRole('button', { name: 'Arrange bags for Adventurer' })).not.toBeInTheDocument();
});

test('pans the view without changing bags and supports keyboard and reset controls', () => {
  const { container } = render(<PlayerInventory {...props} />);
  const viewport = screen.getByRole('region', { name: 'Adventurer bag canvas' });
  const world = container.querySelector('#canvas-player');
  const pointer = (type, clientX, clientY) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
    Object.assign(event, { pointerType: 'mouse', pointerId: 1 });
    fireEvent(viewport, event);
  };
  pointer('pointerdown', 200, 100);
  pointer('pointermove', 350, 160);
  expect(world).toHaveStyle({ transform: 'translate(150px, 60px)' });
  pointer('pointerup', 350, 160);
  expect(viewport).not.toHaveClass('inventory-grid__canvas-viewport--panning');
  fireEvent.keyDown(viewport, { key: 'ArrowRight' });
  expect(world).toHaveStyle({ transform: 'translate(70px, 60px)' });
  userEvent.click(screen.getByRole('button', { name: 'Reset canvas view for Adventurer' }));
  expect(world).toHaveStyle({ transform: 'translate(0px, 0px)' });
  viewport.scrollLeft = 320;
  viewport.scrollTop = 80;
  fireEvent.scroll(viewport);
  expect(world).toHaveStyle({ transform: 'translate(-320px, -80px)' });
  expect(viewport.scrollLeft).toBe(0);
  expect(viewport.scrollTop).toBe(0);
  userEvent.click(screen.getByRole('button', { name: 'Reset canvas view for Adventurer' }));
  expect(world).toHaveStyle({ transform: 'translate(0px, 0px)' });
  expect(inventoryData.containers.pack).not.toHaveProperty('x');
  expect(inventoryData.containers.chest).not.toHaveProperty('y');
});

test('touch swipes pan empty canvas and cancellation releases the gesture', () => {
  const { container } = render(<PlayerInventory {...props} />);
  const viewport = screen.getByRole('region', { name: 'Adventurer bag canvas' });
  const world = container.querySelector('#canvas-player');
  const pointer = (type, clientX, clientY, isPrimary = true) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
    Object.assign(event, { pointerType: 'touch', pointerId: 2, isPrimary });
    fireEvent(viewport, event);
  };
  pointer('pointerdown', 250, 250);
  pointer('pointermove', 70, 100);
  expect(world).toHaveStyle({ transform: 'translate(-180px, -150px)' });
  pointer('pointercancel', 70, 100);
  expect(viewport).not.toHaveClass('inventory-grid__canvas-viewport--panning');
  pointer('pointermove', 0, 0);
  expect(world).toHaveStyle({ transform: 'translate(-180px, -150px)' });
  pointer('pointerdown', 0, 0, false);
  pointer('pointermove', 100, 100, false);
  expect(world).toHaveStyle({ transform: 'translate(-180px, -150px)' });
});

test('move mode pans from a bag without activating its drag handler', () => {
  const { container } = render(<PlayerInventory {...props} />);
  const viewport = screen.getByRole('region', { name: 'Adventurer bag canvas' });
  const world = container.querySelector('#canvas-player');
  const bag = screen.getAllByTestId('container-card')[0];
  bag.classList.add('inventory-grid__container-card');
  const activateDrag = jest.fn();
  bag.addEventListener('pointerdown', activateDrag);
  const pointer = (target, type, clientX, clientY) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX, clientY });
    Object.assign(event, { pointerType: 'touch', pointerId: 3, isPrimary: true });
    fireEvent(target, event);
  };
  userEvent.click(screen.getByRole('button', { name: 'Move canvas for Adventurer' }));
  pointer(bag, 'pointerdown', 200, 200);
  pointer(viewport, 'pointermove', 100, 50);
  pointer(viewport, 'pointerup', 100, 50);
  expect(world).toHaveStyle({ transform: 'translate(-100px, -150px)' });
  expect(activateDrag).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Interact with items for Adventurer' }));
  pointer(bag, 'pointerdown', 200, 200);
  expect(activateDrag).toHaveBeenCalledTimes(1);
  expect(viewport).not.toHaveClass('inventory-grid__canvas-viewport--panning');
});