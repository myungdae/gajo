import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRegion } from './RegionContext';
import { loadTripSession, setTripLanguage } from './tripSession';
import { localePath, resolveVisitorLocale, type VisitorLocale } from './visitorLocaleContract';
export type RegionalLanguage = VisitorLocale;
const DEVICE_KEY = 'regional-home-language-v1';
type LanguageContext = { language: RegionalLanguage; select: (locale: RegionalLanguage) => void; withLanguage: (path: string) => string };
const Context = createContext<LanguageContext | undefined>(undefined);
export function RegionalLanguageProvider({ children }: { children: ReactNode }) {
  const location = useLocation(), navigate = useNavigate(), region = useRegion();
  let saved: unknown;
  try { saved = loadTripSession(localStorage, region.id)?.language ?? localStorage.getItem(DEVICE_KEY); } catch { /* Storage is optional. */ }
  const language = resolveVisitorLocale(location.search, saved);
  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(DEVICE_KEY, language); setTripLanguage(region.id, language); } catch { /* URL remains authoritative. */ }
    const path = `${location.pathname}${location.search}${location.hash}`;
    const normalized = localePath(path, language);
    if (path !== normalized) navigate(normalized, { replace: true });
  }, [language, region.id, location.pathname, location.search, location.hash, navigate]);
  const value = useMemo<LanguageContext>(() => ({
    language, withLanguage: (path) => localePath(path, language),
    select: (next) => {
      try { localStorage.setItem(DEVICE_KEY, next); setTripLanguage(region.id, next); } catch { /* Storage is optional. */ }
      const params = new URLSearchParams(location.search); params.set('lang', next);
      navigate(`${location.pathname}?${params}${location.hash}`, { replace: true });
    },
  }), [language, region.id, location.pathname, location.search, location.hash, navigate]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useRegionalLanguage(): LanguageContext {
  const context = useContext(Context);
  if (!context) throw new Error('RegionalLanguageProvider is required');
  return context;
}
