import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  confirmBenefitUse,
  createPartnerBenefit,
  downloadPartnerTestQr,
  fetchPartnerMetrics,
} from "../api/client";
export default function PartnerConsolePage() {
  const { partnerSlug = "" } = useParams(),
    [key, setKey] = useState(""),
    [metrics, setMetrics] = useState<any>(),
    [redemption, setRedemption] = useState(""),
    [message, setMessage] = useState(""),
    [benefit, setBenefit] = useState<any>({ benefitType: "NONE" });
  const load = async () => {
    try {
      setMetrics(await fetchPartnerMetrics(partnerSlug, key));
      setMessage("");
    } catch {
      setMessage("관리 키를 확인해 주세요.");
    }
  };
  const decide = async (decision: "CONFIRM" | "DECLINE") => {
    try {
      const r = await confirmBenefitUse(partnerSlug, redemption, key, decision);
      setMessage(
        r.status === "CONFIRMED"
          ? "혜택 사용을 확인했습니다."
          : "혜택 사용을 거절했습니다.",
      );
      load();
    } catch {
      setMessage("대기 중인 사용 요청을 찾지 못했습니다.");
    }
  };
  const create = async (e: any) => {
    e.preventDefault();
    try {
      await createPartnerBenefit(partnerSlug, key, benefit);
      setMessage(
        "혜택이 초안으로 저장되었습니다. 관리자 승인 전에는 공개되지 않습니다.",
      );
    } catch {
      setMessage("혜택 내용과 관리 키를 확인해 주세요.");
    }
  };
  const downloadQr = async (kind: "go" | "visit", format: "svg" | "png") => {
    try {
      const asset = await downloadPartnerTestQr(partnerSlug, key, kind, format),
        url = URL.createObjectURL(asset.blob),
        anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = asset.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage(
        "테스트 QR을 내려받았습니다. 실제 인쇄용으로 사용하지 마세요.",
      );
    } catch {
      setMessage("테스트 QR 생성 권한과 환경설정을 확인해 주세요.");
    }
  };
  return (
    <main className="partner-flow">
      <h1>파트너 운영·성과</h1>
      <label>
        파트너 관리 키
        <input value={key} onChange={(e) => setKey(e.target.value)} />
      </label>
      <button className="btn btn-primary" onClick={load}>
        성과 불러오기
      </button>
      {metrics && (
        <section>
          <h2>익명 성과 요약</h2>
          <dl>
            <dt>QR 진입</dt>
            <dd>{metrics.qrEntries}</dd>
            <dt>AI 추천 노출</dt>
            <dd>{metrics.recommendations}</dd>
            <dt>QR 방문확인</dt>
            <dd>{metrics.qrVisits}</dd>
            <dt>혜택 사용 요청</dt>
            <dd>{metrics.benefitRequests}</dd>
            <dt>혜택 사용 확인</dt>
            <dd>{metrics.benefitUses}</dd>
          </dl>
        </section>
      )}
      <section>
        <h2>테스트 QR 다운로드</h2>
        <p>
          현재 QR은 스캔·동선 검증용입니다. exkovia.com 운영 승인 전에는
          인쇄하지 마세요.
        </p>
        <button
          className="btn btn-outline"
          onClick={() => downloadQr("go", "svg")}
        >
          진입 QR SVG
        </button>
        <button
          className="btn btn-outline"
          onClick={() => downloadQr("visit", "png")}
        >
          현장 방문확인 QR PNG
        </button>
      </section>
      <section>
        <h2>현장 혜택 사용 확인</h2>
        <input
          placeholder="사용 요청 ID"
          value={redemption}
          onChange={(e) => setRedemption(e.target.value)}
        />
        <div>
          <button className="btn btn-primary" onClick={() => decide("CONFIRM")}>
            사용 확인
          </button>
          <button className="btn btn-outline" onClick={() => decide("DECLINE")}>
            거절
          </button>
        </div>
      </section>
      <form className="partner-form" onSubmit={create}>
        <h2>혜택·특별 이벤트 초안</h2>
        <label>
          제목
          <input
            value={benefit.title || ""}
            onChange={(e) => setBenefit({ ...benefit, title: e.target.value })}
            required
          />
        </label>
        <label>
          유형
          <select
            value={benefit.benefitType}
            onChange={(e) =>
              setBenefit({ ...benefit, benefitType: e.target.value })
            }
          >
            {[
              ["NONE", "혜택 없음"],
              ["FIXED_DISCOUNT", "정액 할인"],
              ["PERCENT_DISCOUNT", "정률 할인"],
              ["DRINK", "음료 제공"],
              ["DESSERT", "디저트 제공"],
              ["SIZE_UP", "사이즈업"],
              ["EXPERIENCE_DISCOUNT", "체험료 할인"],
              ["GIFT", "기념품 제공"],
              ["LATE_CHECKOUT", "체크아웃 연장"],
              ["PRIORITY_RESERVATION", "우선 예약"],
              ["CUSTOM", "기타"],
            ].map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          표시 문구
          <input
            value={benefit.displayValue || ""}
            onChange={(e) =>
              setBenefit({ ...benefit, displayValue: e.target.value })
            }
          />
        </label>
        <label>
          적용 조건
          <input
            value={benefit.conditions || ""}
            onChange={(e) =>
              setBenefit({ ...benefit, conditions: e.target.value })
            }
          />
        </label>
        <button className="btn btn-primary">승인 요청용 초안 저장</button>
      </form>
      {message && <p role="status">{message}</p>}
    </main>
  );
}
