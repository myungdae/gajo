import { Link } from "react-router-dom";
import { useRegion } from "../RegionContext";
import RegionalLandingShare from "../components/RegionalLandingShare";

export default function HapcheonLandingPage() {
  const region = useRegion(), landing = region.landing;
  const ctaLabel = landing ? landing.ctaLabel : `${region.regionName} 여행 시작하기`;
  return <main className="regional-landing"><section className="regional-landing-poster" aria-labelledby="regional-landing-title"><img className="regional-landing-poster-image" src={landing?.posterImage} alt=""/><header className="sr-only"><h1 id="regional-landing-title">{landing?.title||region.heroTitle}</h1><p>{landing?.description||region.heroCopy}</p></header><RegionalLandingShare posterOverlay/><Link className="regional-landing-english" aria-label="Continue in English" to={`/${region.id}?start=ai&lang=en`} onClick={()=>sessionStorage.setItem('hapcheon-landing-complete','1')}>English</Link><Link className="regional-landing-cta" aria-label={ctaLabel} to={`/${region.id}?start=ai`} onClick={()=>sessionStorage.setItem('hapcheon-landing-complete','1')}><span className="sr-only">{ctaLabel}</span></Link></section></main>;
}
