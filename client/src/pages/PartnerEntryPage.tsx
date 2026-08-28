import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchPublicPartner, recordPartnerEntry, type PublicPartner } from "../api/client";
import { ensureTripSession, saveTripSession } from "../tripSession";
import { applyPartnerEntryToTrip } from "../partnerEntry";
import { getRegionConfig } from "../regionConfig";
export default function PartnerEntryPage() {
  const { partnerSlug = "" } = useParams(),
    navigate = useNavigate(),
    [partner, setPartner] = useState<PublicPartner>(),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const p = await fetchPublicPartner(partnerSlug),
          trip = ensureTripSession(p.regionId),
          enteredAt = new Date().toISOString();
        if (trip.restorationPending)
          throw new Error("기존 여행을 복원한 뒤 다시 시도해 주세요.");
        await recordPartnerEntry(partnerSlug, {
          anonymousTripId: trip.anonymousTripId,
          regionId: p.regionId,
        });
        saveTripSession(applyPartnerEntryToTrip(trip, p, enteredAt));
        if (live) setPartner(p);
      } catch (e: any) {
        if (live)
          setError(
            e?.response?.data?.message ||
              e.message ||
              "유효한 파트너 QR이 아닙니다.",
          );
      }
    })();
    return () => {
      live = false;
    };
  }, [partnerSlug]);
  const start = () => {
    if (!partner) return;
    const regionName = getRegionConfig(partner.regionId).regionName;
    navigate(`/${partner.regionId}/concierge?mode=NOW`, {
      state: {
        tripMode: "NOW",
        freeTextOpen: false,
        entryMessage: `${partner.displayName}에서 ${regionName} 여행을 시작하셨군요.`,
        entryDescription: "지금 갈 곳, 먹을 곳, 비 오는 날 코스를 AI가 함께 찾아드립니다.",
      },
    });
  };
  return (
    <main className="partner-flow partner-entry-screen">
      {error ? (
        <>
          <h1>파트너 QR을 확인할 수 없어요</h1>
          <p>{error}</p>
          <button
            className="btn btn-outline"
            onClick={() => navigate("/")}
          >
            여행 홈으로
          </button>
        </>
      ) : partner ? <>
        <small>파트너 QR로 시작하기</small>
        <h1>{partner.displayName}에서 {getRegionConfig(partner.regionId).regionName} 여행을 시작하셨군요</h1>
        <p>지금 갈 곳, 먹을 곳, 비 오는 날 코스를 AI가 함께 찾아드립니다.</p>
        <p className="partner-entry-note">QR 방문확인이 아닌 여행 시작용 파트너 QR입니다.</p>
        <button type="button" className="btn btn-primary" onClick={start}>{getRegionConfig(partner.regionId).regionName} AI 여행 시작하기</button>
      </> : <><h1>파트너 QR을 확인하고 있어요</h1><p>승인된 참여업체와 현재 여행을 안전하게 연결하는 중입니다.</p></>}
    </main>
  );
}
