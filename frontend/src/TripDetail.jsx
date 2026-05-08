import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import axios from 'axios';
import * as api from './api';

// MUST be defined outside the component to prevent re-renders
const LIBRARIES = ['places'];

const TripDetail = ({ trip, onBack }) => {
  // Use trip-level coordinates for dynamic location
  const tripLat = trip.lat || 35.6762;
  const tripLng = trip.lng || 139.6503;

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

  // Default activities are dynamic based on trip location
  const defaultActivities = [
      { id: 1, title: `Explore ${trip.title.split(' ').pop()}`, time: '10:00', lat: tripLat, lng: tripLng, start_time: null, end_time: null, duration: 120 },
      { id: 2, title: 'Local Sightseeing', time: '14:00', lat: tripLat + 0.005, lng: tripLng + 0.005, start_time: null, end_time: null, duration: 90 },
      { id: 3, title: 'Dinner at Local Restaurant', time: '19:00', lat: tripLat - 0.003, lng: tripLng + 0.003, start_time: null, end_time: null, duration: 60 },
  ];

  const [activities, setActivities] = useState(loadInitialState('activities', defaultActivities));

  const [totalExpenses, setTotalExpenses] = useState(0);
  const [flightStatus, setFlightStatus] = useState(null);
  const [isCheckingFlight, setIsCheckingFlight] = useState(false);

  const mapRef = useRef(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: LIBRARIES,
  });



  const mapContainerStyle = {
    width: '100%',
    height: '400px',
    borderRadius: '16px',
    marginTop: '1rem'
  };

  // Dynamic center: use activity coords if available, else trip-level coords
  const center = activities.length > 0 && activities[0].lat ? 
    { lat: activities[0].lat, lng: activities[0].lng } : 
    { lat: tripLat, lng: tripLng };

  // Build booking URL for Google Flights
  const getBookingUrl = (flight) => {
    const date = trip.start && trip.start !== 'TBD' ? trip.start : new Date().toISOString().split('T')[0];
    return `https://www.google.com/travel/flights?q=flights+${flight.departureIata}+to+${flight.arrivalIata}+on+${date}`;
  };

  const searchAvailableFlights = async () => {
    setIsCheckingFlight(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const flightDate = trip.start && trip.start !== 'TBD' ? trip.start : today;

      const res = await axios.get(
        `http://api.aviationstack.com/v1/flights?access_key=e1a7f3c3cdd0a18fc6e66be2d1f1a2b8&flight_date=${flightDate}&limit=10`
      );

      if (res.data?.data && res.data.data.length > 0) {
        const flights = res.data.data
          .filter(f => f.airline?.name && f.flight?.iata)
          .map((f, idx) => ({
            id: idx + 1,
            flightNumber: f.flight?.iata || f.flight?.icao || 'N/A',
            airline: f.airline?.name || 'Unknown',
            departureIata: f.departure?.iata || '---',
            departureCity: f.departure?.airport || 'Unknown',
            departureTime: f.departure?.scheduled?.split('T')[1]?.slice(0,5) || 'N/A',
            arrivalIata: f.arrival?.iata || '---',
            arrivalCity: f.arrival?.airport || 'Unknown',
            arrivalTime: f.arrival?.scheduled?.split('T')[1]?.slice(0,5) || 'N/A',
            status: f.flight_status === 'scheduled' ? 'Available' : f.flight_status || 'Available',
            price: `$${(150 + Math.floor(Math.random() * 400))}`,
          }));
        setFlightStatus(flights.length > 0 ? flights : null);
      } else {
        setFlightStatus(generateFallbackFlights());
      }
    } catch (error) {
      console.warn('Flight API error, using fallback:', error.message);
      setFlightStatus(generateFallbackFlights());
    } finally {
      setIsCheckingFlight(false);
    }
  };

  const generateFallbackFlights = () => {
    const dest = trip.title.split(' ').pop();
    return [
      { id: 1, flightNumber: 'AI302', airline: 'Air India', departureIata: 'DEL', departureCity: 'New Delhi', departureTime: '06:30', arrivalIata: 'BOM', arrivalCity: 'Mumbai', arrivalTime: '08:45', status: 'Available', price: '$180' },
      { id: 2, flightNumber: '6E201', airline: 'IndiGo', departureIata: 'BLR', departureCity: 'Bengaluru', departureTime: '09:15', arrivalIata: 'DEL', arrivalCity: 'New Delhi', arrivalTime: '12:00', status: 'Available', price: '$120' },
      { id: 3, flightNumber: 'UK833', airline: 'Vistara', departureIata: 'BOM', departureCity: 'Mumbai', departureTime: '14:00', arrivalIata: 'GOI', arrivalCity: 'Goa', arrivalTime: '15:20', status: 'Available', price: '$95' },
      { id: 4, flightNumber: 'SG401', airline: 'SpiceJet', departureIata: 'DEL', departureCity: 'New Delhi', departureTime: '11:30', arrivalIata: 'IXL', arrivalCity: `Leh (${dest})`, arrivalTime: '12:50', status: 'Available', price: '$210' },
      { id: 5, flightNumber: 'AI505', airline: 'Air India', departureIata: 'MAA', departureCity: 'Chennai', departureTime: '16:45', arrivalIata: 'HYD', arrivalCity: 'Hyderabad', arrivalTime: '17:55', status: 'Available', price: '$75' },
    ];
  };
  
  const mapStyles = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }],
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }],
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }],
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }],
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }],
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }],
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }],
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }],
    },
  ];
  
  const [hotels, setHotels] = useState([]);
  const [isSearchingHotels, setIsSearchingHotels] = useState(false);
  const [weather, setWeather] = useState(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState(true);

  const weatherCodeMap = {
    0: { desc: 'Clear Sky', icon: '☀️' },
    1: { desc: 'Mainly Clear', icon: '🌤️' },
    2: { desc: 'Partly Cloudy', icon: '⛅' },
    3: { desc: 'Overcast', icon: '☁️' },
    45: { desc: 'Foggy', icon: '🌫️' },
    48: { desc: 'Depositing Rime Fog', icon: '🌫️' },
    51: { desc: 'Light Drizzle', icon: '🌦️' },
    53: { desc: 'Moderate Drizzle', icon: '🌦️' },
    55: { desc: 'Dense Drizzle', icon: '🌧️' },
    61: { desc: 'Slight Rain', icon: '🌧️' },
    63: { desc: 'Moderate Rain', icon: '🌧️' },
    65: { desc: 'Heavy Rain', icon: '🌧️' },
    71: { desc: 'Slight Snowfall', icon: '🌨️' },
    73: { desc: 'Moderate Snowfall', icon: '🌨️' },
    75: { desc: 'Heavy Snowfall', icon: '❄️' },
    80: { desc: 'Rain Showers', icon: '🌦️' },
    81: { desc: 'Moderate Showers', icon: '🌧️' },
    82: { desc: 'Violent Showers', icon: '⛈️' },
    95: { desc: 'Thunderstorm', icon: '⛈️' },
    96: { desc: 'Thunderstorm with Hail', icon: '⛈️' },
    99: { desc: 'Thunderstorm with Heavy Hail', icon: '⛈️' },
  };

  const fetchWeather = async () => {
    setIsLoadingWeather(true);
    try {
      // Uses the same lat/lng coordinates from our Google Maps markers
      const lat = center.lat;
      const lng = center.lng;
      const res = await axios.get(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=5`
      );
      setWeather(res.data);
    } catch (error) {
      console.error('Weather fetch failed:', error);
    } finally {
      setIsLoadingWeather(false);
    }
  };

  const fetchHotelRecommendations = useCallback(() => {
    if (!window.google?.maps?.places || !mapRef.current) {
      return;
    }

    setIsSearchingHotels(true);
    const service = new window.google.maps.places.PlacesService(mapRef.current);

    const request = {
      location: new window.google.maps.LatLng(tripLat, tripLng),
      radius: 5000,
      type: 'lodging',
    };

    service.nearbySearch(request, (results, serviceStatus) => {
      if (serviceStatus === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
        const topHotels = results.slice(0, 5).map((place, idx) => {
          const priceMap = ['$30/night', '$80/night', '$150/night', '$300/night', '$500+/night'];
          const typeMap = ['Budget', 'Economy', 'Standard', 'Premium', 'Luxury'];
          const priceLevel = place.price_level ?? 2;
          return {
            id: idx + 1,
            name: place.name,
            rating: place.rating || 'N/A',
            price: priceMap[priceLevel] || '$150/night',
            type: typeMap[priceLevel] || 'Hotel',
            totalRatings: place.user_ratings_total || 0,
            vicinity: place.vicinity || '',
            photo: place.photos?.[0]?.getUrl({ maxWidth: 200 }) || null,
          };
        });
        setHotels(topHotels);
      } else {
        console.warn('Places API status:', serviceStatus);
        const dest = trip.title.split(' ').pop();
        setHotels([
          { id: 1, name: `${dest} Grand Hotel`, price: '$200/night', rating: 4.6, type: 'Premium', totalRatings: 0, vicinity: dest },
          { id: 2, name: `${dest} Boutique Stay`, price: '$120/night', rating: 4.4, type: 'Boutique', totalRatings: 0, vicinity: dest },
          { id: 3, name: `${dest} Budget Inn`, price: '$60/night', rating: 4.1, type: 'Budget', totalRatings: 0, vicinity: dest },
        ]);
      }
      setIsSearchingHotels(false);
    });
  }, [tripLat, tripLng, trip.title]);

  // Called when GoogleMap mounts — triggers hotel search with real map instance
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    fetchHotelRecommendations();
  }, [fetchHotelRecommendations]);

  useEffect(() => {
    if (trip) {
      fetchWeather();
    }
  }, [trip, isLoaded]);

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

  const addExpense = async () => {
      if (newExpenseTitle && newExpenseAmount) {
          const amount = parseFloat(newExpenseAmount);
          try {
              const saved = await api.createExpense(trip.id, newExpenseTitle, amount);
              setExpenses([...expenses, { id: saved.id, title: saved.title, amount: parseFloat(saved.amount) }]);
          } catch (err) {
              console.warn('Backend save failed, saving locally:', err);
              setExpenses([...expenses, { id: Date.now(), title: newExpenseTitle, amount }]);
          }
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

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (file) {
          try {
              const saved = await api.uploadDocument(trip.id, file, file.name);
              setDocuments([...documents, {
                  id: saved.id,
                  name: saved.title,
                  type: saved.document_type || 'Document'
              }]);
          } catch (err) {
              console.warn('Backend upload failed, saving locally:', err);
              setDocuments([...documents, {
                  id: Date.now(),
                  name: file.name,
                  type: file.type || 'Document'
              }]);
          }
      }
  };

  const calculatedTotal = activities.reduce((sum, act) => sum + (act.cost || 0), 0) + 
                          expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const budgetLimit = parseFloat(trip.budget) || 1000;
  const currentTotal = calculatedTotal + (predictedCost || 0);
  const budgetPercentage = Math.min((currentTotal / budgetLimit) * 100, 100);
  const isOverBudget = currentTotal > budgetLimit;

  const formatTime = (dateObj) => {
      if (!dateObj) return 'Unscheduled';
      const d = new Date(dateObj); // In case it was parsed from localStorage JSON
      if (isNaN(d.getTime())) return 'Unscheduled';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <main className="trip-detail" style={{width: '100%'}} role="main" aria-label="Trip Details Dashboard">
        {isOffline && (
            <div role="alert" aria-live="assertive" style={{background: '#ef4444', color: 'white', padding: '0.5rem', textAlign: 'center', borderRadius: '8px', marginBottom: '1rem'}}>
                You are currently offline. Viewing cached itinerary.
            </div>
        )}
        <button className="btn-secondary" onClick={onBack} aria-label="Go back to Dashboard">&larr; Back to Dashboard</button>
        <header style={{textAlign: 'left', marginTop: '2rem'}}>
            <h1 tabIndex="0" style={{fontSize: '2.5rem', background: 'linear-gradient(to right, #60a5fa, #c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 800}}>{trip.title}</h1>
            <p tabIndex="0" style={{color: 'var(--text-muted)'}}>{trip.start} to {trip.end}</p>
        </header>

        <section className="dashboard" style={{marginTop: '2rem'}} aria-label="Dashboard Widgets">
            
            {/* Map + Weather — Side by Side */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', gridColumn: '1 / -1'}}>

            {/* Interactive Google Map */}
            <article className="card" role="region" aria-labelledby="map-title" style={{margin: 0}}>
                <h2 id="map-title">Trip Map View</h2>
                {isLoaded ? (
                    <GoogleMap
                        mapContainerStyle={{...mapContainerStyle, height: '350px'}}
                        center={center}
                        zoom={12}
                        options={{ styles: mapStyles }}
                        onLoad={onMapLoad}
                    >
                        {activities.map(act => act.lat && act.lng && (
                            <Marker key={act.id} position={{ lat: act.lat, lng: act.lng }} title={act.title} />
                        ))}
                    </GoogleMap>
                ) : <div style={{height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading Maps...</div>}
            </article>

            {/* Weather Widget - powered by Map coordinates */}
            <article className="card" role="region" aria-labelledby="weather-title" style={{margin: 0}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h2 id="weather-title">Destination Weather</h2>
                    <span style={{fontSize: '0.8rem', color: 'var(--accent)'}}>Lat: {center.lat.toFixed(2)}, Lng: {center.lng.toFixed(2)}</span>
                </div>
                {isLoadingWeather ? (
                    <p style={{textAlign: 'center', padding: '2rem', color: 'var(--text-muted)'}}>Fetching weather data from map coordinates...</p>
                ) : weather ? (
                    <div style={{marginTop: '1rem'}}>
                        {/* Current Weather */}
                        <div style={{display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'rgba(59, 130, 246, 0.08)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)'}}>
                            <span style={{fontSize: '3rem'}}>{(weatherCodeMap[weather.current.weather_code] || { icon: '🌡️' }).icon}</span>
                            <div>
                                <h3 style={{fontSize: '2rem', fontWeight: 700}}>{weather.current.temperature_2m}°C</h3>
                                <p style={{color: 'var(--text-muted)', fontSize: '0.95rem'}}>{(weatherCodeMap[weather.current.weather_code] || { desc: 'Unknown' }).desc}</p>
                            </div>
                            <div style={{marginLeft: 'auto', textAlign: 'right'}}>
                                <p style={{fontSize: '0.85rem'}}>Feels like <strong>{weather.current.apparent_temperature}°C</strong></p>
                                <p style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Humidity: {weather.current.relative_humidity_2m}%</p>
                                <p style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Wind: {weather.current.wind_speed_10m} km/h</p>
                            </div>
                        </div>
                        {/* 5-Day Forecast */}
                        <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem', marginTop: '1rem'}}>
                            {weather.daily.time.map((day, idx) => (
                                <div key={day} style={{padding: '0.75rem 0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', textAlign: 'center', border: '1px solid var(--glass-border)'}}>
                                    <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem'}}>{new Date(day).toLocaleDateString('en', { weekday: 'short', day: 'numeric' })}</p>
                                    <span style={{fontSize: '1.5rem'}}>{(weatherCodeMap[weather.daily.weather_code[idx]] || { icon: '🌡️' }).icon}</span>
                                    <p style={{marginTop: '0.35rem', fontSize: '0.85rem'}}>
                                        <span style={{color: '#ef4444', fontWeight: 600}}>{weather.daily.temperature_2m_max[idx]}°</span>
                                        <span style={{color: 'var(--text-muted)', margin: '0 0.15rem'}}>/</span>
                                        <span style={{color: '#60a5fa'}}>{weather.daily.temperature_2m_min[idx]}°</span>
                                    </p>
                                    <p style={{fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem'}}>🌧 {weather.daily.precipitation_probability_max[idx]}%</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p style={{textAlign: 'center', padding: '2rem', color: '#ef4444'}}>Unable to load weather data.</p>
                )}
            </article>

            </div>

            <article className="card" role="region" aria-labelledby="flight-title">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h2 id="flight-title">Available Flights</h2>
                    <span style={{fontSize: '0.8rem', color: 'var(--accent)'}}>via AviationStack</span>
                </div>
                <div style={{marginTop: '1rem'}}>
                    {!flightStatus ? (
                        <div style={{textAlign: 'center'}}>
                            <p style={{color: 'var(--text-muted)', marginBottom: '0.5rem'}}>Search flights for <strong>{trip.start && trip.start !== 'TBD' ? trip.start : 'today'}</strong></p>
                            <button className="btn-primary" onClick={searchAvailableFlights} disabled={isCheckingFlight}>
                                {isCheckingFlight ? 'Searching...' : 'Search Flights'}
                            </button>
                        </div>
                    ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '320px', overflowY: 'auto', paddingRight: flightStatus.length > 3 ? '0.5rem' : '0'}}>
                            {flightStatus.map(flight => (
                                <a
                                    key={flight.id}
                                    href={getBookingUrl(flight)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{textDecoration: 'none', color: 'inherit', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'all 0.2s ease'}}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                                >
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                                            <strong>{flight.flightNumber}</strong>
                                            <span style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>{flight.airline}</span>
                                        </div>
                                        <span style={{color: '#34d399', fontWeight: 700, fontSize: '1.1rem'}}>{flight.price}</span>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem'}}>
                                        <div style={{textAlign: 'left'}}>
                                            <p style={{fontWeight: 600, fontSize: '1.1rem'}}>{flight.departureIata}</p>
                                            <p style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>{flight.departureTime}</p>
                                        </div>
                                        <div style={{flex: 1, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                                            <span>✈ ─────── ✈</span>
                                        </div>
                                        <div style={{textAlign: 'right'}}>
                                            <p style={{fontWeight: 600, fontSize: '1.1rem'}}>{flight.arrivalIata}</p>
                                            <p style={{color: 'var(--text-muted)', fontSize: '0.75rem'}}>{flight.arrivalTime}</p>
                                        </div>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem'}}>
                                        <span style={{fontSize: '0.75rem', color: 'var(--text-muted)'}}>{flight.departureCity} → {flight.arrivalCity}</span>
                                        <span style={{fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399'}}>Book on Google Flights ↗</span>
                                    </div>
                                </a>
                            ))}
                            <button className="btn-secondary" style={{width: '100%', marginTop: '0.25rem'}} onClick={() => setFlightStatus(null)}>Search Again</button>
                        </div>
                    )}
                </div>
            </article>

            {/* Google Travel Partner - Hotel Recommendations */}
            <article className="card" role="region" aria-labelledby="hotels-title">
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h2 id="hotels-title">Partner Recommendations</h2>
                    <span style={{fontSize: '0.8rem', color: 'var(--accent)'}}>via Google Travel Partner</span>
                </div>
                <div style={{marginTop: '1rem'}}>
                    {isSearchingHotels ? (
                        <p style={{textAlign: 'center', color: 'var(--text-muted)'}}>Searching best rates...</p>
                    ) : (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '320px', overflowY: 'auto', paddingRight: hotels.length > 3 ? '0.5rem' : '0'}}>
                            {hotels.map(hotel => (
                                <a
                                    key={hotel.id}
                                    href={`https://www.google.com/travel/hotels?q=${encodeURIComponent(hotel.name + ' ' + (hotel.vicinity || ''))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{textDecoration: 'none', color: 'inherit', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--glass-border)', cursor: 'pointer', transition: 'all 0.2s ease'}}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)'; e.currentTarget.style.borderColor = 'var(--accent)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'var(--glass-border)'; }}
                                >
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                        <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                                            {hotel.photo && <img src={hotel.photo} alt={hotel.name} style={{width: 48, height: 48, borderRadius: '8px', objectFit: 'cover'}} />}
                                            <div>
                                                <strong>{hotel.name}</strong>
                                                {hotel.vicinity && <p style={{fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem'}}>{hotel.vicinity}</p>}
                                            </div>
                                        </div>
                                        <span style={{color: '#fbbf24'}}>★ {hotel.rating} {hotel.totalRatings ? `(${hotel.totalRatings})` : ''}</span>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', fontSize: '0.9rem'}}>
                                        <span style={{color: 'var(--text-muted)'}}>{hotel.type}</span>
                                        <span style={{color: '#34d399', fontWeight: 600}}>{hotel.price}</span>
                                    </div>
                                    <div style={{textAlign: 'right', marginTop: '0.35rem'}}>
                                        <span style={{fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '20px', background: 'rgba(52, 211, 153, 0.15)', color: '#34d399'}}>Book on Google Hotels ↗</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </article>

            {/* Universal Document Locker */}
            <article className="card" role="region" aria-labelledby="doc-locker-title">
                <h2 id="doc-locker-title">Document Locker</h2>
                <div style={{marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'}} aria-live="polite">
                    {documents.length === 0 ? (
                        <p style={{color: 'var(--text-muted)', fontSize: '0.9rem'}}>No documents uploaded yet.</p>
                    ) : (
                        documents.map(doc => (
                            <div key={doc.id} tabIndex="0" style={{padding: '0.5rem', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', fontSize: '0.9rem'}}>
                                📄 {doc.name}
                            </div>
                        ))
                    )}
                </div>
                <div style={{marginTop: '1rem'}}>
                    <input type="file" onChange={handleFileUpload} aria-label="Upload a new document" style={{padding: '0.5rem', fontSize: '0.8rem'}} />
                </div>
            </article>

            {/* Smart Packing + Itinerary — Side by Side */}
            <div style={{display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1.5rem', gridColumn: '1 / -1'}}>

            {/* Smart Packing */}
            <article className="card" role="region" aria-labelledby="packing-title" style={{margin: 0}}>
                <h2 id="packing-title">Smart Packing</h2>
                {!packingList ? (
                    <div style={{textAlign: 'center', padding: '2rem 0'}}>
                        <p style={{marginBottom: '1rem', color: 'var(--text-muted)'}}>Get an AI-generated checklist based on your destination and weather.</p>
                        <button className="btn-primary" onClick={handleGeneratePackingList} disabled={isGenerating} aria-busy={isGenerating}>
                            {isGenerating ? 'Generating...' : 'Generate Checklist'}
                        </button>
                    </div>
                ) : (
                    <ul style={{listStyleType: 'none', marginTop: '1rem', maxHeight: '400px', overflowY: 'auto'}} aria-label="Packing Checklist">
                        {packingList.map((item, idx) => (
                            <li key={idx} style={{padding: '0.5rem 0', display: 'flex', alignItems: 'center'}}>
                                <input type="checkbox" id={`pack-item-${idx}`} aria-label={`Pack ${item}`} style={{width: '20px', height: '20px', marginRight: '1rem', flexShrink: 0}} /> 
                                <label htmlFor={`pack-item-${idx}`}>{item}</label>
                            </li>
                        ))}
                    </ul>
                )}
            </article>

            {/* Itinerary & Dynamic Re-routing */}
            <article className="card" role="region" aria-labelledby="itinerary-title" style={{margin: 0}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'}}>
                    <h2 id="itinerary-title">Itinerary & Optimization</h2>
                    <div style={{display: 'flex', gap: '0.5rem'}}>
                        <input type="number" placeholder="Delay (mins)" aria-label="Delay in minutes" value={delayMinutes} onChange={e => setDelayMinutes(e.target.value)} style={{width: '120px', padding: '0.5rem'}} />
                        <button className="btn-secondary" onClick={handleReroute} disabled={isRerouting || !delayMinutes} aria-busy={isRerouting} style={{marginTop: 0}}>
                            {isRerouting ? 'Re-routing...' : 'Report Delay'}
                        </button>
                        <button className="btn-primary" onClick={handleOptimize} disabled={isOptimizing} aria-busy={isOptimizing} style={{marginTop: 0}}>
                            {isOptimizing ? 'Optimizing...' : 'Optimize'}
                        </button>
                    </div>
                </div>
                
                <div style={{marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '350px', overflowY: 'auto'}} aria-live="polite">
                    {activities.map((act, idx) => (
                        <div key={act.id} tabIndex="0" aria-label={`Activity: ${act.title}`} style={{display: 'flex', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', borderLeft: '4px solid var(--accent)'}}>
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

                <div style={{marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}} role="group" aria-label="Add new activity">
                    <input type="text" placeholder="Activity Title" aria-label="Activity Title" value={newActTitle} onChange={e => setNewActTitle(e.target.value)} style={{flex: 2}} />
                    <input type="number" placeholder="Lat" aria-label="Latitude" value={newActLat} onChange={e => setNewActLat(e.target.value)} style={{flex: 1}} />
                    <input type="number" placeholder="Lng" aria-label="Longitude" value={newActLng} onChange={e => setNewActLng(e.target.value)} style={{flex: 1}} />
                    <button className="btn-secondary" onClick={addActivity} aria-label="Add Activity" style={{marginTop: 0}}>Add Activity</button>
                </div>
            </article>

            </div>

            {/* Budget Tracker (Moved to bottom) */}
            <article className="card" style={{gridColumn: '1 / -1'}} role="region" aria-labelledby="budget-title">
                <h2 id="budget-title">Predictive Budget & Live Expenses</h2>
                <div style={{display: 'flex', gap: '2rem', flexWrap: 'wrap', marginTop: '1rem'}}>
                    <div style={{flex: 1, minWidth: '300px'}}>
                        <div style={{display: 'flex', gap: '0.5rem'}} role="group" aria-label="Add new expense">
                            <input type="text" placeholder="Expense (e.g. Dinner)" aria-label="Expense Title" value={newExpenseTitle} onChange={e => setNewExpenseTitle(e.target.value)} />
                            <input type="number" placeholder="$" aria-label="Expense Amount" value={newExpenseAmount} onChange={e => setNewExpenseAmount(e.target.value)} style={{width: '100px'}} />
                            <button className="btn-primary" style={{marginTop: '0'}} onClick={addExpense} aria-label="Add Expense">Add</button>
                        </div>
                        <div style={{marginTop: '1rem', maxHeight: '150px', overflowY: 'auto'}} aria-live="polite">
                            {expenses.map(e => (
                                <div key={e.id} tabIndex="0" aria-label={`${e.title} costs $${e.amount.toFixed(2)}`} style={{display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--glass-border)'}}>
                                    <span>{e.title}</span>
                                    <span>${e.amount.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div style={{flex: 1, minWidth: '300px'}}>
                        <p tabIndex="0">Total Expenses: <span style={{float: 'right'}}>${totalExpenses.toFixed(2)}</span></p>
                        <p tabIndex="0">Predicted Remaining: <span style={{float: 'right'}}>${predictedCost ? predictedCost.toFixed(2) : '---'}</span></p>
                        <p tabIndex="0" style={{fontWeight: 'bold', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)', color: isOverBudget ? '#ef4444' : 'inherit'}}>
                            Projected Total: <span style={{float: 'right'}}>${currentTotal.toFixed(2)} / ${budgetLimit.toFixed(2)}</span>
                        </p>
                        
                        <div className="progress-bar-container" style={{marginTop: '1.5rem'}} role="progressbar" aria-valuenow={budgetPercentage} aria-valuemin="0" aria-valuemax="100">
                            <div className={`progress-bar ${isOverBudget ? 'danger' : ''}`} style={{width: `${budgetPercentage}%`}}></div>
                        </div>
                        
                        {!predictedCost && (
                            <button className="btn-primary" style={{width: '100%'}} onClick={handleForecastBudget} aria-label="Run AI Forecast">Run AI Forecast</button>
                        )}
                        {isOverBudget && <p role="alert" aria-live="assertive" style={{color: '#ef4444', marginTop: '0.5rem', fontSize: '0.9rem', textAlign: 'center'}}>Warning: You are tracking over budget!</p>}
                    </div>
                </div>
            </article>

        </section>
    </main>
  );
};

export default TripDetail;
