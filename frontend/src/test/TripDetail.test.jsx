import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TripDetail from '../TripDetail';
import * as api from '../api';
import axios from 'axios';

// Mock Google Maps
vi.mock('@react-google-maps/api', () => ({
  GoogleMap: ({ children, onLoad }) => {
    if (onLoad) setTimeout(() => onLoad({ getCenter: () => ({ lat: () => 35, lng: () => 135 }) }), 0);
    return <div data-testid="google-map">{children}</div>;
  },
  useJsApiLoader: () => ({ isLoaded: true }),
  Marker: ({ title }) => <div data-testid={`marker-${title}`} />,
}));

// Mock the API module
vi.mock('../api', () => ({
  uploadDocument: vi.fn(),
  createExpense: vi.fn(),
  fetchDocuments: vi.fn().mockResolvedValue([]),
  fetchExpenses: vi.fn().mockResolvedValue([]),
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockTrip = {
  id: 999,
  title: 'Summer in Kyoto',
  budget: 2000,
  start: '2026-07-01',
  end: '2026-07-15',
};

const mockOnBack = vi.fn();

describe('TripDetail Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default axios mock
    axios.get.mockImplementation((url) => {
      if (url.includes('open-meteo')) {
        return Promise.resolve({
          data: {
            current: { temperature_2m: 25, relative_humidity_2m: 60, apparent_temperature: 27, weather_code: 1, wind_speed_10m: 12 },
            daily: {
              time: ['2026-07-01'], weather_code: [1], temperature_2m_max: [30], temperature_2m_min: [20], precipitation_probability_max: [10]
            },
          },
        });
      }
      return Promise.resolve({ data: { data: [] } });
    });
  });

  it('renders trip title and dates', () => {
    render(<TripDetail trip={mockTrip} onBack={mockOnBack} />);
    expect(screen.getByText('Summer in Kyoto')).toBeInTheDocument();
    expect(screen.getByText('2026-07-01 to 2026-07-15')).toBeInTheDocument();
  });

  it('displays weather data after loading', async () => {
    render(<TripDetail trip={mockTrip} onBack={mockOnBack} />);
    expect(await screen.findByText('25°C')).toBeInTheDocument();
  });

  it('renders available flights widget', () => {
    render(<TripDetail trip={mockTrip} onBack={mockOnBack} />);
    expect(screen.getByText('Available Flights')).toBeInTheDocument();
    expect(screen.getByText('Search Flights')).toBeInTheDocument();
  });

  it('shows searching state when search button clicked', async () => {
    // Make axios stay pending for a bit
    let resolveRequest;
    axios.get.mockReturnValue(new Promise(resolve => { resolveRequest = resolve; }));

    render(<TripDetail trip={mockTrip} onBack={mockOnBack} />);
    await userEvent.click(screen.getByText('Search Flights'));
    
    expect(screen.getByText('Searching...')).toBeInTheDocument();
    
    // Cleanup
    resolveRequest({ data: { data: [] } });
  });

  it('adds a new expense and calls API', async () => {
    api.createExpense.mockResolvedValue({ id: 500, title: 'Sushi', amount: 45 });

    render(<TripDetail trip={mockTrip} onBack={mockOnBack} />);
    
    await userEvent.type(screen.getByLabelText('Expense Title'), 'Sushi');
    await userEvent.type(screen.getByLabelText('Expense Amount'), '45');
    await userEvent.click(screen.getByLabelText('Add Expense'));
    
    expect(await screen.findByText('Sushi')).toBeInTheDocument();
    expect(api.createExpense).toHaveBeenCalledWith(mockTrip.id, 'Sushi', 45);
  });

  it('uploads a document and calls API', async () => {
    const file = new File(['hello'], 'passport.pdf', { type: 'application/pdf' });
    api.uploadDocument.mockResolvedValue({ id: 10, title: 'passport.pdf', document_type: 'application/pdf' });

    render(<TripDetail trip={mockTrip} onBack={mockOnBack} />);
    
    const input = screen.getByLabelText('Upload a new document');
    await userEvent.upload(input, file);
    
    expect(await screen.findByText(/passport.pdf/)).toBeInTheDocument();
    expect(api.uploadDocument).toHaveBeenCalled();
  });

  it('has progress bar with aria attributes', () => {
    render(<TripDetail trip={mockTrip} onBack={mockOnBack} />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });
});
