import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ConciergePage from './pages/ConciergePage';
import ItineraryPage from './pages/ItineraryPage';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';
import OntologyExplorerPage from './pages/OntologyExplorerPage';
import NearbyRestaurantsPage from './pages/NearbyRestaurantsPage';
import { RegionProvider } from './RegionContext';

export default function App() {
  return (
    <BrowserRouter>
      <RegionProvider><Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/gajo" element={<HomePage />} />
          <Route path="/okcheon" element={<HomePage />} />
          <Route path="/muan" element={<HomePage />} />
          <Route path="/gyeryong" element={<HomePage />} />
          <Route path="/hapcheon" element={<HomePage />} />
          <Route path="/daejeon-junggu" element={<HomePage />} />
          <Route path="/gajo/concierge" element={<ConciergePage />} />
          <Route path="/okcheon/concierge" element={<ConciergePage />} />
          <Route path="/muan/concierge" element={<ConciergePage />} />
          <Route path="/gyeryong/concierge" element={<ConciergePage />} />
          <Route path="/hapcheon/concierge" element={<ConciergePage />} />
          <Route path="/daejeon-junggu/concierge" element={<ConciergePage />} />
          <Route path="/gajo/itinerary" element={<ItineraryPage />} />
          <Route path="/okcheon/itinerary" element={<ItineraryPage />} />
          <Route path="/muan/itinerary" element={<ItineraryPage />} />
          <Route path="/gyeryong/itinerary" element={<ItineraryPage />} />
          <Route path="/hapcheon/itinerary" element={<ItineraryPage />} />
          <Route path="/daejeon-junggu/itinerary" element={<ItineraryPage />} />
          <Route path="/gajo/map" element={<MapPage />} />
          <Route path="/okcheon/map" element={<MapPage />} />
          <Route path="/muan/map" element={<MapPage />} />
          <Route path="/gyeryong/map" element={<MapPage />} />
          <Route path="/hapcheon/map" element={<MapPage />} />
          <Route path="/daejeon-junggu/map" element={<MapPage />} />
          <Route path="/gajo/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/okcheon/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/muan/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/gyeryong/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/hapcheon/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/daejeon-junggu/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/gajo/admin" element={<AdminPage />} />
          <Route path="/okcheon/admin" element={<AdminPage />} />
          <Route path="/muan/admin" element={<AdminPage />} />
          <Route path="/gyeryong/admin" element={<AdminPage />} />
          <Route path="/hapcheon/admin" element={<AdminPage />} />
          <Route path="/daejeon-junggu/admin" element={<AdminPage />} />
          <Route path="/concierge" element={<ConciergePage />} />
          <Route path="/itinerary" element={<ItineraryPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/nearby-restaurants" element={<NearbyRestaurantsPage />} />
          <Route path="/nearby-discovery" element={<NearbyRestaurantsPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/ontology" element={<OntologyExplorerPage />} />
        </Route>
      </Routes></RegionProvider>
    </BrowserRouter>
  );
}
