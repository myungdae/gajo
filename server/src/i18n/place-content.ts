/** Only names backed by official sources or explicit regional review are published. */
export interface ReviewedPlaceContent {
  officialEnglishName?: string;
  reviewedEnglishName?: string;
  en?: Partial<Record<'category' | 'description' | 'signatureMenu' | 'priceRange' | 'hours' | 'payment' | 'parking' | 'reservation', string>>;
  ko?: ReviewedPlaceContent['en'];
}

export function visitorPlaceName(korean: string, content?: ReviewedPlaceContent): string {
  return content?.officialEnglishName?.trim() || content?.reviewedEnglishName?.trim() || korean;
}

export function validVisitorContent(value: unknown): value is ReviewedPlaceContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const fields = value as Record<string, unknown>;
  const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 2000;
  return Object.entries(fields).every(([key, item]) => {
    if (key === 'officialEnglishName' || key === 'reviewedEnglishName') return text(item);
    if ((key !== 'en' && key !== 'ko') || !item || typeof item !== 'object' || Array.isArray(item)) return false;
    return Object.entries(item).every(([field, content]) => ['category', 'description', 'signatureMenu', 'priceRange', 'hours', 'payment', 'parking', 'reservation'].includes(field) && text(content));
  });
}
