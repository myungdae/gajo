import { useEffect, useMemo, useRef, useState } from "react";
import { exportRegionalData,fetchRegionalData,importRegionalData,previewRegionalDataImport,regionalDataAction } from "../api/client";
import { reviewActionsFor } from "../regionalDataReview";
const REGIONS = {
  gajo: "가조",
  okcheon: "옥천",
  muan: "무안",
  gyeryong: "계룡",
  hapcheon: "합천",
  "daejeon-junggu": "대전 중구",
} as Record<string, string>;
const SOURCE_LABELS:Record<string,string>={OFFICIAL_LOCAL_GOV:"지자체 공식 정보",OFFICIAL_BUSINESS:"공식 사업자",KTO:"한국관광공사",OFFICIAL_MAP_LISTING:"공식 지도 정보",OTHER_VERIFIED_SOURCE:"기타 검증 출처"};
const FIELD_LABELS:Record<string,string>={displayName:"이름",entityType:"엔티티 유형",category:"카테고리",tags:"의미 태그",areaLabel:"권역",phone:"전화",address:"주소",latitude:"위도",longitude:"경도",websiteUrl:"홈페이지",reservationUrl:"예약 URL",operatingHours:"운영시간",shortDescription:"설명"};
export default function RegionalDataManager() {
  const [data, setData] = useState<any>({ records: [], quality: {} }),
    [filters, setFilters] = useState({
      regionId: "",
      lifecycleStatus: "",
      entityType: "",
      verificationStatus: "",
    }),
    [selected, setSelected] = useState<any>(),
    [token, setToken] = useState(
      () => sessionStorage.getItem("admin-write-token") || "",
    ),
    [error, setError] = useState(""),[notice,setNotice]=useState(""),[importPackage,setImportPackage]=useState<any>(),[importPreview,setImportPreview]=useState<any>(),[trustedImport,setTrustedImport]=useState(false);
  const reviewRef=useRef<HTMLDivElement>(null);
  const load = () =>
    fetchRegionalData(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
    )
      .then(setData)
      .catch(() => setError("지역 데이터를 불러오지 못했습니다."));
  useEffect(() => { void load(); }, [
    filters.regionId,
    filters.lifecycleStatus,
    filters.entityType,
    filters.verificationStatus,
  ]);
  const types = useMemo(
    () =>
      [
        ...new Set(
          (data.records || []).map((x: any) => x.entityType).filter(Boolean),
        ),
      ] as string[],
    [data],
  );
  const act = async (action: string) => {
    if (!selected || !token) {
      setError("관리자 쓰기 토큰을 입력해 주세요.");
      return;
    }
    try {
      sessionStorage.setItem("admin-write-token", token);
      const updated = await regionalDataAction(
        selected.id,
        action,
        undefined,
        token,
      );
      setSelected(updated);
      setError("");
      setNotice(action==='APPROVE'||action==='APPLY_CHANGE'||action==='APPROVE_EDITED'?`${updated.displayName}이(가) ACTIVE / VERIFIED로 승인되었습니다.`:"조치가 반영되었습니다.");
      void load();
    } catch {
      setError("조치를 적용하지 못했습니다. 권한과 출처를 확인해 주세요.");
    }
  };
  const q = data.quality || {};
  const requireTransferContext=()=>{if(!token){setError("관리자 쓰기 토큰을 입력해 주세요.");return false}if(!filters.regionId){setError("내보내거나 가져올 지역을 먼저 선택해 주세요.");return false}return true};
  const exportData=async()=>{if(!requireTransferContext())return;try{const pkg=await exportRegionalData(filters.regionId,token);const blob=new Blob([JSON.stringify(pkg,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download=`regional-data-${filters.regionId}-${pkg.schemaVersion}.json`;link.click();URL.revokeObjectURL(url);setError("")}catch{setError("운영 데이터를 내보내지 못했습니다.")}};
  const chooseImport=async(file?:File)=>{setImportPreview(undefined);setImportPackage(undefined);if(!file)return;if(file.size>1_000_000){setError("가져오기 파일은 1MB 이하여야 합니다.");return}try{const pkg=JSON.parse(await file.text());setImportPackage(pkg);setError("")}catch{setError("올바른 JSON 패키지를 선택해 주세요.")}};
  const previewImport=async()=>{if(!requireTransferContext()||!importPackage)return;try{if(importPackage.regionId!==filters.regionId)throw new Error();setImportPreview(await previewRegionalDataImport(importPackage,token,trustedImport));setError("")}catch{setError("패키지 검증에 실패했습니다. 지역·출처·스키마를 확인해 주세요.")}};
  const applyImport=async()=>{if(!requireTransferContext()||!importPackage||!importPreview)return;try{const result=await importRegionalData(importPackage,token,trustedImport);setImportPreview(result);setError("");void load()}catch{setError("데이터를 가져오지 못했습니다. 검토 결과를 확인해 주세요.")}};
  const selectRecord=(row:any)=>{setSelected(row);setNotice("");requestAnimationFrame(()=>{reviewRef.current?.focus({preventScroll:true});reviewRef.current?.scrollIntoView({behavior:"smooth",block:"nearest"})})};
  return (
    <section className="card regional-data-manager">
      <h2>지역 데이터 관리자</h2>
      <p className="text-muted">
        후보와 변경은 검토·승인 전까지 방문객 데이터에 반영되지 않습니다.
      </p>
      <div className="grid-2 data-kpis">
        {[
          ["운영 중", q.totalActive],
          ["검증 대기", q.awaitingVerification],
          ["재검증 필요", q.needsReverification],
          ["변경 감지", q.changeDetected],
          ["좌표 누락", q.missingCoordinates],
          ["전화 누락", q.missingPhone],
          ["액션 누락", q.missingActions],
        ].map(([label, value]) => (
          <div className="stat-box" key={label}>
            <div className="num">{value || 0}</div>
            <div className="label">{label}</div>
          </div>
        ))}
      </div>
      <div className="regional-data-filters">
        <select
          aria-label="지역"
          value={filters.regionId}
          onChange={(e) => setFilters({ ...filters, regionId: e.target.value })}
        >
          <option value="">전체 지역</option>
          {Object.entries(REGIONS).map(([id, label]) => (
            <option value={id} key={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="상태"
          value={filters.lifecycleStatus}
          onChange={(e) =>
            setFilters({ ...filters, lifecycleStatus: e.target.value })
          }
        >
          <option value="">전체 상태</option>
          {[
            "NEW_CANDIDATE",
            "NEEDS_VERIFICATION",
            "APPROVED",
            "ACTIVE",
            "CHANGE_DETECTED",
            "REJECTED",
            "ARCHIVED",
          ].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="유형"
          value={filters.entityType}
          onChange={(e) =>
            setFilters({ ...filters, entityType: e.target.value })
          }
        >
          <option value="">전체 유형</option>
          {types.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <select
          aria-label="검증"
          value={filters.verificationStatus}
          onChange={(e) =>
            setFilters({ ...filters, verificationStatus: e.target.value })
          }
        >
          <option value="">전체 검증</option>
          {["UNVERIFIED", "PARTIAL", "VERIFIED", "REVERIFY_REQUIRED"].map(
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>
      </div>
      <section className="regional-transfer" aria-label="데이터 관리">
        <h3>데이터 관리</h3><p className="text-muted">기본 가져오기는 방문객에게 보이지 않는 검증 대기 상태입니다.</p>
        <input type="password" value={token} onChange={e=>setToken(e.target.value)} placeholder="관리자 쓰기 토큰" aria-label="데이터 관리 관리자 쓰기 토큰"/>
        <div className="regional-transfer-actions"><button className="btn btn-outline" onClick={exportData}>운영 데이터 내보내기</button><label className="btn btn-outline">데이터 가져오기<input type="file" accept="application/json,.json" onChange={e=>void chooseImport(e.target.files?.[0])}/></label></div>
        {importPackage&&<div className="regional-import-review"><p>지역: <b>{REGIONS[importPackage.regionId]||importPackage.regionId}</b> · 레코드: <b>{importPackage.records?.length??0}</b> · 스키마: <b>{importPackage.schemaVersion||"-"}</b></p><label><input type="checkbox" checked={trustedImport} onChange={e=>{setTrustedImport(e.target.checked);setImportPreview(undefined)}}/> 명시적 trusted verified import (즉시 활성화)</label><button className="btn btn-outline" onClick={previewImport}>가져오기 검토</button></div>}
        {importPreview&&<div className="regional-import-summary" role="status"><span>신규 {importPreview.newRecords}</span><span>충돌 {importPreview.conflicts}</span><span>변경 없음 {importPreview.unchangedRecords}</span><span>검증 대기 {importPreview.stagedRecords}</span><button className="btn btn-primary" onClick={applyImport}>{trustedImport?"검증 데이터 활성화":"검증 대기로 가져오기"}</button></div>}
      </section>
      <div className="regional-data-list">
        {(data.records || []).map((row: any) => (
          <button
            key={row.id}
            onClick={() => selectRecord(row)}
            className={selected?.id === row.id ? "selected" : ""}
            aria-expanded={selected?.id === row.id}
            aria-controls="regional-data-review"
          >
            <b>{row.displayName}</b>
            <span>
              {REGIONS[row.regionId] || row.regionId} ·{" "}
              {row.entityType || "유형 미정"}
            </span>
            <small>
              {row.lifecycleStatus} · {SOURCE_LABELS[row.source?.sourceType]||row.source?.sourceName||row.source?.sourceType} ·{" "}
              {row.lastVerifiedAt?.slice(0, 10) || "미검증"} · 변경{" "}
              {row.detectedChanges?.length || 0}
            </small>
          </button>
        ))}
      </div>
      {selected && (
        <div className="regional-data-review" id="regional-data-review" ref={reviewRef} tabIndex={-1}>
          <div className="regional-review-heading"><div><small>{REGIONS[selected.regionId]||selected.regionId} · {selected.entityType||"유형 미정"} / {selected.category||"카테고리 미정"}</small><h3>{selected.displayName}</h3></div>{selected.lifecycleStatus==='NEEDS_VERIFICATION'&&<strong className="verification-waiting">운영 반영 전 검증 대기</strong>}</div>
          <dl className="regional-review-status"><div><dt>생명주기</dt><dd>{selected.lifecycleStatus}</dd></div><div><dt>검증 상태</dt><dd>{selected.verificationStatus}</dd></div><div><dt>최종 검증일</dt><dd>{selected.lastVerifiedAt?.slice(0,10)||"미검증"}</dd></div></dl>
          <p>{selected.canonicalEntityId}</p>
          <table className="simple">
            <thead>
              <tr>
                <th>항목</th>
                <th>현재 운영 데이터</th>
                <th>새 후보/변경 제안</th>
              </tr>
            </thead>
            <tbody>
              {[
                "displayName",
                "entityType",
                "category",
                "tags",
                "areaLabel",
                "phone",
                "address",
                "latitude",
                "longitude",
                "websiteUrl",
                "reservationUrl",
                "operatingHours",
                "shortDescription",
              ].map((field) => (
                <tr key={field}>
                  <td>{FIELD_LABELS[field]||field}</td>
                  <td>{String(selected[field] ?? "-")}</td>
                  <td>{String(selected.proposedFacts?.[field] ?? "-")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>출처: {SOURCE_LABELS[selected.source?.sourceType]||selected.source?.sourceName||selected.source?.sourceType} · <a href={selected.source?.sourceUrl} target="_blank" rel="noreferrer">근거 열기</a></p>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="관리자 쓰기 토큰"
            aria-label="관리자 쓰기 토큰"
          />
          <div className="regional-data-actions">
            {reviewActionsFor(selected.lifecycleStatus).map(([action, label]) => (
              <button
                className="btn btn-outline"
                key={action}
                onClick={() => act(action)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {notice&&<p className="regional-action-notice" role="status">{notice}</p>}
      {error && (
        <p className="voice-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
