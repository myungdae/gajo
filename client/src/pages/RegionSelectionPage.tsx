import { useParams } from 'react-router-dom';
import '../platform.css';
import NationwideRegionExplorer from '../components/NationwideRegionExplorer';
import PublicBrand from '../components/PublicBrand';

export default function RegionSelectionPage(){const {regionId}=useParams();return <div className="platform-page"><header className="platform-header"><PublicBrand/><span>전국 지역 선택</span></header><main className="platform-main region-directory-main"><NationwideRegionExplorer routeRegionId={regionId} routed /></main></div>}
