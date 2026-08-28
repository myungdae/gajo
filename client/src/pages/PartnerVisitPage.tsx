import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  confirmQrVisit,
  fetchPublicPartner,
  requestBenefitUse,
} from "../api/client";
import { ensureTripSession } from "../tripSession";
export default function PartnerVisitPage() {
  const { partnerSlug = "" } = useParams(),
    [result, setResult] = useState<any>(),
    [error, setError] = useState(""),
    [requested, setRequested] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      try {
        const partner = await fetchPublicPartner(partnerSlug),
          trip = ensureTripSession(partner.regionId);
        setResult(
          await confirmQrVisit(partnerSlug, {
            anonymousTripId: trip.anonymousTripId,
            regionId: partner.regionId,
          }),
        );
      } catch (e: any) {
        setError(
          e?.response?.data?.message || "QR 방문확인을 처리하지 못했습니다.",
        );
      }
    })();
  }, [partnerSlug]);
  const use = async (id: string) => {
    try {
      const trip = ensureTripSession(result.partner.regionId),
        r = await requestBenefitUse(id, {
          anonymousTripId: trip.anonymousTripId,
          regionId: result.partner.regionId,
          idempotencyKey: crypto.randomUUID(),
        });
      setRequested((x) => ({ ...x, [id]: r.status }));
    } catch (e: any) {
      setRequested((x) => ({
        ...x,
        [id]: e?.response?.data?.message || "요청 실패",
      }));
    }
  };
  return (
    <main className="partner-flow">
      <small>현장 QR 방문확인</small>
      <h1>{result?.partner?.displayName || "방문을 확인하고 있어요"}</h1>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p className="notice">{result.notice}</p>
          <h2>현재 제공 중인 혜택·특별 이벤트</h2>
          {result.benefits.length ? (
            result.benefits.map((b: any) => (
              <article className="benefit-card" key={b.benefitId}>
                <h3>{b.title}</h3>
                <p>{b.shortDescription || b.displayValue}</p>
                {b.conditions && (
                  <p>
                    <small>조건: {b.conditions}</small>
                  </p>
                )}
                <button
                  className="btn btn-primary"
                  disabled={Boolean(requested[b.benefitId])}
                  onClick={() => use(b.benefitId)}
                >
                  혜택 사용 요청
                </button>
                {requested[b.benefitId] && (
                  <p role="status">
                    {requested[b.benefitId] === "REQUESTED"
                      ? "업소 확인을 기다리고 있습니다."
                      : requested[b.benefitId]}
                  </p>
                )}
              </article>
            ))
          ) : (
            <p>
              현재 공개된 혜택은 없습니다. 혜택 없이도 이 업소는 AI 관광
              파트너로 참여할 수 있습니다.
            </p>
          )}
        </>
      )}
    </main>
  );
}
