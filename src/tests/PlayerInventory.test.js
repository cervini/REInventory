import { render, screen } from '@testing-library/react';
import PlayerInventory from '../components/inventory/PlayerInventory';

jest.mock('../components/inventory/DraggableContainerCard', () => ({ container }) =>
  require('react').createElement('div', { 'data-testid': 'container-card' }, container.name));
jest.mock('../components/inventory/ItemTray', () => ({ containerId, items }) =>
  require('react').createElement('div', { 'data-testid': `tray-${containerId}` }, items.length));
jest.mock('../components/inventory/Wallet', () => () => null);
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

test('shows only the shared tray for a loot pile', () => {
  render(<PlayerInventory {...props} isLootPile />);

  expect(screen.queryByText('Adventurer')).not.toBeInTheDocument();
  expect(screen.queryByTestId('container-card')).not.toBeInTheDocument();
  expect(screen.queryByTestId('carried-weight')).not.toBeInTheDocument();
  expect(screen.getByTestId('tray-tray')).toBeInTheDocument();
});