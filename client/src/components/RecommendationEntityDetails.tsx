import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchFacility, fetchProgram, type ConciergeChatResponse, type OntologyEntityDetail } from '../api/client';
import { Link } from 'react-router-dom';
import { approximateDistance, estimatedTravelMinutes, getSessionLocation } from '../utils/visitorLocation';

type EntityKind = 'program' | 'facility';

function deriveLabels(result: ConciergeChatResponse) {
  const labels = new Map<string, string>();
  const rec = result.recommendation;
  for (const step of rec?.itinerary?.steps || rec?.steps || []) {
    if (step.programUri && step.programLabel) labels.set(step.programUri, step.programLabel);
    if (step.facilityUri && step.facilityLabel) labels.set(step.facilityUri, step.facilityLabel);
  }
  for (const evidence of rec?.evidence || result.evidence || []) {
    if (evidence.subject && evidence.subjectLabel) labels.set(evidence.subject, evidence.subjectLabel);
    if (evidence.object && evidence.objectLabel) labels.set(evidence.object, evidence.objectLabel);
  }
  return labels;
}

function stateLabel(value?: string) {
  return ({ AVAILABLE: '이용 가능', UNAVAILABLE: '이용 불가', OPEN: '운영 중', CLOSING_SOON: '마감 임박', CLOSED: '운영 종료', REQUIRED: '예약 필요', FULL: '예약 마감', LOW: '낮음', MODERATE: '보통', HIGH: '높음', UNKNOWN: '정보 없음' } as Record<string, string>)[value || 'UNKNOWN'] || value;
}

export default function RecommendationEntityDetails({ result }: { result: ConciergeChatResponse }) {
  const labels = useMemo(() => deriveLabels(result), [result]);
  const [selected, setSelected] = useState<{ uri: string; kind: EntityKind } | null>(null);
  const [detail, setDetail] = useState<OntologyEntityDetail | null>(null);
  const [relatedFacility, setRelatedFacility] = useState<OntologyEntityDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rec = result.recommendation;

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    document.addEventListener('keydown', onKeyDown);
    closeRef.current?.focus();
    setLoading(true); setDetail(null); setRelatedFacility(null);
    const request = selected.kind === 'program' ? fetchProgram(selected.uri) : fetchFacility(selected.uri);
    request.then(async (entity) => {
      setDetail(entity);
      const facilityUri = selected.kind === 'program' ? entity?.objectProps?.heldAtFacility?.[0] : undefined;
      if (facilityUri) setRelatedFacility(await fetchFacility(facilityUri));
    }).catch(() => setDetail(null)).finally(() => setLoading(false));
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  if (!rec) return null;
  const open = (uri: string, kind: EntityKind) => setSelected({ uri, kind });
  const fallback = (kind: EntityKind) => kind === 'program' ? '추천 프로그램' : '추천 시설';

  return (
    <>
      <div className="tag-row recommendation-chips" aria-label="추천 프로그램 및 시설">
        {(rec.recommendedPrograms || []).map((uri: string) => (
          <button type="button" className="badge entity-chip" key={uri} onClick={() => open(uri, 'program')} aria-label={`${labels.get(uri) || fallback('program')} 상세 보기`}>
            🧖 {labels.get(uri) || fallback('program')}
          </button>
        ))}
        {(rec.recommendedFacilities || []).map((uri: string) => (
          <button type="button" className="badge muted entity-chip" key={uri} onClick={() => open(uri, 'facility')} aria-label={`${labels.get(uri) || fallback('facility')} 상세 보기`}>
            📍 {labels.get(uri) || fallback('facility')}
          </button>
        ))}
      </div>
      {selected && (
        <div className="entity-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section className="entity-modal" role="dialog" aria-modal="true" aria-labelledby="entity-detail-title">
            <button ref={closeRef} type="button" className="entity-modal-close" onClick={() => setSelected(null)} aria-label="상세 정보 닫기">×</button>
            {loading ? <div className="loading">상세 정보를 불러오는 중...</div> : detail ? (
              <EntityDetail kind={selected.kind} detail={detail} relatedFacility={relatedFacility} result={result} />
            ) : <p>현재 제공되는 상세 정보가 없습니다.</p>}
          </section>
        </div>
      )}
    </>
  );
}

function EntityDetail({ kind, detail, relatedFacility, result }: { kind: EntityKind; detail: OntologyEntityDetail; relatedFacility: OntologyEntityDetail | null; result: ConciergeChatResponse }) {
  const runtimeStates = result.context?.runtimeStates || [];
  const facilityUri = kind === 'program' ? relatedFacility?.uri : detail.uri;
  const runtime = runtimeStates.find((state: any) => state.entityUri === detail.uri) || runtimeStates.find((state: any) => state.entityUri === facilityUri);
  const literals = detail.literalProps || {};
  const locationLiterals = kind === 'program' ? relatedFacility?.literalProps || {} : literals;
  const evidence = (result.recommendation?.evidence || []).filter((item: any) => item.subject === detail.uri && /suitableFor|mitigatesRisk/.test(item.predicate || ''));
  const reasons = Array.from(new Set(evidence.map((item: any) => item.objectLabel).filter(Boolean)));
  const address = literals.address || literals.streetAddress || literals.roadAddress;
  const latitude = Number(locationLiterals.latitude ?? locationLiterals.lat);
  const longitude = Number(locationLiterals.longitude ?? locationLiterals.lng ?? locationLiterals.lon);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const distanceMeters = approximateDistance(getSessionLocation(),latitude,longitude);
  const travelMinutes = estimatedTravelMinutes(distanceMeters,result.context?.transportMode);
  const reservationRelevant = literals.requiresReservation === 'true' || runtime?.reservationState;

  return (
    <div>
      <span className="entity-kind">{kind === 'program' ? '프로그램' : '시설'}</span>
      <h2 id="entity-detail-title">{detail.label}</h2>
      {detail.comment && <p className="entity-description">{detail.comment}</p>}
      <dl className="entity-detail-list">
        {distanceMeters !== undefined && <><dt>현재 위치 기준</dt><dd>약 {distanceMeters<1000?`${distanceMeters}m`:`${(distanceMeters/1000).toFixed(1)}km`}{travelMinutes?` · 예상 이동 약 ${travelMinutes}분`:''}</dd></>}
        {kind === 'program' && detail.programNature && <><dt>프로그램 구분</dt><dd>{detail.programNature === 'AI_COMPOSED' ? 'AI가 일정에 맞게 구성한 코스' : '공식 운영 프로그램'}</dd></>}
        {kind === 'facility' && literals.category && <><dt>시설 유형</dt><dd>{literals.category}</dd></>}
        {literals.telephone && <><dt>문의</dt><dd>{literals.telephone}</dd></>}
        {Array.isArray(literals.operatingHours) && literals.operatingHours.length > 0 ? <><dt>일반 운영시간</dt><dd>{literals.operatingHours.map((hours:any)=>`${hours.days.join(', ')} ${hours.openTime}~${hours.closeTime}${hours.lastEntryTime?` (입장 마감 ${hours.lastEntryTime})`:''}`).join(' / ')}</dd></> : kind==='facility' && <><dt>운영시간</dt><dd>현재 운영시간은 확인이 필요합니다.</dd></>}
        {kind === 'program' && <><dt>예상 소요시간</dt><dd>{literals.durationMinutes ? `약 ${literals.durationMinutes}분` : '정보 없음'}</dd><dt>추천 이유</dt><dd>{reasons.length ? `${reasons.join(', ')} 조건을 고려해 이 방문객에게 잘 맞는 프로그램입니다.` : result.recommendation?.reasonSummary || '제공되는 추천 이유가 없습니다.'}</dd><dt>이용 시설</dt><dd>{relatedFacility?.label || '정보 없음'}</dd></>}
        {kind === 'facility' && <><dt>위치·주소</dt><dd>{address || '정보 없음'}</dd></>}
        <dt>운영 상태</dt><dd>{stateLabel(runtime?.operatingState)}</dd>
        {kind === 'program' && <><dt>현재 이용 가능 여부</dt><dd>{stateLabel(runtime?.availability)}</dd></>}
        {reservationRelevant && <><dt>예약 상태</dt><dd>{stateLabel(runtime?.reservationState || (literals.requiresReservation === 'true' ? 'REQUIRED' : 'UNKNOWN'))}</dd></>}
      </dl>
      {hasCoordinates && facilityUri && <Link className="btn btn-primary btn-block" to={`/map?entityUri=${encodeURIComponent(facilityUri)}`}>지도에서 보기</Link>}
    </div>
  );
}
