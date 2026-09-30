import { fireEvent, render, screen } from '@testing-library/react';
import LootPileSection from '../components/inventory/LootPileSection';

jest.mock('../components/inventory/PlayerInventory', () => () => <div data-testid="loot-inventory" />);

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
});