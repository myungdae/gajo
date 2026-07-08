import axios from 'axios';

// In dev, Vite proxies /api -> http://localhost:3000 (see vite.config.ts).
// In production (Docker/nginx), nginx proxies /api/ -> the api container.
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

export interface CompanionInput {
  age?: number;
  relationship?: string;
  healthConditions?: string[];
}

export interface CreateContextInput {
  rawMessage?: string;
  visitorNo?: string;
  visitorAge?: number;
  healthConditions?: string[];
  wellnessGoals?: string[];
  companions?: CompanionInput[];
  weather?: string;
  congestion?: string;
}

export interface EvidenceStep {
  subject: string;
  subjectLabel: string;
  predicate: string;
  predicateLabel: string;
  object: string;
  objectLabel: string;
}

export interface FiredRule {
  ruleUri: string;
  ruleLabel: string;
  ifCondition: string;
  thenRecommendation?: string;
  thenAction?: string;
  policyUri?: string;
  policyLabel?: string;
}

export interface ConciergeChatResponse {
  context: any;
  evidence: EvidenceStep[];
  firedRules: FiredRule[];
  operation?: any;
  tasks?: any[];
  executionLog?: any[];
  recommendation?: any;
  reservationCheck?: any[];
  usedAgents?: string[];
  risks?: string[];
  confidenceScore?: number;
  nextAction?: string;
  error?: string;
}

export async function postConciergeChat(input: CreateContextInput) {
  const { data } = await api.post<ConciergeChatResponse>('/concierge/chat', input);
  return data;
}

export async function runDemoScenario() {
  const { data } = await api.post<ConciergeChatResponse>('/demo/scenario');
  return data;
}

export async function fetchFacilities() {
  const { data } = await api.get('/facilities');
  return data;
}

export async function fetchPrograms() {
  const { data } = await api.get('/programs');
  return data;
}

export async function fetchAdminDashboard() {
  const { data } = await api.get('/admin/dashboard');
  return data;
}

export async function fetchOntologyStats() {
  const { data } = await api.get('/ontology/stats');
  return data;
}

export async function fetchOntologyClasses() {
  const { data } = await api.get('/ontology/classes');
  return data;
}

export async function fetchOntologyProperties() {
  const { data } = await api.get('/ontology/properties');
  return data;
}

export async function fetchOntologyIndividuals() {
  const { data } = await api.get('/ontology/individuals');
  return data;
}

export async function traverseOntology(start: string, predicate: string, depth?: number) {
  const { data } = await api.get('/ontology/traverse', {
    params: { start, predicate, depth },
  });
  return data;
}

export async function expandOntology(uris: string[]) {
  const { data } = await api.get('/ontology/expand', { params: { uris: uris.join(',') } });
  return data;
}

export async function queryOntology(subject?: string, predicate?: string, object?: string) {
  const { data } = await api.get('/ontology/query', { params: { subject, predicate, object } });
  return data;
}

export async function checkReservation(facilityUri: string, date?: string) {
  const { data } = await api.post('/reservations/check', { facilityUri, date });
  return data;
}

export async function createReservation(payload: {
  visitorNo: string;
  facilityUri: string;
  programUri?: string;
  date: string;
  timeSlot?: string;
  partySize?: number;
  note?: string;
}) {
  const { data } = await api.post('/reservations/create', payload);
  return data;
}
