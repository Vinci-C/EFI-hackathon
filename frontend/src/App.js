import React, { useState, useEffect, useRef, useMemo } from 'react';
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

const createEventMarkerIcon = (count) => {
  return new L.divIcon({
    html: String(count),
    className: 'event-marker-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15]
  });
};

function getDistance(coords1, coords2) {
  const R = 6371e3; // metres
  const φ1 = coords1[0] * Math.PI / 180; // φ, λ in radians
  const φ2 = coords2[0] * Math.PI / 180;
  const Δφ = (coords2[0] - coords1[0]) * Math.PI / 180;
  const Δλ = (coords2[1] - coords1[1]) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
}

const findAffectedRoutes = (eventCoords, allBusStops) => {
  const nearbyStops = allBusStops.filter(stop => {
    const distance = getDistance(eventCoords, [stop.latitude, stop.longitude]);
    return distance <= 100;
  });

  if (nearbyStops.length > 0) {
    const services = new Set();
    nearbyStops.forEach(stop => {
      stop.services.forEach(service => services.add(service));
    });
    return { services: Array.from(services).sort(), source: 'nearby' };
  } else {
    let nearestBusStop = null;
    let minDistance = Infinity;

    allBusStops.forEach(busStop => {
      const distance = getDistance(eventCoords, [busStop.latitude, busStop.longitude]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBusStop = busStop;
      }
    });

    if (nearestBusStop) {
      return { services: nearestBusStop.services.sort(), source: 'nearest' };
    }
  }
  return { services: [], source: null };
};

function App() {
  const [events, setEvents] = useState([]);
  const [busStops, setBusStops] = useState([]);
  const [selectedBusStop, setSelectedBusStop] = useState(null);
  const [busDepartures, setBusDepartures] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState([]);
  const [startDate, setStartDate] = useState(null); // New state for start date
  const [endDate, setEndDate] = useState(null);     // New state for end date
  const [showAllBusStops, setShowAllBusStops] = useState(false);
  const [nearbyEvents, setNearbyEvents] = useState([]);
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

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const eventDate = new Date(event.start_ts);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;

      const categoryMatch = selectedCategory === 'All' || event.category === selectedCategory;
      const dateMatch = (!start || eventDate >= start) && (!end || eventDate <= end);

      return categoryMatch && dateMatch;
    });
  }, [events, selectedCategory, startDate, endDate]);

  useEffect(() => {
    if (selectedBusStop) {
      // Fetch bus departures when a bus stop is selected
      fetch(`https://tfe-opendata.com/api/v1/live_bus_times/${selectedBusStop.stop_id}`)
        .then(response => response.json())
        .then(data => {
          if (Array.isArray(data)) {
            const allDepartures = data.flatMap(route =>
              route.departures.map(departure => ({ ...departure, routeName: route.routeName }))
            );
            allDepartures.sort((a, b) => a.departureTimeUnix - b.departureTimeUnix);
            setBusDepartures(allDepartures.slice(0, 3));
          } else {
            setBusDepartures([]);
          }
          
          if (busStopMarkerRef.current) {
            busStopMarkerRef.current.openPopup();
          }
        })
        .catch(error => {
          console.error("Error fetching bus departures:", error);
          setBusDepartures([]);
        });
      
      const nearby = filteredEvents.filter(event => {
        const distance = getDistance([selectedBusStop.latitude, selectedBusStop.longitude], event.coords);
        return distance <= 150;
      });
      setNearbyEvents(nearby);
    }
  }, [selectedBusStop, filteredEvents]);

  const findNearestBusStop = (eventCoords) => {
    let nearestBusStop = null;
    let minDistance = Infinity;

    busStops.forEach(busStop => {
      const distance = getDistance(eventCoords, [busStop.latitude, busStop.longitude]);
      if (distance < minDistance) {
        minDistance = distance;
        nearestBusStop = busStop;
      }
    });

    setSelectedBusStop(nearestBusStop);
    setShowAllBusStops(false);
  };

  const eventsByCoord = filteredEvents.reduce((acc, event) => {
    const coordString = event.coords.join(',');
    if (!acc[coordString]) {
      acc[coordString] = [];
    }
    acc[coordString].push(event);
    return acc;
  }, {});

  const renderBusStopPopup = (busStop) => {
    const potentialPax = nearbyEvents.reduce((acc, event) => acc + (parseInt(event.capacity_calculated) || 0), 0);
    return (
      <Popup onClose={() => setSelectedBusStop(null)}>
        <b>{busStop.name}</b><br />
        Services: {busStop.services.join(', ')}
        {busDepartures.length > 0 && (
          <div>
            <h3>Next Departures:</h3>
            <ul>
              {busDepartures.map((departure, index) => {
                const minutesUntilDeparture = Math.floor((departure.departureTimeUnix * 1000 - Date.now()) / (60 * 1000));
                return (
                  <li key={index}>
                    <b>{departure.routeName}</b> to {departure.destination} in {minutesUntilDeparture > 0 ? minutesUntilDeparture : 0} mins
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {busDepartures.length === 0 && <p>No live departure information available.</p>}
        <hr />
        <h3>Nearby Events (within 150m):</h3>
        {nearbyEvents.length > 0 ? (
          <div>
            <p>Potential ridership increase due to events: {potentialPax}</p>
            <div style={{ maxHeight: '100px', overflowY: 'auto' }}>
              <ul>
                {nearbyEvents.map(event => (
                  <li key={event.id}>{event.name} ({event.capacity_calculated || 'N/A'})</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p>No events within 150m.</p>
        )}
      </Popup>
    );
  };

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
        <button className="toggle-bus-stops-button" onClick={() => setShowAllBusStops(!showAllBusStops)}>
          {showAllBusStops ? 'Hide' : 'Show'} All Bus Stops
        </button>
      </div>
      <MapContainer center={[55.9533, -3.1883]} zoom={13} style={{ height: "calc(100vh - 200px)", width: "100%" }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        <MarkerClusterGroup>
          {Object.entries(eventsByCoord).map(([coordString, eventsOnCoord]) => {
            const coords = coordString.split(',').map(Number);
            const affectedRoutes = findAffectedRoutes(coords, busStops);
            return (
              <Marker key={coordString} position={coords} icon={createEventMarkerIcon(eventsOnCoord.length)}>
                <Popup>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    <h3>{eventsOnCoord.length} Events at this location</h3>
                    <button onClick={() => findNearestBusStop(coords)}>Show nearest bus stop</button>
                    <hr />
                    <div>
                      <h4>Affected Bus Routes</h4>
                      {affectedRoutes.services.length > 0 ? (
                        <p>
                          <small>
                            {affectedRoutes.source === 'nearby' 
                              ? 'Routes from stops within 100m: ' 
                              : 'Routes from nearest stop: '}
                          </small>
                          {affectedRoutes.services.join(', ')}
                        </p>
                      ) : (
                        <p>No bus routes found nearby.</p>
                      )}
                    </div>
                    <hr />
                    {eventsOnCoord.map(event => (
                      <div key={`${event.id}-${event.venue_name}-${event.start_ts}`}>
                        <b>{event.name}</b><br />
                        {event.venue_name}<br />
                        {event.category}<br />
                        {new Date(event.start_ts).toLocaleDateString()} {new Date(event.start_ts).toLocaleTimeString()}<br />
                        {event.end_ts && `Ends: ${new Date(event.end_ts).toLocaleDateString()} ${new Date(event.end_ts).toLocaleTimeString()}`}<br />
                        Capacity: {event.capacity_calculated !== undefined && event.capacity_calculated !== null ? event.capacity_calculated : 'N/A'}<br />
                        <hr />
                      </div>
                    ))}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {showAllBusStops && busStops.map(busStop => (
          <Marker 
            key={busStop.stop_id} 
            position={[busStop.latitude, busStop.longitude]} 
            icon={busStopIcon}
            eventHandlers={{
              click: () => {
                setSelectedBusStop(busStop);
              },
            }}
          >
            {selectedBusStop && selectedBusStop.stop_id === busStop.stop_id && renderBusStopPopup(busStop)}
          </Marker>
        ))}

        {selectedBusStop && !showAllBusStops && (
          <Marker position={[selectedBusStop.latitude, selectedBusStop.longitude]} icon={busStopIcon} ref={busStopMarkerRef}>
            {renderBusStopPopup(selectedBusStop)}
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}

export default App;
