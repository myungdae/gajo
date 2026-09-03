import { useRegionalLanguage } from '../RegionalLanguageContext';
import { VISITOR_FLOW_COPY } from '../visitorFlowCopy';
import type { NearbyPlace } from '../api/client';

export default function VisitorBusinessDetails({ place }: { place: NearbyPlace }) {
  const { language } = useRegionalLanguage();
  const content = place.visitorContent?.[language];
  if (!content) return null;
  const fields = [ ['signatureMenu', 'signatureMenu'], ['priceRange', 'priceRange'], ['hours', 'openingHours'], ['payment', 'payment'], ['parking', 'parking'], ['reservation', 'reservation'] ] as const;
  return <><p>{content.description}</p><dl className="entity-detail-list">{fields.map(([field, label]) => content[field] ? <div key={field}><dt>{VISITOR_FLOW_COPY[label][language]}</dt><dd translate="no">{content[field]}</dd></div> : null)}</dl></>;
}
