# Hyperlocal Essential Services — Phase 2 source/onboarding report

Audit date: 2026-08-24. This batch follows `SOURCE → EVIDENCE → REGIONAL COPILOT → HUMAN REVIEW → RDM → ACTION`. Official evidence was not treated as manager approval.

## Result

Okcheon has a small municipal evidence batch (16 records) available for discovery and manager review. A later demo-safety refinement permits preview navigation to their contained municipal coordinates without making the records VERIFIED. Gajo/Geochang and Hapcheon remain data-required for coordinate-complete essential services; weak name-only evidence was not ingested to meet quotas.

## Source audit

| Source | Region/category | Official/public | Access | Fields and coordinates | Update/license | Refresh | Suitability/status |
|---|---|---|---|---|---|---|---|
| [옥천군 행복드림 생활지도](https://safe.oc.go.kr/smartMap/selectSmartMapWebView.do) | Okcheon: toilet, parking, gas, EV | Municipal official | Embedded JSON (`smartMapData`), no access-control circumvention | `locNo`, category, title, address, 읍면, lat/lng, optional phone/homepage/detail; coordinates present | Not visible | PERIODIC | DATA_AVAILABLE; EVIDENCE_READY, review required |
| [전국주차장정보 표준데이터](https://www.data.go.kr/data/15012896/standard.do) | National parking | Public-data portal | Standard dataset/API dependent | identity, address, type, capacity, hours, fees, managing body, coordinates, update date | Portal terms; record timestamps present | PERIODIC | Audited; not used in this small batch because municipal source was clearer |
| [OPINET API](https://www.opinet.co.kr/user/custapi/custApiInfo.do) | National gas | KNOC public agency | Credentialed API | station/address/brand and API-dependent price fields; only supported fields may be used | API terms apply | PERIODIC, source-policy dependent | CREDENTIAL_REQUIRED; no live price or operating claim |
| [환경부/한국환경공단 EV API](https://www.data.go.kr/data/15076352/openapi.do) | National EV | Government/public agency | Credentialed public-data API | station/address/coordinates/operator/type/capacity/status, API dependent | Portal terms apply | PERIODIC; live status only after explicit integration validation | CREDENTIAL_REQUIRED; STATIC_STATION_DATA and LIVE_CHARGER_STATUS remain distinct |
| [거창군 대표포털](https://www.geochang.go.kr/portal/Index.do?c=WW0602040000) and official tourism pages | Gajo/Geochang anchors | Municipal official | Web pages | anchor identity/address/phone sometimes present; consistent structured essential-service coordinates not established | page timestamps vary | STATIC/PERIODIC | DATA_REQUIRED for this batch |
| [합천군 2026 tourism plan](https://gpki.hc.go.kr/CLRecords/Files/FileAppendix/a9/A007384.pdf) | Hapcheon tourist information | Municipal official document | PDF | names seven information-center locations; coordinate-complete facility records/hours not supplied | 2026 plan | STATIC | EVIDENCE_ONLY; not ingested as an action record |
| [합천군 EV installation document](https://gpki.hc.go.kr/CLRecords/Files/FileAppendix/a9/A007135.pdf) | Hapcheon EV | Municipal official document | PDF | facility/address and charger counts; no coordinate-complete current operating dataset | document date visible at source | STATIC | EVIDENCE_ONLY; requires current structured corroboration |

No blog, directory clone, social post, SEO aggregator, or untraceable map copy was used as operational truth. Licensing/reuse text was not visible on the Smart Map page, so automated redistribution should receive legal/data-owner confirmation before production refresh.

## Actual onboarded entities

All records use provenance `MUNICIPAL_OFFICIAL`, evidence status `EVIDENCE_READY`, runtime status `PARTIAL`, and the official Smart Map coordinates. They receive preview navigation only after shared provenance and regional-containment checks; calling remains withheld pending review.

| Category | Count | Entities |
|---|---:|---|
| Public toilet | 5 | 장계관광지 카페프란스 앞, 장계관광지 향토전시관 옆, 육영수생가 대형주차장, 정지용문학관 앞, 장령산자연휴양림 야영장 화장실 |
| Parking | 5 | 금구 공영주차타워, 옥천 공설시장 주차타워, 보건소 앞, 시외버스터미널, 청산 공영주차장 |
| Gas station | 3 | 옥천사랑주유소, 중도석유(주) 고속주유소, 안남주유소 |
| EV charger | 3 | 안남면, 옥천읍, 옥천군청 전기차충전소 |
| Tourist information | 0 | DATA_REQUIRED |

Coordinates: 16/16 evidence coordinates; 16/16 preview-navigation eligible and 0/16 manager-verified navigation. No accessibility, fee/free, capacity, hours, fuel type, charger type/capacity/operator, live availability, walking convenience, or accessible-parking fact was inferred.

## Field-readiness matrix

| Category | Hapcheon | Gajo | Okcheon |
|---|---|---|---|
| Public Toilet | DATA_REQUIRED | DATA_REQUIRED | EVIDENCE_READY |
| Parking | DATA_REQUIRED | DATA_REQUIRED | EVIDENCE_READY |
| Gas Station | DATA_REQUIRED | DATA_REQUIRED | EVIDENCE_READY |
| EV Charger | EVIDENCE_READY (document only) | DATA_REQUIRED | EVIDENCE_READY |
| Tourist Info | EVIDENCE_READY (name/location document only) | DATA_REQUIRED | DATA_REQUIRED |

`ACTION_READY` remains zero in the manager-verification sense. Preview navigation communicates only that an approved official/public source supplied a contained coordinate.

## Review tasks and conflicts

Recommended Regional Copilot tasks (no Approve All):

- “옥천 공중화장실 5건의 명칭·주소·좌표 근거가 확인되었습니다.” Show source, current empty RDM value, proposed values, reason, and navigation effect.
- “옥천 공영주차장 5건을 검토해 주세요.” Do not infer fee, hours, capacity, availability, or accessibility.
- “옥천 주유소 3건은 군 생활지도 근거이며 OPINET 현재가격 연동은 없습니다.”
- “옥천 EV 충전소 3건은 정적 시설 근거입니다. 실시간 충전 가능 상태가 아닙니다.”
- “합천·가조 관광동선의 좌표 완비 필수서비스 데이터가 부족합니다.”

Municipal/national disagreements must create field-level `CONFLICT` evidence for phone, coordinates, hours, or status; refresh must not silently overwrite an approved value.

## Golden-flow expectations

Okcheon utterances “화장실 급해요.”, “엄마가 화장실 가셔야 해.”, “차 어디 세워?”, “주차할 데부터 찾아줘.”, “기름 넣어야 하는데.”, and “전기차 충전할 곳 있어?” route to the correct distinct category and return PARTIAL RDM evidence with `길찾기(공식 위치)`. “관광안내소 어디예요?” returns insufficient-data truthfully. Hapcheon/Gajo return insufficient-data for categories without eligible records and do not borrow Okcheon records.

Follow-ups preserve category/context: “가장 가까운 데는?” only computes distance with trusted coordinates; “거긴 멀어?” reports distance only when eligible; “다른 데는?” excludes the current result. “다시 원래 일정으로 가자.” continues to rely on the unchanged TripSession detour/return path.

For “70대 어머니와 같이 왔는데 많이 걷기 어려워요. 화장실과 주차가 편한 곳부터 보고 싶어요.” the mobility constraint must remain explicit, toilet/parking needs are prioritized, and the response must not claim accessibility or short walking distance because the sources do not provide that evidence. The existing journey remains intact.

## Refresh architecture

The region-neutral adapter registry records source identity, access method, fields, cadence, credential state, and limitations. Municipal embedded/static data is PERIODIC. OPINET and official EV APIs remain CREDENTIAL_REQUIRED. No aggressive polling and no live status claim is implemented.

## Counts and gaps

- Onboarded: Okcheon 16; Gajo/Geochang 0; Hapcheon 0.
- VERIFIED/PARTIAL/UNVERIFIED in this batch: 0/16/0.
- Preview-navigation eligible: 16; manager-verified navigation in this batch: 0.
- Provenance coverage: 16/16; coordinate-source coverage: 16/16.
- Remaining DATA_REQUIRED: all coordinate-complete Gajo/Hapcheon categories; tourist information in Okcheon; current structured national gas/EV integrations.
- Remaining ENGINE gaps: automated scheduled refresh execution and explicit multi-source conflict task generation are adapter/model-ready but not connected to live credentials.
