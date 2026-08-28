import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchPublicPartner, recordPartnerEntry } from "../api/client";
import { ensureTripSession, saveTripSession } from "../tripSession";
import { applyPartnerEntryToTrip } from "../partnerEntry";
export default function PartnerEntryPage() {
  const { partnerSlug = "" } = useParams(),
    navigate = useNavigate(),
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
        navigate(`/${p.regionId}/concierge?mode=NOW`, {
          replace: true,
          state: {
            tripMode: "NOW",
            freeTextOpen: false,
            entryMessage: `${p.displayName}에서 ${p.regionId === "hapcheon" ? "합천" : "지역"} 여행을 시작하셨군요.`,
          },
        });
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
  }, [partnerSlug, navigate]);
  return (
    <main className="partner-flow">
      <h1>합천 AI 여행을 준비하고 있어요</h1>
      {error ? (
        <>
          <p>{error}</p>
          <button
            className="btn btn-outline"
            onClick={() => navigate("/hapcheon")}
          >
            합천 여행 홈으로
          </button>
        </>
      ) : (
        <p>승인된 참여업체와 현재 여행을 안전하게 연결하는 중입니다.</p>
      )}
    </main>
  );
}
