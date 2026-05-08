import React, { useState, useEffect } from 'react';

const TripDetail = ({ trip, onBack }) => {
  // Try to load from localStorage first for Offline Mode
  const loadInitialState = (key, defaultVal) => {
      const saved = localStorage.getItem(`trip_${trip.id}_${key}`);
      return saved ? JSON.parse(saved) : defaultVal;
  };

  const [packingList, setPackingList] = useState(loadInitialState('packing', null));
  const [isGenerating, setIsGenerating] = useState(false);
  
  const [expenses, setExpenses] = useState(loadInitialState('expenses', [
      { id: 1, title: 'Flight', amount: 450 },
      { id: 2, title: 'Hotel Deposit', amount: 200 }
  ]));
  
  const [activities, setActivities] = useState(loadInitialState('activities', [
      { id: 1, title: 'Visit Temple', start_time: new Date(`${trip.start}T09:00:00`), end_time: new Date(`${trip.start}T11:00:00`), lat: 35.0116, lng: 135.7681, duration: 120 },
      { id: 2, title: 'Lunch at Cafe', start_time: new Date(`${trip.start}T11:15:00`), end_time: new Date(`${trip.start}T12:15:00`), lat: 35.0000, lng: 135.7500, duration: 60 }
  ]));
  
  const [documents, setDocuments] = useState(loadInitialState('docs', []));
  
  const [predictedCost, setPredictedCost] = useState(loadInitialState('predictedCost', null));
  
  const [newExpenseTitle, setNewExpenseTitle] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  
  const [newActTitle, setNewActTitle] = useState('');
  const [newActLat, setNewActLat] = useState('');
  const [newActLng, setNewActLng] = useState('');
  const [newActDuration, setNewActDuration] = useState(60);
  const [isOptimizing, setIsOptimizing] = useState(false);
  
  const [delayMinutes, setDelayMinutes] = useState('');
  const [isRerouting, setIsRerouting] = useState(false);
  
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Sync to localStorage
  useEffect(() => {
      localStorage.setItem(`trip_${trip.id}_packing`, JSON.stringify(packingList));
      localStorage.setItem(`trip_${trip.id}_expenses`, JSON.stringify(expenses));
      localStorage.setItem(`trip_${trip.id}_activities`, JSON.stringify(activities));
      localStorage.setItem(`trip_${trip.id}_docs`, JSON.stringify(documents));
      localStorage.setItem(`trip_${trip.id}_predictedCost`, JSON.stringify(predictedCost));
  }, [packingList, expenses, activities, documents, predictedCost, trip.id]);

  // Handle Online/Offline Status
  useEffect(() => {
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

  const handleGeneratePackingList = async () => {
      setIsGenerating(true);
      setTimeout(() => {
          setPackingList(['Passport', 'Phone Charger', 'Camera', 'Comfortable Shoes', 'Jacket']);
          setIsGenerating(false);
      }, 1500);
  };

  const handleForecastBudget = async () => {
      setTimeout(() => {
          setPredictedCost(800);
      }, 1000);
  };

  const addExpense = () => {
      if (newExpenseTitle && newExpenseAmount) {
          setExpenses([...expenses, { id: Date.now(), title: newExpenseTitle, amount: parseFloat(newExpenseAmount) }]);
          setNewExpenseTitle('');
          setNewExpenseAmount('');
      }
  };

  const addActivity = () => {
      if (newActTitle) {
          setActivities([...activities, { 
              id: Date.now(), 
              title: newActTitle, 
              lat: parseFloat(newActLat) || null, 
              lng: parseFloat(newActLng) || null,
              duration: parseInt(newActDuration) || 60,
              start_time: null,
              end_time: null
          }]);
          setNewActTitle('');
          setNewActLat('');
          setNewActLng('');
      }
  };

  const handleOptimize = () => {
      setIsOptimizing(true);
      setTimeout(() => {
          const optimized = [...activities];
          let current_time = new Date(`${trip.start}T09:00:00`);
          
          optimized.forEach(act => {
              act.start_time = new Date(current_time);
              current_time.setMinutes(current_time.getMinutes() + act.duration);
              act.end_time = new Date(current_time);
              current_time.setMinutes(current_time.getMinutes() + 15); 
          });
          setActivities(optimized);
          setIsOptimizing(false);
      }, 1500);
  };

  const handleReroute = () => {
      if (!delayMinutes) return;
      setIsRerouting(true);
      
      setTimeout(() => {
          const delay = parseInt(delayMinutes) || 0;
          const rerouted = activities.map(act => {
              if (!act.start_time) return act;
              const newStart = new Date(act.start_time);
              newStart.setMinutes(newStart.getMinutes() + delay);
              const newEnd = new Date(act.end_time);
              newEnd.setMinutes(newEnd.getMinutes() + delay);
              return { ...act, start_time: newStart, end_time: newEnd };
          });
          setActivities(rerouted);
          setIsRerouting(false);
          setDelayMinutes('');
      }, 1000);
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (file) {
          setDocuments([...documents, {
              id: Date.now(),
              name: file.name,
              type: file.type || 'Document'
          }]);
      }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const budgetLimit = parseFloat(trip.budget) || 1000;
  const currentTotal = totalExpenses + (predictedCost || 0);
  const budgetPercentage = Math.min((currentTotal / budgetLimit) * 100, 100);
  const isOverBudget = currentTotal > budgetLimit;

  const formatTime = (dateObj) => {
      if (!dateObj) return 'Unscheduled';
      const d = new Date(dateObj); // In case it was parsed from localStorage JSON
      if (isNaN(d.getTime())) return 'Unscheduled';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="trip-detail" style={{width: '100%'}}>
        {isOffline && (
            <div style={{background: '#ef4444', color: 'white', padding: '0.5rem', textAlign: 'center', borderRadius: '8px', marginBottom: '1rem'}}>
                You are currently offline. Viewing cached itinerary.
            </div>
        )}
        <button className="btn-secondary" onClick={onBack}>&larr; Back to Dashboard</button>
        <header style={{textAlign: 'left', marginTop: '2rem'}}>
            <h1 style={{fontSize: '2.5rem', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800}}>{trip.title}</h1>
            <p style={{color: 'var(--text-muted)'}}>{trip.start} to {trip.end}</p>
        </header>

        <div className="dashboard" style={{marginTop: '2rem'}}>
            
            {/* Universal Document Locker */}
            <div className="card">
                <h2>Document Locker</h2>
                <div style={{marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                    {documents.length === 0 ? (
                        <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>No documents uploaded yet.</p>
                    ) : (
                        documents.map(doc => (
                            <div key={doc.id} style={{padding: '0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '0.9rem'}}>
                                📄 {doc.name}
                            </div>
                        ))
                    )}
                </div>
                <div style={{marginTop: '1rem'}}>
                    <input type="file" onChange={handleFileUpload} style={{padding: '0.5rem', fontSize: '0.8rem'}} />
                </div>
            </div>

            {/* Smart Packing */}
            <div className="card">
                <h2>Smart Packing</h2>
                {!packingList ? (
                    <div style={{textAlign: 'center', padding: '2rem 0'}}>
                        <p style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>Get an AI-generated checklist based on your destination and weather.</p>
                        <button className="btn-primary" onClick={handleGeneratePackingList} disabled={isGenerating}>
                            {isGenerating ? 'Generating...' : 'Generate Checklist'}
                        </button>
                    </div>
                ) : (
                    <ul style={{listStyleType: 'none', marginTop: '1rem'}}>
                        {packingList.map((item, idx) => (
                            <li key={idx} style={{padding: '0.5rem 0', display: 'flex', alignItems: 'center'}}>
                                <input type="checkbox" style={{width: '20px', height: '20px', marginRight: '1rem', flexShrink: 0}} /> 
                                {item}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Itinerary & Dynamic Re-routing */}
            <div className="card" style={{gridColumn: '1 / -1'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'}}>
                    <h2>Itinerary & Optimization</h2>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                        <input type="number" placeholder="Delay (mins)" value={delayMinutes} onChange={e => setDelayMinutes(e.target.value)} style={{width: '120px', padding: '0.5rem'}} />
                        <button className="btn-secondary" onClick={handleReroute} disabled={isRerouting || !delayMinutes} style={{marginTop: 0}}>
                            {isRerouting ? 'Re-routing...' : 'Report Delay'}
                        </button>
                        <button className="btn-primary" onClick={handleOptimize} disabled={isOptimizing} style={{marginTop: 0}}>
                            {isOptimizing ? 'Optimizing...' : 'Optimize'}
                        </button>
                    </div>
                </div>
                
                <div style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    {activities.map((act, idx) => (
                        <div key={act.id} style={{display: 'flex', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: '4px solid var(--accent)'}}>
                            <div style={{minWidth: '120px', color: 'var(--text-muted)'}}>
                                {formatTime(act.start_time)}<br/>
                                {act.end_time && <span style={{fontSize: '0.8rem'}}>to {formatTime(act.end_time)}</span>}
                            </div>
                            <div>
                                <h3 style={{marginBottom: '0.25rem'}}>{act.title}</h3>
                                <p style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Duration: {act.duration}m | Lat: {act.lat || '?'} Lng: {act.lng || '?'}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                    <input type="text" placeholder="Activity Title" value={newActTitle} onChange={e => setNewActTitle(e.target.value)} style={{flex: 2}} />
                    <input type="number" placeholder="Lat" value={newActLat} onChange={e => setNewActLat(e.target.value)} style={{flex: 1}} />
                    <input type="number" placeholder="Lng" value={newActLng} onChange={e => setNewActLng(e.target.value)} style={{flex: 1}} />
                    <button className="btn-secondary" onClick={addActivity} style={{marginTop: 0}}>Add Activity</button>
                </div>
            </div>

            {/* Budget Tracker (Moved to bottom) */}
            <div className="card" style={{gridColumn: '1 / -1'}}>
                <h2>Predictive Budget & Live Expenses</h2>
                <div style={{display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem'}}>
                    <div style={{flex: 1, minWidth: '300px'}}>
                        <div style={{display: 'flex', gap: '0.5rem'}}>
                            <input type="text" placeholder="Expense (e.g. Dinner)" value={newExpenseTitle} onChange={e => setNewExpenseTitle(e.target.value)} />
                            <input type="number" placeholder="$" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} style={{width: '100px'}} />
                            <button className="btn-primary" style={{marginTop: '0'}} onClick={addExpense}>Add</button>
                        </div>
                        <div style={{marginTop: '1rem', maxHeight: '150px', overflowY: 'auto'}}>
                            {expenses.map(e => (
                                <div key={e.id} style={{display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)'}}>
                                    <span>{e.title}</span>
                                    <span>${e.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div style={{flex: 1, minWidth: '300px'}}>
                        <p>Total Expenses: <span style={{float: 'right'}}>${totalExpenses.toFixed(2)}</span></p>
                        <p>Predicted Remaining: <span style={{float: 'right'}}>${predictedCost ? predictedCost.toFixed(2) : '---'}</span></p>
                        <p style={{fontWeight: 'bold', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)', color: isOverBudget ? '#ef4444' : 'inherit'}}>
                            Projected Total: <span style={{float: 'right'}}>${currentTotal.toFixed(2)} / ${budgetLimit.toFixed(2)}</span>
                        </p>
                        
                        <div className="progress-bar-container" style={{marginTop: '1.5rem'}}>
                            <div className={`progress-bar ${isOverBudget ? 'danger' : ''}`} style={{width: `${budgetPercentage}%`}}></div>
                        </div>
                        
                        {!predictedCost && (
                            <button className="btn-primary" style={{width: '100%'}} onClick={handleForecastBudget}>Run AI Forecast</button>
                        )}
                        {isOverBudget && <p style={{color: '#ef4444', marginTop: '0.5rem', fontSize: '0.9rem', textAlign: 'center'}}>Warning: You are tracking over budget!</p>}
                    </div>
                </div>
            </div>

        </div>
    </div>
  );
};

export default TripDetail;
