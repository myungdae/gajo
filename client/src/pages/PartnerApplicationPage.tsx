import { useState } from "react";
import { applyForPartnership } from "../api/client";
import PublicBrand from "../components/PublicBrand";
export default function PartnerApplicationPage() {
  const [state, setState] = useState<any>({
      regionId: "hapcheon",
      consent: false,
    }),
    [done, setDone] = useState<any>(),
    [error, setError] = useState("");
  const set = (k: string, v: any) => setState((x: any) => ({ ...x, [k]: v }));
  const submit = async (e: any) => {
    e.preventDefault();
    setError("");
    try {
      setDone(await applyForPartnership(state));
    } catch (err: any) {
      setError(err?.response?.data?.message || "신청 내용을 확인해 주세요.");
    }
  };
  if (done)
    return (
      <main className="partner-flow">
        <h1>참여 신청이 접수되었습니다</h1>
        <p>관리자 검토 후 승인·AI 등록·QR 발급 절차가 진행됩니다.</p>
        <p>
          <b>파트너 관리 키</b>
        </p>
        <code>{done.managementKey}</code>
        <p>{done.managementKeyNotice}</p>
      </main>
    );
  return (
    <main className="partner-flow">
      <PublicBrand />
      <section className="partner-value-intro"><small>지역 업소 파트너</small>
      <h1>AI 관광 파트너 참여하기</h1>
      <p>
        AI가 관광객의 현재 상황과 여행 목적에 맞는 지역 업소를 발견하고 실제
        방문으로 연결하도록 돕습니다.
      </p>
      <ul>
        <li>AI 추천을 통한 업소 발견</li>
        <li>전화·지도·내비 연결</li>
        <li>QR 방문확인</li>
        <li>선택적 방문 혜택 제공</li>
        <li>추천·방문·혜택 사용 성과 확인</li>
        <li>혜택 없이도 참여 가능</li>
      </ul><p className="partner-security-note">현재는 시범 참여 단계입니다. 승인된 업소에는 별도의 안전한 관리 방법을 안내해 드립니다.</p></section>
      <h2>참여 신청</h2>
      <form className="partner-form" onSubmit={submit}>
        <label className="sr-only" aria-hidden="true">
          웹사이트
          <input
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={state.website || ""}
            onChange={(e) => set("website", e.target.value)}
          />
        </label>
        {[
          ["displayName", "업소명"],
          ["category", "업종"],
          ["address", "주소"],
          ["phone", "연락처"],
          ["operatingHours", "영업시간"],
          ["representativeImageUrl", "대표사진 URL"],
          ["description", "업소 소개"],
          ["proposedBenefit", "제공 가능한 혜택(선택)"],
        ].map(([k, l]) => (
          <label key={k}>
            {l}
            <input
              required={[
                "displayName",
                "category",
                "address",
                "phone",
              ].includes(k)}
              value={state[k] || ""}
              maxLength={{displayName:120,category:80,address:300,phone:40,operatingHours:1000,representativeImageUrl:500,description:2000,proposedBenefit:1000}[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          </label>
        ))}
        <label>
          <input
            type="checkbox"
            checked={state.consent}
            onChange={(e) => set("consent", e.target.checked)}
          />{" "}
          참여 신청 및 최소 정보 수집·검토에 동의합니다.
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="btn btn-primary" type="submit">
          참여 신청
        </button>
      </form>
      <details className="partner-pilot-details"><summary>시범운영 안내</summary><p>현재 운영 화면은 시범 운영용 관리 키를 사용합니다. 일반 공개 운영 전에는 업주 계정, 다중 인증(MFA), 키 회수와 감사 정책을 갖춰야 합니다.</p></details>
    </main>
  );
}
