import { useState } from 'react';
import TripDetail from './TripDetail';
import './index.css';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [trips, setTrips] = useState([
      { id: 999, title: 'Summer in Kyoto', budget: 2000, start: '2026-07-01', end: '2026-07-15' }
  ]);
  const [formData, setFormData] = useState({
    title: '',
    budget: '',
    start: '',
    end: ''
  });

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    const key = id.replace('trip', '').toLowerCase(); // e.g., tripTitle -> title
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveTrip = () => {
    const newTrip = {
      id: Date.now(),
      title: formData.title || 'Untitled Trip',
      budget: formData.budget || '0',
      start: formData.start || 'TBD',
      end: formData.end || 'TBD'
    };
    
    setTrips([...trips, newTrip]);
    setIsModalOpen(false);
    setFormData({ title: '', budget: '', start: '', end: '' });
  };

  if (selectedTrip) {
      return (
          <div className="glass-container">
              <TripDetail trip={selectedTrip} onBack={() => setSelectedTrip(null)} />
          </div>
      );
  }

  return (
    <>
      <div className="glass-container">
        <header>
            <h1>Travel Engine</h1>
            <p>Intelligent Planning. Dynamic Execution.</p>
        </header>

        <main>
            <section className="dashboard">
                <div className="card add-trip" onClick={() => setIsModalOpen(true)}>
                    <h2>+ New Trip</h2>
                    <p>Start planning your next adventure.</p>
                </div>
                
                {trips.map(trip => (
                  <div key={trip.id} className="card" onClick={() => setSelectedTrip(trip)}>
                      <h2>{trip.title}</h2>
                      <p style={{color: 'var(--text-muted)', marginTop: '0.5rem'}}>Budget: ${trip.budget}</p>
                      <p style={{fontSize: '0.9rem', marginTop: '1rem'}}>{trip.start} to {trip.end}</p>
                  </div>
                ))}
            </section>
        </main>
      </div>
      
      {isModalOpen && (
        <div className="modal" style={{display: 'flex'}}>
            <div className="modal-content">
                <span className="close-btn" onClick={() => setIsModalOpen(false)}>&times;</span>
                <h2>Create a New Trip</h2>
                <input type="text" id="tripTitle" value={formData.title} onChange={handleInputChange} placeholder="Trip Title (e.g., Summer in Kyoto)" />
                <input type="number" id="tripBudget" value={formData.budget} onChange={handleInputChange} placeholder="Estimated Budget ($)" />
                <input type="date" id="tripStart" value={formData.start} onChange={handleInputChange} />
                <input type="date" id="tripEnd" value={formData.end} onChange={handleInputChange} />
                <button className="btn-primary" onClick={handleSaveTrip}>Save Trip</button>
            </div>
        </div>
      )}
    </>
  );
}

export default App;
