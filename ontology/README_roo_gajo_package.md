# ROO + Gajo AI Concierge Ontology Package

이 패키지는 Runtime Operational Ontology 기반 가조온천 AI Concierge MVP 제작용입니다.

## 파일

1. runtime_core_v1_0.ttl
- 공통 Runtime Operational Ontology Core
- Entity, Event, Context, Operation, Task, Agent, Tool, Policy, Rule, State, Risk, Evidence 포함

2. gajo_ai_concierge_domain_v1_0.ttl
- 가조온천 AI Concierge 도메인 온톨로지
- Visitor, Companion, Facility, Program, HealthCondition, WellnessGoal, Itinerary, RuntimeContext 포함

3. genspark_prompt_gajo_roo_agentic_ai.md
- Genspark에 넣을 개발 프롬프트

## 사용법

Genspark에 TTL 두 파일을 업로드하고, genspark_prompt_gajo_roo_agentic_ai.md 내용을 프롬프트로 넣으시면 됩니다.

핵심은 TTL을 문서가 아니라 Runtime Knowledge Graph로 사용하게 하는 것입니다.
