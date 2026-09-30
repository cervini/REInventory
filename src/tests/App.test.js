import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth } from '../firebase';
import App from '../App';
import ProfileMenu from '../components/auth/ProfileMenu';

jest.mock('../firebase', () => ({ auth: { signOut: jest.fn() }, db: {} }));
jest.mock('../components/inventory/InventoryGrid', () => ({ campaignId }) => <h2>Inventory {campaignId}</h2>);
jest.mock('../components/campaign/CampaignSelector', () => ({ onCampaignSelected }) => (
  <section>
    <h2>Your Campaigns</h2>
    <button onClick={() => onCampaignSelected('ancient-dragon-keeper')}>Open Dragon Keep</button>
    <button onClick={() => onCampaignSelected('silent-tower-walker')}>Open Amber Tower</button>
  </section>
));
jest.mock('../components/compendium/Compendium', () => ({ onClose }) => <section><h2>Item Compendium</h2><button onClick={onClose}>Close compendium</button></section>);
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  onAuthStateChanged: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  doc: jest.fn(),
  onSnapshot: jest.fn(),
}));

test('shows the login form after signed-out auth loads', async () => {
  localStorage.clear();
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    callback(null);
    return () => {};
  });

  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'REInventory' })).toBeInTheDocument();
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});

const profileUser = { uid: 'player', email: 'player@example.com', displayName: 'Google name' };
const renderProfileMenu = (props = {}) => {
  const actions = {
    onOpenProfile: jest.fn(),
    onNavigate: jest.fn(),
    onSignOut: jest.fn().mockResolvedValue(),
    ...props,
  };
  return {
    ...render(<>
      <button type="button">Previous control</button>
      <ProfileMenu user={profileUser} userProfile={{ displayName: 'Simone Cervini' }} {...actions} />
      <button type="button">Next control</button>
    </>),
    ...actions,
  };
};

test('profile trigger shows initials and opens an identified account menu that stays open on mouse leave', () => {
  renderProfileMenu();
  const trigger = screen.getByRole('button', { name: 'Account menu for Simone Cervini' });
  expect(trigger).toHaveTextContent('SC');
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  userEvent.click(trigger);
  const menu = screen.getByRole('menu', { name: 'Account navigation' });
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  expect(trigger).toHaveAttribute('aria-controls', menu.id);
  expect(screen.getByText('Simone Cervini')).toBeInTheDocument();
  expect(screen.getByText('player@example.com')).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Profile settings' })).toHaveFocus();
  fireEvent.mouseLeave(menu);
  expect(menu).toBeInTheDocument();
});

test('a broken profile photo falls back to initials and an email-only account remains identified', () => {
  const { container } = renderProfileMenu({ user: { uid: 'player', email: 'player@example.com', photoURL: '/missing-avatar.png' }, userProfile: null });
  expect(container.querySelector('img')).toHaveAttribute('src', '/missing-avatar.png');
  fireEvent.error(container.querySelector('img'));
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Account menu for player' })).toHaveTextContent('P');
});

test('profile menu supports arrow navigation, Home, End and Escape with focus restoration', () => {
  renderProfileMenu();
  const trigger = screen.getByRole('button', { name: /Account menu/ });
  trigger.focus();
  fireEvent.keyDown(trigger, { key: 'ArrowUp' });
  const signOut = screen.getByRole('menuitem', { name: 'Sign out' });
  const profile = screen.getByRole('menuitem', { name: 'Profile settings' });
  expect(signOut).toHaveFocus();
  fireEvent.keyDown(signOut, { key: 'ArrowDown' });
  expect(profile).toHaveFocus();
  fireEvent.keyDown(profile, { key: 'ArrowUp' });
  expect(signOut).toHaveFocus();
  fireEvent.keyDown(signOut, { key: 'Home' });
  expect(profile).toHaveFocus();
  fireEvent.keyDown(profile, { key: 'End' });
  expect(signOut).toHaveFocus();
  fireEvent.keyDown(signOut, { key: 'Escape' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

test('clicking outside dismisses the profile menu without stealing focus', () => {
  renderProfileMenu();
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  const outside = screen.getByRole('button', { name: 'Next control' });
  fireEvent.pointerDown(outside);
  outside.focus();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(outside).toHaveFocus();
});

test.each([false, true])('Tab closes the profile menu and leaves normally (shift: %s)', (shift) => {
  renderProfileMenu();
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.tab({ shift });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: shift ? /Account menu/ : 'Next control' })).toHaveFocus();
});

test.each([
  ['Profile settings', null],
  ['Item compendium', 'compendium'],
  ['Privacy policy', 'privacy'],
  ['Cookie policy', 'cookies'],
])('profile menu preserves the %s action and closes after selection', (label, page) => {
  const { onOpenProfile, onNavigate, onSignOut } = renderProfileMenu();
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.click(screen.getByRole('menuitem', { name: label }));
  if (page) expect(onNavigate).toHaveBeenCalledWith(page);
  else expect(onOpenProfile).toHaveBeenCalledTimes(1);
  expect(onSignOut).not.toHaveBeenCalled();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('signing out disables account actions and rejects duplicate requests', async () => {
  let finishSignOut;
  const onSignOut = jest.fn(() => new Promise(resolve => { finishSignOut = resolve; }));
  renderProfileMenu({ onSignOut });
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  const pendingButton = screen.getByRole('menuitem', { name: 'Signing out...' });
  expect(pendingButton).toBeDisabled();
  screen.getAllByRole('menuitem').forEach(item => expect(item).toBeDisabled());
  expect(screen.getByRole('button', { name: /Account menu/ })).toBeDisabled();
  fireEvent.click(pendingButton);
  expect(onSignOut).toHaveBeenCalledTimes(1);
  await act(async () => finishSignOut());
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Account menu/ })).toBeEnabled();
});

test('failed sign-out shows a readable error and permits retry', async () => {
  const onSignOut = jest.fn().mockRejectedValueOnce(new Error('Raw Firebase details')).mockResolvedValue();
  renderProfileMenu({ onSignOut });
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not sign out. Please try again.');
  expect(screen.queryByText('Raw Firebase details')).not.toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Sign out' })).toHaveFocus();
  userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  expect(onSignOut).toHaveBeenCalledTimes(2);
});

const renderSignedInApp = ({ consent = false } = {}) => {
  localStorage.clear();
  if (consent) localStorage.setItem('cookieConsent', 'true');
  auth.signOut.mockReset();
  let notifyAuth;
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    notifyAuth = callback;
    callback(profileUser);
    return () => {};
  });
  doc.mockImplementation((_db, ...parts) => ({ path: parts.join('/') }));
  onSnapshot.mockClear();
  onSnapshot.mockImplementation((_reference, callback) => {
    callback({ exists: () => true, data: () => _reference.path.startsWith('users/') ? { displayName: 'Simone Cervini' } : { name: _reference.path.endsWith('ancient-dragon-keeper') ? 'Dragon Keep' : 'Amber Tower' } });
    return jest.fn();
  });
  render(<App />);
  return notifyAuth;
};

test('the signed-in app header connects the profile menu to profile settings', () => {
  renderSignedInApp();
  userEvent.click(screen.getByRole('button', { name: 'Account menu for Simone Cervini' }));
  userEvent.click(screen.getByRole('menuitem', { name: 'Profile settings' }));
  expect(screen.getByRole('heading', { name: 'Profile Settings' })).toBeInTheDocument();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('the signed-in app header signs out through Firebase and returns to login', async () => {
  const notifyAuth = renderSignedInApp();
  auth.signOut.mockImplementation(async () => notifyAuth(null));
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
});

test('brand returns to campaigns without signing out and releases the campaign name listener', () => {
  renderSignedInApp({ consent: true });
  expect(screen.getByRole('heading', { name: 'REInventory' })).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'Open Dragon Keep' }));
  const header = screen.getByRole('banner', { name: 'Application header' });
  expect(header).toHaveTextContent('Dragon Keep');
  expect(screen.getByRole('button', { name: 'Share campaign' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Back to campaigns' })).not.toBeInTheDocument();
  const listenerIndex = onSnapshot.mock.calls.findIndex(([reference]) => reference.path === 'campaigns/ancient-dragon-keeper');
  const unsubscribe = onSnapshot.mock.results[listenerIndex].value;
  userEvent.click(screen.getByRole('button', { name: 'REInventory: Your campaigns' }));
  expect(screen.getByRole('heading', { name: 'Your Campaigns' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Share campaign' })).not.toBeInTheDocument();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(auth.signOut).not.toHaveBeenCalled();
});

test('header campaign context updates live and follows the selected campaign', () => {
  renderSignedInApp({ consent: true });
  userEvent.click(screen.getByRole('button', { name: 'Open Dragon Keep' }));
  const listener = onSnapshot.mock.calls.find(([reference]) => reference.path === 'campaigns/ancient-dragon-keeper')[1];
  act(() => listener({ exists: () => true, data: () => ({ name: 'Renamed Dragon Keep' }) }));
  expect(screen.getByRole('banner')).toHaveTextContent('Renamed Dragon Keep');
  userEvent.click(screen.getByRole('button', { name: 'REInventory: Your campaigns' }));
  userEvent.click(screen.getByRole('button', { name: 'Open Amber Tower' }));
  expect(screen.getByRole('banner')).toHaveTextContent('Amber Tower');
  expect(screen.getByRole('banner')).not.toHaveTextContent('Renamed Dragon Keep');
});

test.each(['Item compendium', 'Privacy policy', 'Cookie policy'])('header and account navigation remain available on %s', (label) => {
  renderSignedInApp({ consent: true });
  userEvent.click(screen.getByRole('button', { name: 'Open Dragon Keep' }));
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.click(screen.getByRole('menuitem', { name: label }));
  expect(screen.getByRole('banner')).toHaveTextContent(label);
  expect(screen.getByRole('button', { name: /Account menu/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Share campaign' })).not.toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'REInventory: Your campaigns' }));
  expect(screen.getByRole('heading', { name: 'Your Campaigns' })).toBeInTheDocument();
});

test('share panel selects the code, handles copy failure and permits retry', async () => {
  const originalClipboard = navigator.clipboard;
  const writeText = jest.fn().mockRejectedValueOnce(new Error('denied')).mockResolvedValue();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  try {
    renderSignedInApp({ consent: true });
    userEvent.click(screen.getByRole('button', { name: 'Open Dragon Keep' }));
    userEvent.click(screen.getByRole('button', { name: 'Share campaign' }));
    const code = screen.getByLabelText('Campaign code');
    expect(code).toHaveFocus();
    expect(code).toHaveValue('ancient-dragon-keeper');
    expect(code).toHaveAttribute('readonly');
    expect(code.selectionEnd).toBe(code.value.length);
    userEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy the code.');
    userEvent.click(screen.getByRole('button', { name: 'Copy code' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Campaign code copied.'));
    expect(writeText).toHaveBeenCalledTimes(2);
    expect(writeText).toHaveBeenLastCalledWith('ancient-dragon-keeper');
    fireEvent.keyDown(code, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Share campaign' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Share campaign' })).toHaveFocus();
  } finally {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: originalClipboard });
  }
});

test('opening the account menu dismisses sharing and home navigation clears share state', () => {
  renderSignedInApp({ consent: true });
  userEvent.click(screen.getByRole('button', { name: 'Open Dragon Keep' }));
  userEvent.click(screen.getByRole('button', { name: 'Share campaign' }));
  const account = screen.getByRole('button', { name: /Account menu/ });
  fireEvent.pointerDown(account);
  userEvent.click(account);
  expect(screen.queryByRole('dialog', { name: 'Share campaign' })).not.toBeInTheDocument();
  expect(screen.getByRole('menu')).toBeInTheDocument();
  userEvent.click(screen.getByRole('button', { name: 'REInventory: Your campaigns' }));
  userEvent.click(screen.getByRole('button', { name: 'Open Amber Tower' }));
  userEvent.click(screen.getByRole('button', { name: 'Share campaign' }));
  expect(screen.getByLabelText('Campaign code')).toHaveValue('silent-tower-walker');
});

test('signing out from a policy page restores login and clears header context', async () => {
  const notifyAuth = renderSignedInApp({ consent: true });
  auth.signOut.mockImplementation(async () => notifyAuth(null));
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.click(screen.getByRole('menuitem', { name: 'Privacy policy' }));
  userEvent.click(screen.getByRole('button', { name: /Account menu/ }));
  userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));
  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  expect(screen.getByRole('banner')).not.toHaveTextContent('Privacy policy');
  expect(screen.queryByRole('button', { name: /Account menu/ })).not.toBeInTheDocument();
});