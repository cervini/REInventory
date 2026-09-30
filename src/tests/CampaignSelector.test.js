import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import CampaignSelector from '../components/campaign/CampaignSelector';

jest.mock('../firebase', () => ({ auth: { currentUser: { uid: 'player' } }, db: {} }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  deleteDoc: jest.fn(),
  writeBatch: jest.fn(),
}));
jest.mock('../components/campaign/JoinCampaign', () => ({ campaignId, isDMAddingCharacter, onClose }) => (
  <div role="dialog" aria-label={isDMAddingCharacter ? 'Add character' : 'Join character'}>
    <span>{campaignId}</span>
    <button onClick={onClose}>Close</button>
  </div>
));
jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));
jest.mock('../utils/codeGenerator', () => ({ generateJoinCode: () => 'ancient-dragon-keeper' }));
jest.mock('../components/ui/WhatsNewModal', () => ({
  __esModule: true,
  default: () => null,
  whatsNewConfig: { version: 'test', expiryDate: '2000-01-01' },
}));

const snapshot = (campaigns = []) => ({
  forEach: (callback) => campaigns.forEach(campaign => callback({
    id: campaign.id,
    data: () => campaign,
  })),
});

beforeEach(() => {
  jest.resetAllMocks();
  doc.mockImplementation((...parts) => ({ path: parts.slice(1).join('/') }));
  getDocs.mockResolvedValue(snapshot());
  getDoc.mockResolvedValue({ exists: () => false });
  setDoc.mockResolvedValue();
  deleteDoc.mockResolvedValue();
  writeBatch.mockReturnValue({ delete: jest.fn(), commit: jest.fn().mockResolvedValue() });
});

test('loading the list does not pretend a campaign is being created or joined', async () => {
  let finishLoading;
  const request = new Promise(resolve => { finishLoading = resolve; });
  getDocs.mockReturnValue(request);
  render(<CampaignSelector onCampaignSelected={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading your campaigns');
  expect(screen.queryByText('You have no campaigns yet.')).not.toBeInTheDocument();
  expect(screen.queryByText('Creating...')).not.toBeInTheDocument();
  expect(screen.queryByText('Checking code...')).not.toBeInTheDocument();
  await act(async () => finishLoading(snapshot()));
  expect(screen.getByText('You have no campaigns yet.')).toBeInTheDocument();
});

test('queries both memberships and ownership and deduplicates their results', async () => {
  const campaign = { id: 'owned-code', name: 'Owned campaign', dmId: 'player', players: [] };
  getDocs.mockResolvedValueOnce(snapshot([campaign])).mockResolvedValueOnce(snapshot([campaign]));
  const onCampaignSelected = jest.fn();
  render(<CampaignSelector onCampaignSelected={onCampaignSelected} />);
  expect(await screen.findByRole('button', { name: 'Open Owned campaign' })).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Open Owned campaign' })).toHaveLength(1);
  expect(where).toHaveBeenCalledWith('players', 'array-contains', 'player');
  expect(where).toHaveBeenCalledWith('dmId', '==', 'player');
  expect(query).toHaveBeenCalledTimes(2);
  userEvent.click(screen.getByRole('button', { name: 'Open Owned campaign' }));
  expect(onCampaignSelected).toHaveBeenCalledWith('owned-code');
});

test('a failed fetch is distinct from an empty list and can be retried', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    getDocs.mockRejectedValueOnce(new Error('network')).mockResolvedValue(snapshot());
    render(<CampaignSelector onCampaignSelected={jest.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your campaigns');
    expect(screen.queryByText('You have no campaigns yet.')).not.toBeInTheDocument();
    userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(await screen.findByText('You have no campaigns yet.')).toBeInTheDocument();
    expect(getDocs).toHaveBeenCalledTimes(4);
  } finally {
    errorLog.mockRestore();
  }
});

const ownedCampaign = { id: 'ancient-dragon-keeper', name: 'Dragon Keep', dmId: 'player', players: ['player'] };
const joinedCampaign = { id: 'silent-tower-walker', name: 'Amber Tower', dmId: 'other-dm', players: ['player'] };

const renderCampaigns = async (campaigns = [ownedCampaign, joinedCampaign], onCampaignSelected = jest.fn()) => {
  getDocs.mockResolvedValue(snapshot(campaigns));
  render(<CampaignSelector onCampaignSelected={onCampaignSelected} />);
  await waitFor(() => expect(screen.queryByText('Loading your campaigns...')).not.toBeInTheDocument());
  return onCampaignSelected;
};

test('shows sorted campaigns with roles, codes and owner-only actions', async () => {
  await renderCampaigns();
  const rows = within(screen.getByRole('list', { name: 'Campaigns' })).getAllByRole('listitem');
  expect(within(rows[0]).getByRole('button', { name: 'Open Amber Tower' })).toBeInTheDocument();
  expect(within(rows[0]).getByText('Player')).toBeInTheDocument();
  expect(within(rows[0]).queryByRole('button', { name: /Delete campaign/ })).not.toBeInTheDocument();
  expect(within(rows[1]).getByText('DM')).toBeInTheDocument();
  expect(within(rows[1]).getByText('ancient-dragon-keeper')).toBeInTheDocument();
  expect(within(rows[1]).getByRole('button', { name: 'Add a character to Dragon Keep' })).toBeInTheDocument();
  expect(screen.getByText('2 campaigns')).toBeInTheDocument();
});

test('searches campaign names and codes without changing the total campaign count', async () => {
  await renderCampaigns();
  const search = screen.getByRole('searchbox', { name: 'Search campaigns' });
  userEvent.type(search, 'DRAGON');
  expect(screen.getByRole('button', { name: 'Open Dragon Keep' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Open Amber Tower' })).not.toBeInTheDocument();
  expect(screen.getByText('2 campaigns')).toBeInTheDocument();
  userEvent.clear(search);
  userEvent.type(search, 'silent-tower');
  expect(screen.getByRole('button', { name: 'Open Amber Tower' })).toBeInTheDocument();
  userEvent.clear(search);
  userEvent.type(search, 'not-found');
  expect(screen.getByRole('status')).toHaveTextContent('No matching campaigns.');
  expect(screen.getByRole('form', { name: 'Create campaign' })).toBeInTheDocument();
});

test('copies a campaign code and reports clipboard failures', async () => {
  const originalClipboard = navigator.clipboard;
  const writeText = jest.fn().mockResolvedValueOnce().mockRejectedValueOnce(new Error('denied'));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  try {
    await renderCampaigns();
    userEvent.click(screen.getByRole('button', { name: 'Copy code for Dragon Keep' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Campaign code copied.'));
    expect(writeText).toHaveBeenCalledWith('ancient-dragon-keeper');
    userEvent.click(screen.getByRole('button', { name: 'Copy code for Dragon Keep' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy the code.');
  } finally {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
  }
});

test('validates empty and whitespace campaign names without writes', async () => {
  await renderCampaigns([]);
  userEvent.click(screen.getByRole('button', { name: 'Create campaign', exact: true }));
  expect(getDoc).not.toHaveBeenCalled();
  userEvent.type(screen.getByLabelText('Campaign name'), '   ');
  userEvent.click(screen.getByRole('button', { name: 'Create campaign', exact: true }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a campaign name.');
  expect(setDoc).not.toHaveBeenCalled();
});

test('creates a campaign with Enter and preserves the DM inventory and backpack defaults', async () => {
  const onCampaignSelected = await renderCampaigns([]);
  userEvent.type(screen.getByLabelText('Campaign name'), '  New adventure  {enter}');
  await waitFor(() => expect(onCampaignSelected).toHaveBeenCalledWith('ancient-dragon-keeper'));
  expect(setDoc).toHaveBeenNthCalledWith(1, { path: 'campaigns/ancient-dragon-keeper' }, {
    dmId: 'player', name: 'New adventure', players: ['player'],
    layout: { order: ['player'], visible: { player: true } },
  });
  expect(setDoc).toHaveBeenNthCalledWith(2, { path: 'campaigns/ancient-dragon-keeper/inventories/player' }, {
    characterName: 'DM', ownerId: 'player', trayItems: [],
  });
  expect(setDoc).toHaveBeenNthCalledWith(3, { path: 'containers/backpack' }, {
    name: 'Backpack', gridItems: [], gridWidth: 10, gridHeight: 5,
  });
});

test('creation locks duplicate requests and does not show a join progress label', async () => {
  let finishLookup;
  getDoc.mockImplementation(() => new Promise(resolve => { finishLookup = resolve; }));
  await renderCampaigns([]);
  userEvent.type(screen.getByLabelText('Campaign name'), 'New adventure');
  const form = screen.getByRole('form', { name: 'Create campaign' });
  act(() => {
    fireEvent.submit(form);
    fireEvent.submit(form);
  });
  expect(getDoc).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Join campaign', exact: true })).toBeDisabled();
  expect(screen.queryByText('Checking code...')).not.toBeInTheDocument();
  await act(async () => finishLookup({ exists: () => false }));
  expect(screen.getByRole('button', { name: 'Create campaign', exact: true })).toBeEnabled();
});

test('a code collision does not overwrite an existing campaign', async () => {
  getDoc.mockResolvedValue({ exists: () => true });
  await renderCampaigns([]);
  userEvent.type(screen.getByLabelText('Campaign name'), 'New adventure{enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not generate a unique code.');
  expect(getDoc).toHaveBeenCalledTimes(5);
  expect(setDoc).not.toHaveBeenCalled();
});

test('joining validates a code and opens the character modal for a new member', async () => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => ({ dmId: 'other-dm', players: [] }) });
  await renderCampaigns([]);
  userEvent.click(screen.getByRole('button', { name: 'Join campaign', exact: true }));
  expect(getDoc).not.toHaveBeenCalled();
  userEvent.type(screen.getByLabelText('Campaign code'), '  silent-tower-walker  {enter}');
  expect(await screen.findByRole('dialog', { name: 'Join character' })).toHaveTextContent('silent-tower-walker');
  expect(doc).toHaveBeenCalledWith({}, 'campaigns', 'silent-tower-walker');
  expect(setDoc).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test.each([
  [{ dmId: 'other-dm', players: ['player'] }, 'member'],
  [{ dmId: 'player', players: [] }, 'owner missing from players'],
])('joining as an existing account opens the campaign without recreating inventory (%s)', async (campaign) => {
  getDoc.mockResolvedValue({ exists: () => true, data: () => campaign });
  const onCampaignSelected = await renderCampaigns([]);
  userEvent.type(screen.getByLabelText('Campaign code'), 'ancient-dragon-keeper{enter}');
  await waitFor(() => expect(onCampaignSelected).toHaveBeenCalledWith('ancient-dragon-keeper'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(setDoc).not.toHaveBeenCalled();
});

test('invalid or unknown codes give inline errors and allow correction', async () => {
  await renderCampaigns([]);
  userEvent.type(screen.getByLabelText('Campaign code'), 'bad/code{enter}');
  expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid campaign code.');
  expect(getDoc).not.toHaveBeenCalled();
  userEvent.clear(screen.getByLabelText('Campaign code'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  userEvent.type(screen.getByLabelText('Campaign code'), 'missing-code{enter}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Campaign not found.');
});

test('the owner add-character action opens the DM variant of the modal', async () => {
  await renderCampaigns();
  userEvent.click(screen.getByRole('button', { name: 'Add a character to Dragon Keep' }));
  expect(screen.getByRole('dialog', { name: 'Add character' })).toHaveTextContent('ancient-dragon-keeper');
  userEvent.click(screen.getByRole('button', { name: 'Close' }));
});

test('cancelling deletion makes no writes and confirming deletion removes only the selected row', async () => {
  const confirmation = jest.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
  try {
    await renderCampaigns();
    const deleteButton = screen.getByRole('button', { name: 'Delete campaign Dragon Keep' });
    userEvent.click(deleteButton);
    expect(deleteDoc).not.toHaveBeenCalled();
    userEvent.click(deleteButton);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Open Dragon Keep' })).not.toBeInTheDocument());
    expect(deleteDoc).toHaveBeenCalledWith({ path: 'campaigns/ancient-dragon-keeper' });
    expect(screen.getByRole('button', { name: 'Open Amber Tower' })).toBeInTheDocument();
  } finally {
    confirmation.mockRestore();
  }
});