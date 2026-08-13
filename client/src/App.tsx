import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ConciergePage from './pages/ConciergePage';
import ItineraryPage from './pages/ItineraryPage';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';
import OntologyExplorerPage from './pages/OntologyExplorerPage';
import NearbyRestaurantsPage from './pages/NearbyRestaurantsPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/concierge" element={<ConciergePage />} />
          <Route path="/itinerary" element={<ItineraryPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/nearby-restaurants" element={<NearbyRestaurantsPage />} />
          <Route path="/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/ontology" element={<OntologyExplorerPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
