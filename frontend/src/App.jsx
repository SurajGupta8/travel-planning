import { useState, useEffect } from 'react';
import TripDetail from './TripDetail'
import { GoogleOAuthProvider, GoogleLogin, googleLogout } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import * as api from './api';
import './index.css';

// Well-known location coordinates for common destinations
const KNOWN_LOCATIONS = {
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'paris': { lat: 48.8566, lng: 2.3522 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'bali': { lat: -8.3405, lng: 115.0920 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'ladakh': { lat: 34.1526, lng: 77.5771 },
  'leh': { lat: 34.1526, lng: 77.5771 },
  'manali': { lat: 32.2396, lng: 77.1887 },
  'goa': { lat: 15.2993, lng: 74.1240 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'delhi': { lat: 28.7041, lng: 77.1025 },
  'hawaii': { lat: 19.8968, lng: -155.5828 },
  'maldives': { lat: 3.2028, lng: 73.2207 },
  'switzerland': { lat: 46.8182, lng: 8.2275 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'barcelona': { lat: 41.3874, lng: 2.1686 },
  'istanbul': { lat: 41.0082, lng: 28.9784 },
  'cairo': { lat: 30.0444, lng: 31.2357 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
};

// Geocode a trip title to coordinates
async function geocodeLocation(title) {
  const lower = title.toLowerCase();
  for (const [key, coords] of Object.entries(KNOWN_LOCATIONS)) {
    if (lower.includes(key)) return coords;
  }
  try {
    const axios = (await import('axios')).default;
    const res = await axios.get(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(title)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'TravelEngine/1.0' } }
    );
    if (res.data && res.data.length > 0) {
      return { lat: parseFloat(res.data[0].lat), lng: parseFloat(res.data[0].lon) };
    }
  } catch (e) {
    console.warn('Geocoding failed:', e);
  }
  return { lat: 35.6762, lng: 139.6503 };
}

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [formData, setFormData] = useState({
    title: '',
    budget: '',
    start: '',
    end: ''
  });

  // Restore session on mount
  useEffect(() => {
    const storedUser = api.getStoredUser();
    if (storedUser && api.isLoggedIn()) {
      setUser(storedUser);
      loadTrips();
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadTrips = async () => {
    setIsLoading(true);
    try {
      const data = await api.fetchTrips();
      const mapped = data.map(t => ({
        id: t.id,
        title: t.title,
        budget: t.budget || 0,
        start: t.start_date || 'TBD',
        end: t.end_date || 'TBD',
        lat: t.latitude,
        lng: t.longitude,
      }));
      setTrips(mapped);
    } catch (err) {
      console.warn('Failed to load trips:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Focus first input when modal opens
  useEffect(() => {
    if (isModalOpen) {
      const firstInput = document.getElementById('tripTitle');
      if (firstInput) firstInput.focus();
    }
  }, [isModalOpen]);

  // Close modal on Escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isModalOpen) setIsModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isModalOpen]);

  const handleLoginSuccess = async (credentialResponse) => {
    try {
      const data = await api.googleLogin(credentialResponse.credential);
      setUser(data.user);
      loadTrips();
    } catch (err) {
      console.error('Login failed:', err);
      // Fallback: decode locally and store
      const decoded = jwtDecode(credentialResponse.credential);
      const userData = { name: decoded.name, email: decoded.email, picture: decoded.picture };
      setUser(userData);
      localStorage.setItem('te_user', JSON.stringify(userData));
    }
  };

  const handleLogout = () => {
    googleLogout();
    api.clearAuth();
    setUser(null);
    setTrips([]);
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    const key = id.replace('trip', '').toLowerCase();
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveTrip = async () => {
    const title = formData.title || 'Untitled Trip';
    const coords = await geocodeLocation(title);

    try {
      const tripData = {
        title: title,
        budget: formData.budget || 0,
        start_date: formData.start || null,
        end_date: formData.end || null,
        latitude: coords.lat,
        longitude: coords.lng,
      };
      const saved = await api.createTrip(tripData);
      const newTrip = {
        id: saved.id,
        title: saved.title,
        budget: saved.budget,
        start: saved.start_date || 'TBD',
        end: saved.end_date || 'TBD',
        lat: saved.latitude,
        lng: saved.longitude,
      };
      setTrips(prev => [...prev, newTrip]);
    } catch (err) {
      console.warn('Backend save failed, saving locally:', err);
      const newTrip = {
        id: Date.now(),
        title, budget: formData.budget || '0',
        start: formData.start || 'TBD', end: formData.end || 'TBD',
        lat: coords.lat, lng: coords.lng,
      };
      setTrips(prev => [...prev, newTrip]);
    }

    setIsModalOpen(false);
    setFormData({ title: '', budget: '', start: '', end: '' });
  };

  const handleCardKeyDown = (e, trip) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setSelectedTrip(trip);
    }
  };

  const handleNewTripKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsModalOpen(true);
    }
  };

  return (
    <GoogleOAuthProvider clientId="972375338739-qe872mbdl7nmbc7bf7q3dtdot7loadip.apps.googleusercontent.com">
      {selectedTrip ? (
        <TripDetail trip={selectedTrip} onBack={() => { setSelectedTrip(null); loadTrips(); }} />
      ) : (
      <div className="glass-container">
        <header>
            <h1>Travel Engine</h1>
            <p>Intelligent Planning. Dynamic Execution.</p>
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '1rem', gap: '1rem'}}>
                {user ? (
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '12px', border: '1px solid var(--glass-border)'}}>
                        {user.picture && <img src={user.picture} alt={`${user.name}'s avatar`} style={{width: 32, height: 32, borderRadius: '50%'}} referrerPolicy="no-referrer" />}
                        <span style={{fontSize: '0.95rem'}}>{user.name}</span>
                        <button className="btn-secondary" onClick={handleLogout} aria-label="Log out of your account" style={{marginLeft: '0.5rem', padding: '0.3rem 0.75rem', fontSize: '0.8rem'}}>Logout</button>
                    </div>
                ) : (
                    <GoogleLogin 
                        onSuccess={handleLoginSuccess}
                        onError={() => console.log('Login Failed')}
                    />
                )}
            </div>
        </header>

        <main>
            <section className="dashboard" aria-label="Your trips">
                <div 
                    className="card add-trip" 
                    onClick={() => setIsModalOpen(true)}
                    onKeyDown={handleNewTripKeyDown}
                    role="button"
                    tabIndex="0"
                    aria-label="Create a new trip"
                >
                    <h2>+ New Trip</h2>
                    <p>Start planning your next adventure.</p>
                </div>
                
                {isLoading ? (
                  <div className="card" style={{display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    <p style={{color: 'var(--text-muted)'}}>Loading trips...</p>
                  </div>
                ) : trips.map(trip => (
                  <div 
                    key={trip.id} 
                    className="card" 
                    onClick={() => setSelectedTrip(trip)}
                    onKeyDown={(e) => handleCardKeyDown(e, trip)}
                    role="button"
                    tabIndex="0"
                    aria-label={`Open trip: ${trip.title}, Budget $${trip.budget}, ${trip.start} to ${trip.end}`}
                  >
                      <h2>{trip.title}</h2>
                      <p style={{color: 'var(--text-muted)', marginTop: '0.5rem'}}>Budget: ${trip.budget}</p>
                      <p style={{fontSize: '0.9rem', marginTop: '1rem'}}>{trip.start} to {trip.end}</p>
                  </div>
                ))}
            </section>
        </main>
      </div>
      )}
      
      {isModalOpen && (
        <div className="modal" style={{display: 'flex'}} role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-content">
                <button 
                    className="close-btn" 
                    onClick={() => setIsModalOpen(false)}
                    aria-label="Close modal"
                    style={{background: 'none', border: 'none'}}
                >&times;</button>
                <h2 id="modal-title">Create a New Trip</h2>
                <div>
                    <label htmlFor="tripTitle" style={{display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)'}}>Trip Title (include destination name)</label>
                    <input type="text" id="tripTitle" value={formData.title} onChange={handleInputChange} placeholder="e.g., Ladakh Adventure, Paris Weekend" />
                </div>
                <div>
                    <label htmlFor="tripBudget" style={{display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)'}}>Estimated Budget ($)</label>
                    <input type="number" id="tripBudget" value={formData.budget} onChange={handleInputChange} placeholder="2000" min="0" max="1000000" />
                </div>
                <div>
                    <label htmlFor="tripStart" style={{display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)'}}>Start Date</label>
                    <input type="date" id="tripStart" value={formData.start} onChange={handleInputChange} />
                </div>
                <div>
                    <label htmlFor="tripEnd" style={{display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)'}}>End Date</label>
                    <input type="date" id="tripEnd" value={formData.end} onChange={handleInputChange} />
                </div>
                <button className="btn-primary" onClick={handleSaveTrip}>Save Trip</button>
            </div>
        </div>
      )}
    </GoogleOAuthProvider>
  );
}

export default App;
