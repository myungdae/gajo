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
      <h1>AI 관광 파트너로 참여하세요</h1>
      <p>
        지역을 찾은 여행자가 지금 필요한 식당·카페·숙박·체험시설 등을 찾을 때,
        AI가 여행 상황에 맞는 지역 업소를 발견하고 다음 행동으로 연결하도록 돕습니다.
      </p>
      <ul>
        <li>AI를 통한 우리 업소 노출·발견</li>
        <li>전화·지도·내비게이션으로 바로 연결</li>
        <li>업소 QR을 통한 현장 접점 확인</li>
        <li>할인·쿠폰 등 방문 혜택은 업소가 선택</li>
        <li>추천부터 현장 접점·혜택 이용까지 집계된 성과 확인</li>
        <li>혜택을 제공하지 않아도 기본 참여 가능</li>
      </ul><p className="partner-security-note">현재는 시범 참여 단계입니다. 승인된 업소에는 별도의 안전한 관리 방법을 안내해 드립니다.</p></section>
      <section className="partner-pilot-example" aria-labelledby="partner-pilot-title"><div className="partner-pilot-heading"><small>화면 구성 예시 · 가상 데이터</small><h2 id="partner-pilot-title">합천 시범 운영 결과는 이렇게 확인합니다</h2><strong>실제 합천 운영 데이터가 아닙니다</strong><p>합천에서 10~20개 지역 업소 참여를 목표로 시범 운영을 준비하고 있습니다. 아래 화면은 업주가 확인하게 될 집계 결과의 구성을 보여주는 예시입니다.</p></div><div className="partner-pilot-flow" aria-label="단계별 익명 집계 흐름"><span>AI 추천 노출</span><span>전화·지도·내비게이션 연결</span><span>현장 QR 접점</span><span>혜택 이용</span></div><div className="partner-pilot-businesses">{['숙박 A','음식점 B','카페 C','관광·체험 D'].map(name=><article key={name}><h3>{name}</h3><p>승인된 집계 항목만 표시되는 예시 카드</p></article>)}</div><p>시범 운영 시작 후 약 한 달을 첫 점검 시점으로 삼아, 개인정보 보호 기준을 충족한 집계부터 실제 운영 결과로 전환할 예정입니다.</p><div className="partner-result-policy"><h3>실제 데이터 전환 조건</h3><ul><li>승인된 운영 업소</li><li>고정된 완료 기간</li><li>중복 제거</li><li>최소 5개의 서로 다른 익명 흐름</li><li>기준 미달 항목 suppression</li><li>공개 페이지가 아닌 인증된 관리 범위</li></ul></div></section>
      <h2>우리 업소 참여 신청</h2>
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
          우리 업소 참여 신청
        </button>
      </form>
      <details className="partner-pilot-details"><summary>시범운영 안내</summary><p>현재 운영 화면은 시범 운영용 관리 키를 사용합니다. 일반 공개 운영 전에는 업주 계정, 다중 인증(MFA), 키 회수와 감사 정책을 갖춰야 합니다.</p></details>
    </main>
  );
}
