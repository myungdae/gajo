import { Link } from "react-router-dom";
import "./public-brand.css";

type PublicBrandProps = {
  className?: string;
  compact?: boolean;
  linked?: boolean;
};

function BrandContent() {
  return (
    <>
      <svg
        className="public-brand__symbol"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3.25 6.5 13.5 11M3.25 12h10.25M3.25 17.5 13.5 13" />
        <circle className="public-brand__traveler" cx="18.25" cy="12" r="2.4" />
      </svg>
      <span className="public-brand__wordmark">
        <strong>찾아오는 여행도우미</strong>
        <span className="public-brand__slogan">필요한 순간, 먼저 찾아갑니다.</span>
        <small>Powered by EXKOVIA</small>
      </span>
    </>
  );
}

export default function PublicBrand({
  className = "",
  compact = false,
  linked = true,
}: PublicBrandProps) {
  const classes = `public-brand${compact ? " public-brand--compact" : ""}${className ? ` ${className}` : ""}`;
  const label = compact
    ? "찾아오는 여행도우미, Powered by EXKOVIA"
    : "찾아오는 여행도우미, 필요한 순간 먼저 찾아갑니다, Powered by EXKOVIA";
  return linked ? (
    <Link className={classes} to="/" aria-label={`${label} 홈`}>
      <BrandContent />
    </Link>
  ) : (
    <div className={classes} aria-label={label}>
      <BrandContent />
    </div>
  );
}
