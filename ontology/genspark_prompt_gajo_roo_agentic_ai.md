# Genspark Prompt: Runtime Operational Ontology 기반 가조온천 AI Concierge 구축

You are a senior full-stack AI system architect and agentic AI engineer.

We are building an Agentic AI Digital Concierge for the Gajo Hot Spring Complex in Geochang County, Korea.

This is NOT a simple chatbot. This is an ontology-driven, agentic AI concierge system powered by Runtime Operational Ontology.

Attached TTL files:
1. runtime_core_v1_0.ttl
2. gajo_ai_concierge_domain_v1_0.ttl

Treat the TTL files as the PRIMARY semantic source of truth. Do not treat them as documentation only. Every major data model, relationship, recommendation, agent capability, and API must be derived from or aligned with the RDF/OWL structure.

## Core Architecture

User Request → Orchestrator Agent → Runtime Operational Ontology → Semantic Context Generation → Graph Traversal → Task Decomposition → Agent Selection → Tool/API Execution → Recommendation / Reservation / Safety Guidance → User-facing Concierge Response

## Important Principle

Never make recommendations only by hardcoded prompt rules. Every recommendation must be explainable through ontology graph traversal.

Example:
Visitor has Companion. Companion has HealthCondition: KneePain and LimitedMobility. Current EnvironmentCondition is RainyWeather. RainyWeather semantically expands to IndoorPreference and FallRisk. KneePain semantically expands to ShortWalkingDistance, ElevatorAvailable, FallRisk. Therefore the system recommends LowIntensityHotSpringCourse, LocalFoodHealingMeal, and MeditationLoungeProgram.

The final answer should include recommended itinerary, reason, related risks, used agents, confidence score, and next possible action such as reservation.

## Required Tech Stack

Frontend: React, TypeScript, PWA, responsive mobile-first design, Korean UI first, Leaflet map, chat-style AI Concierge, admin dashboard.

Backend: NestJS, MongoDB, REST API, JWT authentication, Docker-ready, RDF/TTL loader, ontology graph traversal service, agent orchestrator service, rule and policy evaluation service.

AI/Agent Layer: Orchestrator Agent, Semantic Planner Agent, Guest Agent, Wellness Agent, Reservation Agent, Tourism Agent, Safety Agent, Facility Agent, Evaluator Agent.

Each Agent must read Semantic Context, check relevant ontology classes/properties, identify required capability, call corresponding tool/API if needed, and return explainable result.

## Required Mongo Collections

visitors, companions, visitorGroups, healthConditions, wellnessGoals, facilities, programs, reservations, itineraries, itinerarySteps, environmentConditions, mobilityConditions, risks, policies, rules, agents, capabilities, tools, tasks, operations, runtimeContexts, recommendations, executionLogs.

## Required Backend Services

1. OntologyLoaderService: Load TTL files, parse RDF triples, store classes, properties, individuals, labels, comments, relationships.
2. GraphTraversalService: Given an entity or condition, traverse related RDF relationships, including inverse property and semanticallyExpandsTo relationships. Return explanation path.
3. RuntimeContextService: Create runtime semantic context from user input. Attach visitor, companion, health condition, weather, congestion, risk, policy, operation.
4. SemanticPlannerService: Convert runtime context into tasks. Select required capabilities and appropriate agents.
5. AgentOrchestratorService: Execute agents in correct order. Maintain operation state. Log execution result.
6. RecommendationService: Generate itinerary recommendations from ontology traversal. Must return evidence paths.
7. PolicyRuleService: Evaluate Policy and Rule nodes. Apply safety and wellness rules.
8. ReservationService: Mock reservation availability for MVP. Later replace with real API.
9. FacilityService: CRUD for facilities and programs.
10. AdminService: Admin CRUD for ontology-derived data.

## Required API Endpoints

GET /api/ontology/classes
GET /api/ontology/properties
GET /api/ontology/individuals
POST /api/context/create
POST /api/concierge/chat
POST /api/recommendations/itinerary
GET /api/facilities
GET /api/programs
POST /api/reservations/check
POST /api/reservations/create
GET /api/admin/dashboard
POST /api/admin/facilities
POST /api/admin/programs

## Required Frontend Pages

1. Home: Vision, AI Smart Wellness Resort, CTA Start AI Concierge.
2. AI Concierge: Chat, visitor profile, companion input, health condition selection, wellness goal selection, weather/congestion mock selection, recommended itinerary, explanation path, reservation button.
3. Itinerary View: Timeline, facility map, program cards, risk and safety notes.
4. Facility Map: Leaflet map, facility markers, filters.
5. Admin Dashboard: Manage facilities, programs, agents, policies/rules, runtime contexts and recommendations.
6. Ontology Explorer: Classes, object properties, individuals, graph traversal path.

## Required Demo Scenario

User says:
"이번 토요일에 어머니를 모시고 가조온천에 하루 다녀오려고 합니다. 어머니는 78세이고 무릎이 좋지 않습니다. 비가 올 것 같고 사람이 많을까 걱정됩니다."

System must create:
Visitor age 58, wellness goal family healing trip. Companion age 78, health condition knee pain and limited mobility. Environment rainy weather and high congestion. Risk fall risk and congestion risk. Operation senior day trip planning operation.

Recommended itinerary:
1. Indoor hot spring bath / low intensity hot spring course
2. Local wellness restaurant / local healing meal
3. Wellness lounge / AI meditation program

Explanation must mention:
KneePain → ShortWalkingDistance / ElevatorAvailable / FallRisk
RainyWeather → IndoorPreference / FallRisk
HighCongestion → ReservationPriority / CongestionRisk
Therefore indoor, short-distance, reservation-friendly itinerary is recommended.

## UI Tone

Korean public-sector friendly. Clean, trustworthy, wellness-oriented. Use terms: AI Digital Concierge, Runtime Operational Ontology, Agentic AI, Semantic Planner, Explainable Recommendation, Smart Wellness Resort.

## Deliverable

Generate a complete working MVP with frontend, backend, MongoDB seed data, Docker setup, and README.

README must explain how to install, how to run frontend/backend, how to load TTL files, how ontology traversal works, how agents use runtime context, and how to test the demo scenario.

Focus on working MVP first. Do not over-engineer. Preserve ontology-driven architecture clearly.
