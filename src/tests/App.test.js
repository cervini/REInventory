import { render, screen } from '@testing-library/react';
import { onAuthStateChanged } from 'firebase/auth';
import App from '../App';

jest.mock('../firebase', () => ({ auth: {}, db: {} }));
jest.mock('../components/inventory/InventoryGrid', () => () => null);
jest.mock('../components/compendium/Compendium', () => () => null);
jest.mock('firebase/auth', () => ({
  ...jest.requireActual('firebase/auth'),
  onAuthStateChanged: jest.fn(),
}));

test('shows the login form after signed-out auth loads', async () => {
  localStorage.clear();
  onAuthStateChanged.mockImplementation((_auth, callback) => {
    callback(null);
    return () => {};
  });

  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
});