// Small helpers for rendering RDF/OWL URIs in a human-friendly way.

export function localName(uri: string): string {
  if (!uri) return '';
  const hashIdx = uri.lastIndexOf('#');
  if (hashIdx >= 0) return uri.slice(hashIdx + 1);
  const slashIdx = uri.lastIndexOf('/');
  if (slashIdx >= 0) return uri.slice(slashIdx + 1);
  return uri;
}

export function shortUri(uri: string): string {
  if (!uri) return '';
  if (uri.startsWith('https://linkeddata.center/roo-core#')) return 'roo:' + localName(uri);
  if (uri.startsWith('https://gajo-wellness.kr/ontology#')) return 'gajo:' + localName(uri);
  return uri;
}
