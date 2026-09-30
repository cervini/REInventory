import { render, screen } from '@testing-library/react';
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
jest.mock('../components/inventory/ItemTray', () => ({ containerId, items }) =>
  require('react').createElement('div', { 'data-testid': `tray-${containerId}` }, items.length));
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

  rerender(<PlayerInventory
    {...props}
    playerId="dm"
    user={{ uid: 'dm' }}
    inventoryData={{ ...inventoryData, ownerId: 'dm' }}
  />);
  expect(container.querySelectorAll('.inventory-grid__player-action')).toHaveLength(0);
  expect(screen.queryByTestId('wallet')).not.toBeInTheDocument();
  expect(screen.getByText('Adventurer')).toBeInTheDocument();
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

test('floating inventory tools give players named item actions without DM controls', () => {
  const onOpenCompendium = jest.fn();
  const onAddItem = jest.fn();
  render(<InventoryActions isDM={false} onOpenCompendium={onOpenCompendium} onAddItem={onAddItem} />);
  expect(screen.getByRole('group', { name: 'Inventory tools' })).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'Inventory tools' })).toHaveClass('inventory-grid__tools--floating');
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

test('floating inventory tools preserve the merchant action for the DM', () => {
  const onCreateMerchant = jest.fn();
  render(<InventoryActions isDM onOpenCompendium={jest.fn()} onAddItem={jest.fn()} onCreateMerchant={onCreateMerchant} />);
  userEvent.click(screen.getByRole('button', { name: 'Create Merchant' }));
  expect(onCreateMerchant).toHaveBeenCalledTimes(1);
  expect(screen.getAllByRole('button')).toHaveLength(3);
});