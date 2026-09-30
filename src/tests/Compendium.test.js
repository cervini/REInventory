import React from 'react';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getDocs, onSnapshot, collection, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { useCompendium } from '../hooks/useCompendium';
import Compendium from '../components/compendium/Compendium';
import AddFromCompendium from '../components/compendium/AddFromCompendium';

jest.mock('../components/icons/DynamicIcon', () => ({ __esModule: true, default: ({ className }) => require('react').createElement('svg', { className }) }));

jest.mock('../firebase', () => ({ db: {}, auth: { currentUser: { uid: 'player' } } }));
jest.mock('firebase/firestore', () => ({ getDocs: jest.fn(), onSnapshot: jest.fn(), collection: jest.fn(), addDoc: jest.fn(), deleteDoc: jest.fn(), doc: jest.fn() }));

const snapshot = items => ({ docs: items.map(item => ({ id: item.id, data: () => item })) });
let customListener;
let customFailure;
let globalListener;
const unsubscribe = jest.fn();
const originalCrypto = Object.getOwnPropertyDescriptor(global, 'crypto');

beforeEach(() => {
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => 'inventory-copy') } });
  localStorage.clear();
  collection.mockImplementation((database, ...segments) => segments.join('/'));
  doc.mockImplementation((database, ...segments) => segments.join('/'));
  deleteDoc.mockResolvedValue(undefined);
  addDoc.mockResolvedValue({ id: 'new-custom-item' });
  getDocs.mockResolvedValue(snapshot([{ id: 'torch', name: 'Torch', type: 'Gear' }]));
  onSnapshot.mockImplementation((reference, next, failure) => {
    if (reference === 'globalCompendium') {
      globalListener = next;
      next(snapshot([{ id: 'torch', name: 'Torch', type: 'Gear' }]));
      return unsubscribe;
    }
    customListener = next;
    customFailure = failure;
    return unsubscribe;
  });
});

test('does not finish loading before the global compendium arrives', async () => {
  let finishGlobal;
  getDocs.mockImplementation(() => new Promise(resolve => { finishGlobal = resolve; }));
  const { result, unmount } = renderHook(() => useCompendium());
  act(() => customListener(snapshot([{ id: 'personal', name: 'Personal item' }])));
  expect(result.current.loading.custom).toBe(false);
  expect(result.current.loading.global).toBe(true);
  expect(result.current.isLoading).toBe(true);
  await act(async () => finishGlobal(snapshot([{ id: 'torch', name: 'Torch' }])));
  expect(result.current.isLoading).toBe(false);
  expect(result.current.allItems.map(item => item.id)).toEqual(['personal', 'torch']);
  unmount();
  expect(unsubscribe).toHaveBeenCalled();
});

test('reports global fetch errors and retries without losing the custom source', async () => {
  getDocs.mockRejectedValueOnce(new Error('Offline'));
  const { result } = renderHook(() => useCompendium());
  act(() => customListener(snapshot([{ id: 'personal', name: 'Personal item' }])));
  await waitFor(() => expect(result.current.loading.global).toBe(false));
  expect(result.current.errors.global).toContain('Could not load');
  expect(result.current.customItems).toHaveLength(1);
  act(() => result.current.retry());
  act(() => customListener(snapshot([])));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.errors.global).toBe('');
  expect(result.current.globalItems[0].id).toBe('torch');
});

test('custom-source errors settle loading instead of leaving an endless spinner', async () => {
  const { result } = renderHook(() => useCompendium());
  act(() => customFailure(new Error('Permission denied')));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.errors.custom).toContain('Could not load');
  expect(result.current.globalItems).toHaveLength(1);
});

test('live global catalog updates without using the picker cache', () => {
  const { result } = renderHook(() => useCompendium({ liveGlobal: true }));
  act(() => customListener(snapshot([])));
  expect(getDocs).not.toHaveBeenCalled();
  act(() => globalListener(snapshot([{ id: 'new', name: 'New global item' }])));
  expect(result.current.globalItems[0].name).toBe('New global item');
});

test('catalog search and filters stay visible and global customization is an ordinary button', async () => {
  render(<Compendium onClose={jest.fn()} />);
  act(() => customListener(snapshot([])));
  userEvent.click(screen.getByRole('tab', { name: /Global compendium/i }));
  userEvent.click(await screen.findByRole('button', { name: /Torch Gear/i }));
  expect(screen.getByRole('searchbox', { name: 'Search items' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Type' })).toBeVisible();
  expect(screen.queryByRole('button', { name: /Delete Torch/ })).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Create custom version' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByDisplayValue('Torch')).toBeVisible();
});

test('custom versions keep their new identity across failed save retries', async () => {
  addDoc.mockRejectedValueOnce(new Error('Offline'));
  getDocs.mockResolvedValue(snapshot([]));
  render(<Compendium onClose={jest.fn()} />);
  act(() => customListener(snapshot([{ id: 'original', name: 'Torch', type: 'Gear', w: 1, h: 1 }])));
  userEvent.click(screen.getByRole('button', { name: /Torch Gear/ }));
  userEvent.click(screen.getByRole('button', { name: 'Create custom version' }));
  userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
  await screen.findByRole('alert');
  userEvent.click(screen.getByRole('button', { name: /Save Changes/i }));
  await waitFor(() => expect(addDoc).toHaveBeenCalledTimes(2));
  expect(addDoc.mock.calls[0][1].id).toBe('inventory-copy');
  expect(addDoc.mock.calls[1][1].id).toBe('inventory-copy');
});

test('custom deletion requires confirmation and uses the Firestore document identity', async () => {
  render(<Compendium onClose={jest.fn()} />);
  act(() => customListener({ docs: [{ id: 'firestore-id', data: () => ({ id: 'old-item-id', name: 'Personal sword', type: 'Weapon' }) }] }));
  userEvent.click(screen.getByRole('button', { name: /Personal sword Weapon/ }));
  userEvent.click(screen.getByRole('button', { name: 'Delete Personal sword' }));
  expect(deleteDoc).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Delete item' }));
  await waitFor(() => expect(deleteDoc).toHaveBeenCalledWith('compendiums/player/masterItems/firestore-id'));
});

test('a failed deletion keeps the selected item and allows retry', async () => {
  deleteDoc.mockRejectedValueOnce(new Error('Offline'));
  render(<Compendium onClose={jest.fn()} />);
  act(() => customListener(snapshot([{ id: 'sword', name: 'Personal sword', type: 'Weapon' }])));
  userEvent.click(screen.getByRole('button', { name: /Personal sword Weapon/ }));
  userEvent.click(screen.getByRole('button', { name: 'Delete Personal sword' }));
  userEvent.click(screen.getByRole('button', { name: 'Delete item' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete');
  userEvent.click(screen.getByRole('button', { name: 'Delete item' }));
  await waitFor(() => expect(deleteDoc).toHaveBeenCalledTimes(2));
});

afterAll(() => {
  if (originalCrypto) Object.defineProperty(global, 'crypto', originalCrypto);
  else delete global.crypto;
});

const renderPicker = (overrides = {}) => {
  const props = { onClose: jest.fn(), onAddItem: jest.fn().mockResolvedValue(true), players: ['dm', 'player'], dmId: 'dm', playerProfiles: {}, user: { uid: 'player' }, inventories: { player: { characterName: 'Aria' }, dm: { characterName: 'DM workspace' } }, ...overrides };
  const view = render(<AddFromCompendium {...props} />);
  act(() => customListener(snapshot([])));
  return { ...props, unmount: view.unmount };
};

test('adding awaits completion, prevents duplicates and dismissal, and restricts player destinations', async () => {
  let complete;
  const props = renderPicker({ onAddItem: jest.fn(() => new Promise(resolve => { complete = resolve; })) });
  userEvent.click(await screen.findByRole('button', { name: /Torch Gear/ }));
  const target = screen.getByRole('combobox', { name: 'Add to inventory' });
  expect(target).toBeDisabled();
  expect(target.options).toHaveLength(1);
  expect(target).toHaveValue('player');
  userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  userEvent.click(screen.getByRole('button', { name: 'Adding...' }));
  userEvent.keyboard('{Escape}');
  expect(props.onAddItem).toHaveBeenCalledTimes(1);
  expect(props.onClose).not.toHaveBeenCalled();
  await act(async () => complete(true));
  expect(props.onClose).toHaveBeenCalledTimes(1);
});

test('failed adds keep quantity and identity for retry', async () => {
  const props = renderPicker({ onAddItem: jest.fn().mockResolvedValueOnce(false).mockResolvedValue(true) });
  userEvent.click(await screen.findByRole('button', { name: /Torch Gear/ }));
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), { target: { value: '3' } });
  userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('selection has been kept');
  expect(props.onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue(3);
  userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  await waitFor(() => expect(props.onClose).toHaveBeenCalledTimes(1));
  expect(props.onAddItem.mock.calls[0]).toEqual(props.onAddItem.mock.calls[1]);
  expect(props.onAddItem.mock.calls[1][0]).toMatchObject({ id: 'inventory-copy', quantity: 3 });
});

test('DM can choose destinations and invalid quantities never reach persistence', async () => {
  const props = renderPicker({ user: { uid: 'dm' } });
  userEvent.click(await screen.findByRole('button', { name: /Torch Gear/ }));
  userEvent.selectOptions(screen.getByRole('combobox', { name: 'Add to inventory' }), 'player');
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), { target: { value: '1.5' } });
  fireEvent.submit(screen.getByRole('dialog').querySelector('form'));
  expect(screen.getByRole('alert')).toHaveTextContent('positive whole number');
  expect(props.onAddItem).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Quantity' }), { target: { value: '2' } });
  userEvent.click(screen.getByRole('button', { name: 'Add item' }));
  await waitFor(() => expect(props.onAddItem).toHaveBeenCalledWith(expect.objectContaining({ quantity: 2 }), 'player'));
});

test('global/custom document ID collisions stay selectable and hidden magic stays hidden for players', async () => {
  getDocs.mockResolvedValue(snapshot([{ id: 'shared', name: 'Global sword', type: 'Weapon', magicProperties: 'Secret curse', magicPropertiesVisible: false }]));
  renderPicker();
  act(() => customListener(snapshot([{ id: 'shared', name: 'Custom sword', type: 'Weapon' }])));
  userEvent.click(await screen.findByRole('button', { name: /Global sword Weapon/ }));
  expect(screen.getByRole('heading', { name: 'Global sword' })).toBeVisible();
  expect(screen.queryByText('Secret curse')).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: /Custom sword Weapon/ }));
  expect(screen.getByRole('heading', { name: 'Custom sword' })).toBeVisible();
});

test('picker traps keyboard focus and Escape restores the opener', async () => {
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const props = renderPicker();
  await screen.findByRole('button', { name: /Torch Gear/ });
  expect(screen.getByRole('searchbox')).toHaveFocus();
  screen.getByRole('button', { name: 'Cancel' }).focus();
  userEvent.tab();
  expect(screen.getByRole('button', { name: 'Close compendium' })).toHaveFocus();
  userEvent.keyboard('{Escape}');
  expect(props.onClose).toHaveBeenCalledTimes(1);
  props.unmount();
  expect(opener).toHaveFocus();
  opener.remove();
});