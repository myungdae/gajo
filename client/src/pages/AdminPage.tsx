import VisitorAnalyticsDashboard from '../components/VisitorAnalyticsDashboard';
import { useEffect, useState } from 'react';
import { fetchAdminDashboard, fetchPilotAnalytics } from '../api/client';
import { shortUri } from '../utils/uri';
import RegionalDataManager from '../components/RegionalDataManager';
import SpotlightManager from '../components/SpotlightManager';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pilot,setPilot]=useState<any>(null);
  const [adminToken,setAdminToken]=useState(()=>sessionStorage.getItem('admin-write-token')||'');

  useEffect(() => {
    fetchAdminDashboard().then(setData)
      .finally(() => setLoading(false));
  }, []);
  useEffect(()=>{if(!adminToken){setPilot(null);return}fetchPilotAnalytics(adminToken).then(setPilot).catch(()=>setPilot(null))},[adminToken]);

  if (loading) return <div className="loading">대시보드 데이터를 불러오는 중...</div>;
  if (!data) return <div className="card">데이터를 불러올 수 없습니다.</div>;

  return (
    <div>
      <RegionalDataManager onAdminTokenChange={setAdminToken} />
      <SpotlightManager token={adminToken} />
      <VisitorAnalyticsDashboard token={adminToken} />
      {pilot&&<div className="card"><h2>Legacy / unknown 파일럿 이벤트 (신규 통계와 합산 금지)</h2><p className="text-muted">개인정보나 자유 입력 원문 없이 집계한 이용 지표입니다.</p><div className="grid-2"><div className="stat-box"><div className="num">{pilot.totalTripSessions}</div><div className="label">여행 세션</div></div><div className="stat-box"><div className="num">{Math.round(pilot.recommendationCompletionRate*100)}%</div><div className="label">추천 완료율</div></div><div className="stat-box"><div className="num">{pilot.navigationHandoffCount}</div><div className="label">내비 연결</div></div><div className="stat-box"><div className="num">{pilot.itineraryAddCount}</div><div className="label">일정 담기</div></div><div className="stat-box"><div className="num">{pilot.replanningCount}</div><div className="label">일정 다시 보기</div></div><div className="stat-box"><div className="num">{pilot.errorFallbackCount}</div><div className="label">오류·재시도</div></div></div><p>구조화 요청 {pilot.structuredUsage} · 자유 입력 {pilot.freeLanguageUsage}</p><p>유입: {(pilot.sessionsByEntrySource||[]).map((x:any)=>`${x.label} ${x.total}`).join(' · ')||'아직 없음'}</p><p>빠른 선택: {(pilot.mostUsedQuickIntents||[]).map((x:any)=>`${x.label} ${x.total}`).join(' · ')||'아직 없음'}</p></div>}
      {pilot&&<div className="card"><h2>PLAN → NOW 연속 이용</h2><p>PLAN 시작 {pilot.planSessionsStarted||0} · 완료 {pilot.planCompleted||0} · 재방문 {pilot.planResumed||0}</p><p>NOW 시작 {pilot.nowSessionsStarted||0} · 이어서 이용 {pilot.planNowContinuations||0} · 현재 상황 반영 {pilot.runtimeHydrations||0}</p></div>}
      {pilot?.sessionsByRegion&&<div className="card"><h2>지역별 이용</h2><p>{pilot.sessionsByRegion.map((item:any)=>`${({gajo:'가조',okcheon:'옥천',muan:'무안',gyeryong:'계룡',hapcheon:'합천','daejeon-junggu':'대전 중구'}as Record<string,string>)[item.label]||item.label} ${item.total}`).join(' · ')||'아직 없음'}</p></div>}
      <DataQualityPanel quality={data.dataQuality} />
      <div className="card">
        <h2>운영 현황 요약</h2>
        <div className="grid-2">
          <div className="stat-box">
            <div className="num">{data.totals.runtimeContexts}</div>
            <div className="label">생성된 컨텍스트</div>
          </div>
          <div className="stat-box">
            <div className="num">{data.totals.recommendations}</div>
            <div className="label">추천 건수</div>
          </div>
          <div className="stat-box">
            <div className="num">{data.totals.reservations}</div>
            <div className="label">예약 건수</div>
          </div>
          <div className="stat-box">
            <div className="num">{data.totals.facilities}</div>
            <div className="label">등록 시설</div>
          </div>
          <div className="stat-box">
            <div className="num">{data.totals.programs}</div>
            <div className="label">등록 프로그램</div>
          </div>
          <div className="stat-box">
            <div className="num">{data.totals.agents}</div>
            <div className="label">AI 에이전트</div>
          </div>
        </div>
        <div style={{ marginTop: 10 }} className="tag-row">
          <span className="badge">온톨로지 트리플 {data.totals.ontologyTriples}개</span>
        </div>
      </div>

      <div className="card">
        <h2>최근 컨텍스트 (Runtime Context)</h2>
        <table className="simple">
          <thead>
            <tr>
              <th>번호</th>
              <th>요청 메시지</th>
              <th>위험</th>
            </tr>
          </thead>
          <tbody>
            {(data.recentContexts || []).map((c: any) => (
              <tr key={c._id}>
                <td>{c.contextNo}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {c.rawMessage || '-'}
                </td>
                <td>{(c.risks || []).map((r: string) => shortUri(r)).join(', ') || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>최근 추천 (Recommendation)</h2>
        <table className="simple">
          <thead>
            <tr>
              <th>번호</th>
              <th>요약</th>
              <th>신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {(data.recentRecommendations || []).map((r: any) => (
              <tr key={r._id}>
                <td>{r.recommendationNo}</td>
                <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.reasonSummary}
                </td>
                <td>{r.confidenceScore ? (r.confidenceScore * 100).toFixed(0) + '%' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>최근 예약 (Reservation)</h2>
        <table className="simple">
          <thead>
            <tr>
              <th>번호</th>
              <th>시설</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {(data.recentReservations || []).map((r: any) => (
              <tr key={r._id}>
                <td>{r.reservationNo}</td>
                <td>{shortUri(r.facilityUri)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {(!data.recentReservations || data.recentReservations.length === 0) && (
              <tr>
                <td colSpan={3} style={{ color: 'var(--color-text-muted)' }}>
                  아직 예약이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card">
        <h2>마스터 데이터 품질</h2>
        <table className="simple"><thead><tr><th>엔티티</th><th>좌표</th><th>주소</th><th>전화</th><th>운영시간</th><th>엔티티 상태</th></tr></thead><tbody>
          {(data.dataQuality?.entities || []).map((entity: any) => <tr key={entity.entityUri}><td>{entity.record?.canonicalLabelKo || entity.label}</td><td>{entity.flags.includes('MISSING_COORDINATES') ? '누락' : entity.fieldVerification?.coordinates}</td><td>{entity.flags.includes('MISSING_ADDRESS') ? '누락' : entity.fieldVerification?.address}</td><td>{entity.flags.includes('MISSING_PHONE') ? '누락' : entity.fieldVerification?.telephone}</td><td>{entity.flags.includes('MISSING_HOURS') ? '확인 필요' : entity.fieldVerification?.operatingHours}</td><td>{entity.record?.verificationStatus || 'UNVERIFIED'}{entity.flags.length ? ` · ${entity.flags.join(', ')}` : ''}</td></tr>)}
        </tbody></table>
      </div>
    </div>
  );
}

function DataQualityPanel({quality}:{quality:any}) {
  if(!quality)return null;
  return <div className="card"><h2>실제 장소 데이터 품질</h2><div className="tag-row"><span className="badge">전체 {quality.summary?.total||0}</span><span className="badge">검증 {quality.summary?.verified||0}</span><span className="badge muted">부분 확인 {quality.summary?.partial||0}</span><span className="badge muted">좌표 있음 {quality.summary?.withCoordinates||0}</span></div><table className="simple"><thead><tr><th>장소</th><th>온톨로지 연결</th><th>기본 정보</th><th>출처</th><th>점검 항목</th></tr></thead><tbody>{(quality.entities||[]).map((entity:any)=><tr key={entity.entityUri}><td>{entity.record?.canonicalLabelKo||entity.label}</td><td>{entity.entityUri.split('#').pop()}</td><td>{[entity.record?.address,entity.record?.telephone,entity.record?.operatingHours?.length?'운영시간 등록':null].filter(Boolean).join(' · ')||'확인 필요'}</td><td>{entity.record?.detailsProvenance?.sourceName||'출처 없음'}</td><td>{entity.flags.join(', ')||'OK'}</td></tr>)}</tbody></table></div>
}
