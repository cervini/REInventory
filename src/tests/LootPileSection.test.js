import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LootPileSection from '../components/inventory/LootPileSection';
import MerchantSection from '../components/inventory/MerchantSection';
import CampaignLayout from '../components/campaign/CampaignLayout';
import { doc, updateDoc } from 'firebase/firestore';

jest.mock('../components/inventory/PlayerInventory', () => () => <div data-testid="loot-inventory" />);
jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(() => 'campaign-ref'),
  updateDoc: jest.fn(),
}));

const props = {
  lootPileData: { characterName: 'The Loot Pile', isVisibleToPlayers: true },
  isDM: true,
  isExpanded: true,
  onUpdateName: jest.fn(),
  onToggleVisibility: jest.fn(),
  onToggleExpanded: jest.fn(),
  campaign: { id: 'campaign', dmId: 'dm' },
  user: { uid: 'dm' },
  cellSizes: {},
  gridRefs: { current: {} },
  onContextMenu: jest.fn(),
};

test('DM controls retain their name, visibility, and collapse callbacks', () => {
  render(<LootPileSection {...props} />);

  fireEvent.blur(screen.getByDisplayValue('The Loot Pile'), { target: { value: 'Found Treasure' } });
  fireEvent.click(screen.getByTitle('Hide from players'));
  fireEvent.click(screen.getByTitle('Collapse'));

  expect(props.onUpdateName).toHaveBeenCalledWith('Found Treasure');
  expect(props.onToggleVisibility).toHaveBeenCalledTimes(1);
  expect(props.onToggleExpanded).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('loot-inventory')).toBeInTheDocument();
});

test('players see the title without DM-only controls', () => {
  render(<LootPileSection {...props} isDM={false} isExpanded={false} />);

  expect(screen.getByRole('heading', { name: 'The Loot Pile' })).toBeInTheDocument();
  expect(screen.queryByTitle('Hide from players')).not.toBeInTheDocument();
  expect(screen.getByTitle('Expand')).toBeInTheDocument();
  expect(screen.getByTitle('Expand')).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByTestId('loot-inventory')).not.toBeInTheDocument();
});

test('loot counts stack quantities and restores blank names without extra writes', () => {
  const onUpdateName = jest.fn();
  render(<LootPileSection {...props} onUpdateName={onUpdateName} lootPileData={{ ...props.lootPileData, trayItems: [{ quantity: 3 }, {}] }} />);
  expect(screen.getByText('4 items')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Visible to players' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Visible to players');
  const name = screen.getByLabelText('Loot pile name');
  fireEvent.change(name, { target: { value: '   ' } });
  fireEvent.blur(name);
  expect(name).toHaveValue('The Loot Pile');
  expect(onUpdateName).not.toHaveBeenCalled();
  fireEvent.change(name, { target: { value: '  Found treasure  ' } });
  fireEvent.blur(name);
  expect(onUpdateName).toHaveBeenCalledWith('Found treasure');
});

test('loot collapse removes its inventory and identifies the controlled panel', () => {
  const { rerender } = render(<LootPileSection {...props} />);
  const control = screen.getByRole('button', { name: 'Collapse loot' });
  const panelId = control.getAttribute('aria-controls');
  expect(document.getElementById(panelId)).not.toHaveAttribute('hidden');
  rerender(<LootPileSection {...props} isExpanded={false} />);
  expect(document.getElementById(panelId)).toHaveAttribute('hidden');
  expect(screen.queryByTestId('loot-inventory')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Expand loot' })).toHaveAttribute('aria-expanded', 'false');
});

test('merchant headers identify stock and preserve DM-only deletion callbacks', () => {
  const merchant = { ownerId: 'shop', characterName: 'Mira Supplies', trayItems: [{ quantity: 5 }] };
  const onDeleteMerchant = jest.fn();
  const { rerender } = render(<MerchantSection {...props} merchants={[merchant]} onDeleteMerchant={onDeleteMerchant} />);
  expect(screen.getByRole('article', { name: 'Mira Supplies' })).toBeInTheDocument();
  expect(screen.getByText('5 items')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete Mira Supplies' }));
  expect(onDeleteMerchant).toHaveBeenCalledWith(merchant);
  rerender(<MerchantSection {...props} isDM={false} merchants={[merchant]} onDeleteMerchant={onDeleteMerchant} />);
  expect(screen.queryByRole('button', { name: 'Delete Mira Supplies' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Mira Supplies' })).toBeInTheDocument();
});

test.each([
  { layout: undefined, nextEnabled: false },
  { layout: { lootEnabled: false }, nextEnabled: true },
])('saves shared loot enabled=$nextEnabled without touching inventory contents', async ({ layout, nextEnabled }) => {
  updateDoc.mockClear();
  doc.mockClear();
  doc.mockReturnValue('campaign-ref');
  updateDoc.mockResolvedValueOnce();
  const onClose = jest.fn();
  render(<CampaignLayout campaign={{ ...props.campaign, players: [], layout }} inventories={{}} playerProfiles={{}} onClose={onClose} />);
  const toggle = screen.getByRole('checkbox', { name: 'Shared loot pile' });
  expect(toggle.checked).toBe(!nextEnabled);
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(nextEnabled);
  fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  expect(doc).toHaveBeenCalledWith({}, 'campaigns', 'campaign');
  expect(updateDoc).toHaveBeenCalledTimes(1);
  expect(updateDoc).toHaveBeenCalledWith('campaign-ref', {
    'layout.order': [],
    'layout.visible': {},
    'layout.lootEnabled': nextEnabled,
  });
});