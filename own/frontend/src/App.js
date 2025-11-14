import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-markercluster';
import L from 'leaflet'; // Import Leaflet library
import './App.css';

// Custom icon for bus stops
const busStopIcon = new L.divIcon({
  className: 'custom-bus-icon',
  html: '<i class="fa-solid fa-bus" style="color: blue; font-size: 24px;"></i>',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -12]
});

function App() {
  const [events, setEvents] = useState([]);
  const [busStops, setBusStops] = useState([]);
  const [selectedBusStop, setSelectedBusStop] = useState(null);
  const [busDepartures, setBusDepartures] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [startDate, setStartDate] = useState(null); // New state for start date
  const [endDate, setEndDate] = useState(null);     // New state for end date
  const busStopMarkerRef = useRef();

  useEffect(() => {
    fetch('/data.json')
      .then(response => response.json())
      .then(data => {
        if (data.events) {
          setEvents(data.events);
          // Extract unique categories
          const uniqueCategories = ['All', ...new Set(data.events.map(event => event.category))];
          setCategories(uniqueCategories);
        }
      });

    fetch('https://tfe-opendata.com/api/v1/stops')
      .then(response => response.json())
      .then(data => {
        if (data.stops) {
          setBusStops(data.stops);
        }
      });
  }, []);

  useEffect(() => {
    if (selectedBusStop && busStopMarkerRef.current) {
      busStopMarkerRef.current.openPopup();

      // Fetch bus departures when a bus stop is selected
      fetch(`https://tfe-opendata.com/api/v1/live_bus_times/${selectedBusStop.stop_id}`)
        .then(response => response.json())
        .then(data => {
          if (data.departures) {
            // Get the next 3 departures
            setBusDepartures(data.departures.slice(0, 3));
          } else {
            setBusDepartures([]);
          }
        })
        .catch(error => {
          console.error("Error fetching bus departures:", error);
          setBusDepartures([]);
        });
    }
  }, [selectedBusStop]);

  const findNearestBusStop = (eventCoords) => {
    let nearestBusStop = null;
    let minDistance = Infinity;

    busStops.forEach(busStop => {
      const distance = Math.sqrt(
        Math.pow(eventCoords[0] - busStop.latitude, 2) +
        Math.pow(eventCoords[1] - busStop.longitude, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestBusStop = busStop;
      }
    });

    setSelectedBusStop(nearestBusStop);
  };

  const filteredEvents = events.filter(event => {
    const eventDate = new Date(event.start_ts);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const categoryMatch = selectedCategory === 'All' || event.category === selectedCategory;
    const dateMatch = (!start || eventDate >= start) && (!end || eventDate <= end);

    return categoryMatch && dateMatch;
  });

  return (
    <div className="App">
      <h1>Number of events: {filteredEvents.length}</h1>
      <div className="filter-controls">
        <div>
          <label htmlFor="category-filter">Filter by Category: </label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="start-date-filter">Start Date: </label>
          <input
            type="date"
            id="start-date-filter"
            value={startDate ? startDate.toISOString().split('T')[0] : ''}
            onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)}
          />
        </div>
        <div>
          <label htmlFor="end-date-filter">End Date: </label>
          <input
            type="date"
            id="end-date-filter"
            value={endDate ? endDate.toISOString().split('T')[0] : ''}
            onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)}
          />
        </div>
      </div>
      <MapContainer center={[55.9533, -3.1883]} zoom={13} style={{ height: "calc(100vh - 200px)", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup>
          {filteredEvents.map(event => (
            <Marker key={`${event.id}-${event.venue_name}-${event.start_ts}`} position={event.coords}>
              <Popup>
                <b>{event.name}</b><br />
                {event.venue_name}<br />
                {event.category}<br />
                {new Date(event.start_ts).toLocaleDateString()} {new Date(event.start_ts).toLocaleTimeString()}<br />
                {event.end_ts && `Ends: ${new Date(event.end_ts).toLocaleDateString()} ${new Date(event.end_ts).toLocaleTimeString()}`}<br />
                {event.capacity_calculated && `Capacity: ${event.capacity_calculated}`}<br />
                <button onClick={() => findNearestBusStop(event.coords)}>Show nearest bus stop</button>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
        {selectedBusStop && (
          <Marker position={[selectedBusStop.latitude, selectedBusStop.longitude]} icon={busStopIcon} ref={busStopMarkerRef}>
            <Popup>
              <b>Nearest Bus Stop:</b><br />
              {selectedBusStop.name}<br />
              Services: {selectedBusStop.services.join(', ')}
              {busDepartures.length > 0 && (
                <div>
                  <h3>Next Departures:</h3>
                  <ul>
                    {busDepartures.map((departure, index) => (
                      <li key={index}>
                        <b>{departure.pattern.line.name}</b> to {departure.pattern.headsign} in {Math.floor(departure.departures[0].departure_time / 60)} mins
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {busDepartures.length === 0 && <p>No live departure information available.</p>}
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

export default App;
