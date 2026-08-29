import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import ConciergePage from './pages/ConciergePage';
import ItineraryPage from './pages/ItineraryPage';
import MapPage from './pages/MapPage';
import AdminPage from './pages/AdminPage';
import OntologyExplorerPage from './pages/OntologyExplorerPage';
import NearbyRestaurantsPage from './pages/NearbyRestaurantsPage';
import { RegionProvider } from './RegionContext';
import PartnerEntryPage from './pages/PartnerEntryPage';
import PartnerVisitPage from './pages/PartnerVisitPage';
import PartnerApplicationPage from './pages/PartnerApplicationPage';
import PartnerConsolePage from './pages/PartnerConsolePage';
import PlatformPortalPage from './pages/PlatformPortalPage';
import RegionSelectionPage from './pages/RegionSelectionPage';
import RegionAdoptionPage from './pages/RegionAdoptionPage';
import { appSurface, isPlatformPreview } from './regionRouting';
import RegionalReportPage from './pages/RegionalReportPage';

function RootEntry(){const surface=appSurface(window.location.pathname,window.location.search,window.location.hostname);return isPlatformPreview(window.location.hostname,window.location.search)?<PlatformPortalPage/>:surface==='UNSUPPORTED'?<main className="partner-flow"><h1>지원하지 않는 주소입니다</h1><p>공식 지역 서비스 주소 또는 exkovia.com에서 접속해 주세요.</p></main>:<HomePage/>}

export default function App() {
  return (
    <BrowserRouter>
      <RegionProvider><Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<RootEntry />} />
          <Route path="/regions" element={<RegionSelectionPage />} />
          <Route path="/regions/:regionId" element={<RegionSelectionPage />} />
          <Route path="/regions/:regionId/*" element={<Navigate to="/regions" replace />} />
          <Route path="/go/:partnerSlug" element={<PartnerEntryPage />} />
          <Route path="/visit/:partnerSlug" element={<PartnerVisitPage />} />
          <Route path="/partners/apply" element={<PartnerApplicationPage />} />
          <Route path="/partner/apply" element={<PartnerApplicationPage />} />
          <Route path="/partner/console" element={<PartnerConsolePage />} />
          <Route path="/region/apply" element={<RegionAdoptionPage />} />
          <Route path="/regional-report" element={<RegionalReportPage />} />
          <Route path="/:regionId/regional-report" element={<RegionalReportPage />} />
          <Route path="/partners/:partnerSlug/manage" element={<PartnerConsolePage />} />
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
          <Route path="/hapcheon/nearby" element={<NearbyRestaurantsPage />} />
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
