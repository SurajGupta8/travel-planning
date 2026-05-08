describe('Travel Engine — Full E2E Suite', () => {

  beforeEach(() => {
    // Intercept Google Login API
    cy.intercept('POST', '**/api/auth/google/', {
      statusCode: 200,
      body: {
        access: 'fake-access-token',
        refresh: 'fake-refresh-token',
        user: { id: 1, name: 'E2E Tester', email: 'e2e@test.com' }
      }
    }).as('googleLogin');

    // Intercept fetch trips
    cy.intercept('GET', '**/api/trips/', {
      statusCode: 200,
      body: [
        { id: 101, title: 'Summer in Kyoto', budget: 2000, start_date: '2026-07-01', end_date: '2026-07-15', latitude: 35.0116, longitude: 135.7681 }
      ]
    }).as('getTrips');

    // Intercept weather (using broad pattern)
    cy.intercept('GET', 'https://api.open-meteo.com/**', {
      statusCode: 200,
      body: {
        current: { temperature_2m: 25, weather_code: 1, apparent_temperature: 27, relative_humidity_2m: 60, wind_speed_10m: 10 },
        daily: { 
          time: ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'], 
          weather_code: [1,1,1,1,1], 
          temperature_2m_max: [30,30,30,30,30], 
          temperature_2m_min: [20,20,20,20,20], 
          precipitation_probability_max: [5,5,5,5,5] 
        }
      }
    }).as('getWeather');

    cy.visit('/');
    // Clear any cached state
    cy.window().then((win) => win.localStorage.clear());
    cy.reload();
  });

  // ============================================================
  // DASHBOARD TESTS
  // ============================================================

  it('loads the dashboard with title and trip cards', () => {
    cy.contains('h1', 'Travel Engine').should('be.visible');
    cy.contains('+ New Trip').should('be.visible');
    
    // Check for "Sign in with Google" (mocked component)
    cy.get('header').within(() => {
      cy.contains('Sign in with Google').should('exist');
    });
  });

  // ============================================================
  // TRIP CREATION FLOW
  // ============================================================

  it('creates a new trip via the modal', () => {
    // We need to be "logged in" to see the "New Trip" button properly in some states,
    // but in our app it's always visible.
    
    cy.contains('+ New Trip').click();
    
    cy.get('[role="dialog"]').should('be.visible');
    
    // Intercept create trip
    cy.intercept('POST', '**/api/trips/', {
      statusCode: 201,
      body: { id: 102, title: 'Weekend in Paris', budget: 3000, start_date: '2026-09-01', end_date: '2026-09-03', latitude: 48.8, longitude: 2.3 }
    }).as('createTrip');

    cy.get('#tripTitle').type('Weekend in Paris');
    cy.get('#tripBudget').type('3000');
    
    cy.contains('button', 'Save Trip').click();
    
    cy.wait('@createTrip');
    cy.contains('Weekend in Paris').should('be.visible');
  });

  // ============================================================
  // TRIP DETAIL NAVIGATION & INTERACTION
  // ============================================================

  it('navigates to trip detail and displays widgets', () => {
    // Mock login first
    cy.window().then((win) => {
      win.localStorage.setItem('te_access_token', 'fake');
      win.localStorage.setItem('te_user', JSON.stringify({ name: 'E2E Tester' }));
    });
    cy.reload();
    cy.wait('@getTrips');

    cy.contains('Summer in Kyoto').click();
    
    cy.contains('h1', 'Summer in Kyoto').should('be.visible');
    // Check for the map container/title since real Google Maps might not load without key in CI
    cy.contains('Trip Map View').should('be.visible');
    
    // Check weather (side-by-side)
    cy.contains('Destination Weather').should('be.visible');
    cy.wait('@getWeather');
    cy.contains('25°C').should('be.visible');
  });

  it('searches for flights', () => {
    // Mock login
    cy.window().then((win) => {
      win.localStorage.setItem('te_access_token', 'fake');
      win.localStorage.setItem('te_user', JSON.stringify({ name: 'E2E Tester' }));
    });
    cy.reload();
    cy.wait('@getTrips');

    cy.contains('Summer in Kyoto').click();
    
    cy.contains('Available Flights').should('be.visible');
    
    // Intercept AviationStack with delay to catch "Searching..."
    cy.intercept('GET', '**/api.aviationstack.com/**', {
      delay: 500,
      statusCode: 200,
      body: {
        data: [{
          flight: { iata: 'JL123' },
          airline: { name: 'Japan Airlines' },
          departure: { iata: 'HND', airport: 'Haneda', scheduled: '2026-07-01T10:00:00+00:00' },
          arrival: { iata: 'ITM', airport: 'Itami', scheduled: '2026-07-01T11:15:00+00:00' },
          flight_status: 'scheduled'
        }]
      }
    }).as('flightSearch');

    cy.contains('button', 'Search Flights').click();
    cy.contains('Searching...').should('be.visible');
    
    cy.wait('@flightSearch');
    cy.contains('JL123').should('be.visible');
    cy.contains('Book on Google Flights').should('be.visible');
  });

  it('adds an expense to the database', () => {
    // Mock login
    cy.window().then((win) => {
      win.localStorage.setItem('te_access_token', 'fake');
      win.localStorage.setItem('te_user', JSON.stringify({ name: 'E2E Tester' }));
    });
    cy.reload();
    cy.wait('@getTrips');

    cy.contains('Summer in Kyoto').click();
    
    // Intercept expense API
    cy.intercept('POST', '**/api/expenses/', {
      statusCode: 201,
      body: { id: 505, title: 'Souvenirs', amount: 50 }
    }).as('addExpense');

    cy.get('[aria-label="Expense Title"]').type('Souvenirs');
    cy.get('[aria-label="Expense Amount"]').type('50');
    cy.get('[aria-label="Add Expense"]').click();
    
    cy.wait('@addExpense');
    cy.contains('Souvenirs').should('be.visible');
  });

  it('uploads a document to the locker', () => {
    // Mock login
    cy.window().then((win) => {
      win.localStorage.setItem('te_access_token', 'fake');
      win.localStorage.setItem('te_user', JSON.stringify({ name: 'E2E Tester' }));
    });
    cy.reload();
    cy.wait('@getTrips');

    cy.contains('Summer in Kyoto').click();
    
    // Intercept document API
    cy.intercept('POST', '**/api/documents/', {
      statusCode: 201,
      body: { id: 808, title: 'hotel_booking.pdf', document_type: 'application/pdf' }
    }).as('uploadDoc');

    const fileName = 'hotel_booking.pdf';
    cy.get('input[type="file"]').selectFile({
      contents: Cypress.Buffer.from('dummy content'),
      fileName: fileName,
      lastModified: Date.now(),
    });
    
    cy.wait('@uploadDoc');
    cy.contains(fileName).should('be.visible');
  });
});
