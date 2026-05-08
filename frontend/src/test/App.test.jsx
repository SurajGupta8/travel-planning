import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import * as api from '../api';

// Mock Google OAuth
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }) => <div>{children}</div>,
  GoogleLogin: ({ onSuccess }) => (
    <button 
      data-testid="google-login" 
      onClick={() => onSuccess({ credential: 'fake-token' })}
    >
      Sign in with Google
    </button>
  ),
  googleLogout: vi.fn(),
}));

// Mock jwt-decode
vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn(() => ({
    name: 'Test User',
    email: 'test@example.com',
    picture: 'https://example.com/pic.jpg',
  })),
}));

// Mock the API module
vi.mock('../api', () => ({
  getStoredUser: vi.fn(),
  isLoggedIn: vi.fn(),
  fetchTrips: vi.fn(),
  googleLogin: vi.fn(),
  createTrip: vi.fn(),
  clearAuth: vi.fn(),
}));

describe('App Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Default mock implementations
    api.getStoredUser.mockReturnValue(null);
    api.isLoggedIn.mockReturnValue(false);
    api.fetchTrips.mockResolvedValue([
      { id: 1, title: 'Summer in Kyoto', budget: 2000, start_date: '2026-07-01', end_date: '2026-07-15', latitude: 35.0, longitude: 135.0 }
    ]);
  });

  // ============================================================
  // RENDERING TESTS
  // ============================================================

  it('renders the app title', () => {
    render(<App />);
    expect(screen.getByText('Travel Engine')).toBeInTheDocument();
  });

  it('renders the tagline', () => {
    render(<App />);
    expect(screen.getByText('Intelligent Planning. Dynamic Execution.')).toBeInTheDocument();
  });

  it('renders fetched trips', async () => {
    api.getStoredUser.mockReturnValue({ name: 'Test User' });
    api.isLoggedIn.mockReturnValue(true);
    
    render(<App />);
    await waitFor(() => {
      expect(screen.getByText('Summer in Kyoto')).toBeInTheDocument();
      expect(screen.getByText('Budget: $2000')).toBeInTheDocument();
    });
  });

  it('renders the New Trip card', () => {
    render(<App />);
    expect(screen.getByText('+ New Trip')).toBeInTheDocument();
  });

  it('renders Google Sign In button when not logged in', () => {
    render(<App />);
    expect(screen.getByTestId('google-login')).toBeInTheDocument();
  });

  // ============================================================
  // MODAL TESTS
  // ============================================================

  it('opens modal when New Trip is clicked', async () => {
    render(<App />);
    await userEvent.click(screen.getByText('+ New Trip'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Create a New Trip')).toBeInTheDocument();
  });

  it('modal has aria-modal attribute', async () => {
    render(<App />);
    await userEvent.click(screen.getByText('+ New Trip'));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('closes modal with Escape key', async () => {
    render(<App />);
    await userEvent.click(screen.getByText('+ New Trip'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ============================================================
  // TRIP CREATION TESTS
  // ============================================================

  it('creates a new trip and adds it to the dashboard', async () => {
    api.createTrip.mockResolvedValue({
      id: 2, title: 'Weekend in Paris', budget: 3000, start_date: '2026-09-01', end_date: '2026-09-03', latitude: 48.8, longitude: 2.3
    });

    render(<App />);
    await userEvent.click(screen.getByText('+ New Trip'));

    await userEvent.type(screen.getByLabelText(/Trip Title/), 'Weekend in Paris');
    await userEvent.type(screen.getByLabelText('Estimated Budget ($)'), '3000');

    await userEvent.click(screen.getByText('Save Trip'));

    await waitFor(() => {
      expect(api.createTrip).toHaveBeenCalled();
      expect(screen.getByText('Weekend in Paris')).toBeInTheDocument();
    });
  });

  // ============================================================
  // AUTH / SESSION TESTS
  // ============================================================

  it('restores user from localStorage on mount', async () => {
    const userData = { name: 'Saved User', email: 'saved@test.com', picture: 'https://pic.jpg' };
    api.getStoredUser.mockReturnValue(userData);
    api.isLoggedIn.mockReturnValue(true);
    
    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Saved User')).toBeInTheDocument();
      expect(api.fetchTrips).toHaveBeenCalled();
    });
  });

  it('calls googleLogin api when login button is clicked', async () => {
    api.googleLogin.mockResolvedValue({
      user: { name: 'New User', email: 'new@test.com' },
      access: 'fake-access',
      refresh: 'fake-refresh'
    });

    render(<App />);
    await userEvent.click(screen.getByTestId('google-login'));
    
    await waitFor(() => {
      expect(api.googleLogin).toHaveBeenCalledWith('fake-token');
      expect(screen.getByText('New User')).toBeInTheDocument();
    });
  });

  it('clears auth on logout', async () => {
    const userData = { name: 'Logout Me', email: 'a@b.com' };
    api.getStoredUser.mockReturnValue(userData);
    api.isLoggedIn.mockReturnValue(true);
    
    render(<App />);
    
    await userEvent.click(screen.getByLabelText('Log out of your account'));
    
    expect(api.clearAuth).toHaveBeenCalled();
    expect(screen.getByTestId('google-login')).toBeInTheDocument();
  });
});
