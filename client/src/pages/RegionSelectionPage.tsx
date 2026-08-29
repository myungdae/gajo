import { Link, useParams } from 'react-router-dom';
import '../platform.css';
import NationwideRegionExplorer from '../components/NationwideRegionExplorer';

export default function RegionSelectionPage(){const {regionId}=useParams();return <div className="platform-page"><header className="platform-header"><Link to="/" className="platform-brand">EXKOVIA</Link><span>전국 지역 선택</span></header><main className="platform-main region-directory-main"><NationwideRegionExplorer initialRegionId={regionId}/></main></div>}
