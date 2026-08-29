import type { RegionConfig } from "../regionConfig";

export default function RegionalHero({ region, description, onPlan, onNearby }: { region: RegionConfig; description?: string; onPlan: () => void; onNearby: () => void }) {
  const hero = region.home.hero;
  const style = { "--hero-overlay": hero?.overlay || region.accent, ...(hero?.image ? { backgroundImage: `url(${hero.image})` } : {}) } as React.CSSProperties;
  return <section className={`home-regional-hero${hero?.image ? " has-image" : " awaiting-image"}`} style={style} aria-labelledby="regional-hero-title">
    {hero?.image && <img className="sr-only" src={hero.image} alt={hero.alt || ""} />}
    <div className="home-regional-hero-copy"><small>{region.regionName} 지역 AI 여행안내</small><h1 id="regional-hero-title">{hero?.titleLines?.map(line => <span key={line}>{line}</span>) || hero?.title || region.heroTitle}</h1><p>{hero?.description || description || region.heroCopy}</p><div className="home-regional-hero-actions"><button type="button" className="hero-main-action" onClick={onPlan}>여행안내 시작하기</button><button type="button" className="hero-secondary-action" onClick={onNearby}>내 주변 둘러보기</button></div></div>
  </section>;
}
