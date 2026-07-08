import { useEffect, useState } from 'react';
import { fetchAdminDashboard } from '../api/client';
import { shortUri } from '../utils/uri';

export default function AdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminDashboard()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">대시보드 데이터를 불러오는 중...</div>;
  if (!data) return <div className="card">데이터를 불러올 수 없습니다.</div>;

  return (
    <div>
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
    </div>
  );
}
