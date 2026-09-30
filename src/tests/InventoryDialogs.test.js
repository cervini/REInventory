import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddItem from '../components/items/AddItem';
import InventorySettings from '../components/inventory/InventorySettings';
import { doc, writeBatch } from 'firebase/firestore';

jest.mock('../firebase', () => ({ db: {} }));
jest.mock('firebase/firestore', () => ({ doc: jest.fn(), writeBatch: jest.fn(), getDoc: jest.fn(), getDocs: jest.fn(), collection: jest.fn() }));
jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));
jest.mock('../components/icons/DynamicIcon', () => ({
  __esModule: true,
  default: ({ className }) => require('react').createElement('svg', { className }),
}));

const originalCrypto = Object.getOwnPropertyDescriptor(global, 'crypto');
let batch;

beforeEach(() => {
  Object.defineProperty(global, 'crypto', { configurable: true, value: { randomUUID: jest.fn(() => 'new-item') } });
  batch = { update: jest.fn(), set: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  writeBatch.mockReturnValue(batch);
  doc.mockImplementation((root, ...segments) => [typeof root === 'string' ? root : '', ...segments].filter(Boolean).join('/'));
});

afterAll(() => {
  if (originalCrypto) Object.defineProperty(global, 'crypto', originalCrypto);
  else delete global.crypto;
});

test('waits for item saving and blocks duplicate submission and dismissal', async () => {
  let finish;
  const onAddItem = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  const onClose = jest.fn();
  const { container } = render(<AddItem onAddItem={onAddItem} onClose={onClose} />);
  userEvent.type(screen.getByLabelText('Item name'), 'Torch');
  userEvent.click(screen.getByRole('button', { name: 'Create Item' }));
  expect(onAddItem).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-item', name: 'Torch', w: 1, h: 1 }));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(container.querySelector('.add-item__content').tagName).toBe('DIV');
  expect(container.querySelector('.add-item__fields')).toBeDisabled();
  fireEvent.submit(container.querySelector('form'));
  fireEvent.click(container.querySelector('.add-item'));
  expect(onAddItem).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  await act(async () => finish());
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('retains item input and allows retry after a failed save', async () => {
  const onAddItem = jest.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(true);
  const onClose = jest.fn();
  render(<AddItem onAddItem={onAddItem} onClose={onClose} />);
  userEvent.type(screen.getByLabelText('Item name'), 'Healing potion');
  userEvent.click(screen.getByRole('button', { name: 'Create Item' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(screen.getByLabelText('Item name')).toHaveValue('Healing potion');
  expect(onClose).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Create Item' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

const settings = {
  characterName: 'Lyra', totalMaxWeight: 80, weightUnit: 'lbs',
  containers: { pack: { id: 'pack', name: 'Backpack', gridWidth: 8, gridHeight: 5, x: -12, y: 32, gridItems: [{ id: 'torch', x: 0, y: 0, w: 1, h: 1 }], trayItems: [] } },
};

test('keeps saved capacity when switching units and updates only bag metadata', async () => {
  const onClose = jest.fn();
  render(<InventorySettings campaignId="preview" userId="player" currentSettings={settings} onClose={onClose} />);
  expect(screen.getByLabelText('Maximum weight')).toHaveValue(80);
  userEvent.selectOptions(screen.getByLabelText('Weight unit'), 'kg');
  expect(screen.getByLabelText('Maximum weight').valueAsNumber).toBeCloseTo(36.28736, 4);
  userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  const inventoryWrite = batch.update.mock.calls.find(([reference]) => reference.endsWith('/player'))[1];
  expect(inventoryWrite.totalMaxWeight).toBeCloseTo(80, 6);
  const bagWrite = batch.update.mock.calls.find(([reference]) => reference.endsWith('/pack'))[1];
  expect(bagWrite).toEqual({ name: 'Backpack', gridWidth: 8, gridHeight: 5, trackWeight: true, order: 0 });
});

test('character saving prevents dismissal and retains a failed draft', async () => {
  let rejectSave;
  batch.commit.mockImplementation(() => new Promise((resolve, reject) => { rejectSave = reject; }));
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const onClose = jest.fn();
  const { container } = render(<InventorySettings campaignId="preview" userId="player" currentSettings={settings} onClose={onClose} />);
  userEvent.clear(screen.getByLabelText('Character name'));
  userEvent.type(screen.getByLabelText('Character name'), 'Lyra Stormwarden');
  userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  fireEvent.submit(container.querySelector('form'));
  fireEvent.click(container.querySelector('.inventory-settings'));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(batch.commit).toHaveBeenCalledTimes(1);
  expect(onClose).not.toHaveBeenCalled();
  expect(container.querySelector('.inventory-settings__content').tagName).toBe('DIV');
  expect(container.querySelector('.inventory-settings__fields')).toBeDisabled();
  await act(async () => rejectSave(new Error('Offline')));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save settings');
  expect(screen.getByLabelText('Character name')).toHaveValue('Lyra Stormwarden');
  batch.commit.mockResolvedValueOnce(undefined);
  userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  consoleError.mockRestore();
});

test('bag deletion requires confirmation and remains a draft until saving', async () => {
  render(<InventorySettings campaignId="preview" userId="player" currentSettings={settings} onClose={jest.fn()} />);
  userEvent.click(screen.getByRole('button', { name: 'Delete Backpack' }));
  expect(screen.getByRole('alert')).toHaveTextContent('permanently deleted when you save');
  expect(batch.delete).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Delete bag' }));
  expect(screen.queryByRole('textbox', { name: 'Bag name: Backpack' })).not.toBeInTheDocument();
  expect(batch.delete).not.toHaveBeenCalled();
  userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  await waitFor(() => expect(batch.commit).toHaveBeenCalledTimes(1));
  expect(batch.delete).toHaveBeenCalledWith('campaigns/preview/inventories/player/containers/pack');
});

test('DM settings omit irrelevant capacity, bag, and leave controls', () => {
  render(<InventorySettings campaignId="preview" userId="dm" currentSettings={settings} onClose={jest.fn()} isDMInventory />);
  expect(screen.getByRole('dialog', { name: 'DM Workspace Settings' })).toBeInTheDocument();
  expect(screen.getByLabelText('Workspace name')).toHaveValue('Lyra');
  expect(screen.queryByLabelText('Maximum weight')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add bag' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Campaign membership' })).not.toBeInTheDocument();
});

test('closing the icon picker with Escape keeps the item draft open', () => {
  const onClose = jest.fn();
  render(<AddItem onAddItem={jest.fn()} onClose={onClose} />);
  userEvent.type(screen.getByLabelText('Item name'), 'Torch');
  userEvent.click(screen.getByRole('button', { name: 'Choose item icon' }));
  expect(screen.getByRole('dialog', { name: 'Choose an Icon' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Choose an Icon' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Item name')).toHaveValue('Torch');
  expect(onClose).not.toHaveBeenCalled();
});

test('editing an enchanted item does not apply its bonus a second time', async () => {
  const onAddItem = jest.fn().mockResolvedValue(true);
  render(<AddItem onAddItem={onAddItem} onClose={jest.fn()} itemToEdit={{ item: { id: 'armor', name: 'Chain mail +1', type: 'Armor', w: 2, h: 3, rarity: 'Rare', armorStats: { armorClass: '17', armorType: 'Heavy' } } }} />);
  expect(screen.getByLabelText('Armor class (AC)')).toHaveValue('17');
  userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(onAddItem).toHaveBeenCalled());
  expect(onAddItem).toHaveBeenCalledWith(expect.objectContaining({ rarity: 'Rare', armorStats: expect.objectContaining({ armorClass: '17' }) }));
});

test('traps keyboard focus and restores the trigger after closing', () => {
  const trigger = document.createElement('button');
  document.body.append(trigger);
  trigger.focus();
  const { unmount } = render(<AddItem onAddItem={jest.fn()} onClose={jest.fn()} />);
  expect(screen.getByLabelText('Item name')).toHaveFocus();
  userEvent.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Close item editor' })).toHaveFocus();
  userEvent.tab({ shift: true });
  expect(screen.getByRole('button', { name: 'Create Item' })).toHaveFocus();
  userEvent.tab();
  expect(screen.getByRole('button', { name: 'Close item editor' })).toHaveFocus();
  unmount();
  expect(trigger).toHaveFocus();
  trigger.remove();
});

test('a handled save failure also keeps the item draft open', async () => {
  const onClose = jest.fn();
  render(<AddItem onAddItem={jest.fn().mockResolvedValue(false)} onClose={onClose} />);
  userEvent.type(screen.getByLabelText('Item name'), 'Torch');
  userEvent.click(screen.getByRole('button', { name: 'Create Item' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(onClose).not.toHaveBeenCalled();
});