import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  locationMutation,
  locationPair,
  locationPayload,
  locationRequest,
  locationSourceLabels,
  locationStatusLabels,
} from "../locationReview";
import type { LocationForm } from "../locationReview";
import "../location-review.css";
const LocationPinMap = lazy(() => import("./LocationPinMap"));
const empty = (): LocationForm => ({
  latitude: "",
  longitude: "",
  normalizedAddress: "",
  sourceType: "OFFICIAL_MAP_LISTING",
  sourceReference: "",
  reason: "",
});
const pairLabel = (p: any) =>
  p ? `${p.latitude}, ${p.longitude}` : "확인되지 않음";
function Warnings({ value }: { value: any }) {
  if (!value) return null;
  return (
    <div className="location-warnings" role="status">
      {!value.boundaryKnown && (
        <p>지역 경계 정보가 없어 일반 승인할 수 없습니다.</p>
      )}
      {value.outsideRegion && (
        <p>현재 지역 경계 밖입니다. 일반 승인할 수 없습니다.</p>
      )}
      {value.largeMove && (
        <p>
          기존 위치에서 약 {value.movedMeters.toLocaleString()}m 이동합니다.
          출입구와 주소를 다시 확인해 주세요.
        </p>
      )}
      {value.duplicates?.length > 0 && (
        <p>
          동일 좌표의 다른 장소가 있습니다:{" "}
          {value.duplicates.map((d: any) => d.displayName).join(", ")}. 같은
          건물의 다른 업소인지 확인해 주세요. 자동 병합하지 않습니다.
        </p>
      )}
    </div>
  );
}
export default function LocationReviewManager({
  regionId,
  copilotToken,
}: {
  regionId: string;
  copilotToken?: string;
}) {
  const [token, setToken] = useState(
      () => sessionStorage.getItem("copilot-access-token") || "",
    ),
    [missing, setMissing] = useState(true),
    [listState, setListState] = useState<"idle" | "loading" | "loaded" | "error">("idle"),
    [rows, setRows] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(),
    [form, setForm] = useState<LocationForm>(empty),
    [preview, setPreview] = useState<any>(),
    [candidates, setCandidates] = useState<any>(),
    [reason, setReason] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [retry, setRetry] = useState<{ path: string; body: any }>();
  const epoch = useRef(0),
    lock = useRef(false);
  const auth = {
    kind: "copilot" as const,
    token: copilotToken ?? token,
  };
  useEffect(() => {
    const refresh = () => setToken(sessionStorage.getItem("copilot-access-token") || "");
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("copilot-session-change", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("copilot-session-change", refresh);
    };
  }, []);
  const resetSelection = () => {
    setSelected(undefined);
    setPreview(undefined);
    setCandidates(undefined);
    setReason("");
    setConfirmed(false);
    setRetry(undefined);
  };
  const setRecord = (value: any) => {
    setSelected(value);
    setPreview(undefined);
    setCandidates(undefined);
    setConfirmed(false);
    setReason("");
    const p =
      value.proposal?.verificationStatus === "PROPOSED"
        ? value.proposal
        : value.current;
    setForm({
      ...empty(),
      latitude: p?.latitude?.toString() || "",
      longitude: p?.longitude?.toString() || "",
      normalizedAddress:
        value.proposal?.normalizedAddress || value.address || "",
      sourceType: value.proposal?.sourceType || "OFFICIAL_MAP_LISTING",
      sourceReference: value.proposal?.sourceReference || "",
      reason: "",
    });
  };
  useEffect(() => {
    const version = ++epoch.current;
    lock.current = false;
    setBusy(false);
    resetSelection();
    setRows([]);
    setError("");
    setNotice("");
    setListState("idle");
    if (!auth.token || !regionId) return;
    setListState("loading");
    locationRequest(auth, regionId, `?missingOnly=${missing}`)
      .then((data) => {
        if (!Array.isArray(data?.records)) throw new Error("장소 목록 응답을 확인하지 못했습니다. 다시 시도해 주세요.");
        if (version === epoch.current) { setRows(data.records); setListState("loaded"); }
      })
      .catch((e) => {
        if (version === epoch.current) { setError(e.message); setListState("error"); }
      });
    return () => {
      epoch.current++;
    };
  }, [regionId, token, copilotToken, missing]);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const version = epoch.current;
    try {
      await task();
    } catch (e: any) {
      if (version === epoch.current)
        setError(
          e.message ||
            "요청 결과를 확인하지 못했습니다. 새로 불러오거나 같은 요청을 재확인해 주세요.",
        );
    } finally {
      if (version === epoch.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  const open = (id: string) => {
    if (lock.current) return Promise.resolve();
    const version = ++epoch.current;
    resetSelection();
    return run(async () => {
      const value = await locationRequest(
        auth,
        regionId,
        `/${encodeURIComponent(id)}`,
      );
      if (version === epoch.current) setRecord(value);
    });
  };
  const mutate = (path: string, body: any) =>
    run(async () => {
      const version = epoch.current;
      setRetry({ path, body });
      const value = await locationRequest(auth, regionId, path, body);
      if (version !== epoch.current) return;
      setRetry(undefined);
      setRecord(value);
      setRows((current) =>
        current
          .map((r) => (r.id === value.id ? value : r))
          .filter((r) => !missing || r.needsLocationReview),
      );
      setNotice(
        "위치 검토 결과가 반영되었습니다. 대표명과 다른 장소 정보는 변경하지 않았습니다.",
      );
    });
  const action = (name: string) => {
    if (!selected) return;
    try {
      const values =
        name === "PROPOSE"
          ? { proposal: locationPayload(form) }
          : { reason, reviewConfirmed: confirmed };
      void mutate(
        `/${encodeURIComponent(selected.id)}/actions/${name}`,
        locationMutation(selected.precondition, values),
      );
    } catch (e: any) {
      setError(e.message);
    }
  };
  const change = (patch: Partial<LocationForm>) => {
    setForm((old) => ({ ...old, ...patch }));
    setPreview(undefined);
  };
  const pending = selected?.proposal?.verificationStatus === "PROPOSED",
    point = locationPair(form.latitude, form.longitude);
  const writable = selected?.canWrite && !busy && !retry;
  return (
    <section
      className="location-review-manager"
      aria-label="장소 위치정보 관리"
    >
      <h2>장소 위치정보 관리</h2>
      <p>
        기존 장소의 위치만 보완합니다. 지도·거리·길찾기에는 승인된 좌표만
        반영됩니다.
      </p>
      {!auth.token && <p role="alert">로그인이 필요합니다. Regional Manager 계정으로 로그인한 뒤 다시 열어 주세요.</p>}
      {!regionId && <p role="alert">관리 지역을 선택해 주세요.</p>}
      {listState === "loading" && <p role="status">장소 목록을 불러오는 중입니다.</p>}
      <label>
        <input
          type="checkbox"
          checked={missing}
          disabled={busy}
          onChange={(e) => setMissing(e.target.checked)}
        />{" "}
        좌표 없는 장소만
      </label>
      <ul className="location-place-list">
        {rows.map((row) => (
          <li key={row.id}>
            <b>{row.publicDisplayName || row.displayName}</b>
            <span>
              {row.address || "주소 미등록"} · {row.phone || "전화 미등록"}
            </span>
            <span>
              현재 좌표: {pairLabel(row.current)} ·{" "}
              {row.mapVisible ? "지도 공개 중" : "지도 미노출"}
            </span>
            {!row.mapVisible && <p>{row.mapHiddenReason}</p>}
            {row.needsLocationReview && (
              <p>
                지도에 표시하려면 위치 확인이 필요합니다. 등록된 검색·상세·전화
                기능은 계속 이용할 수 있습니다.
              </p>
            )}
            <span>
              좌표 상태:{" "}
              {locationStatusLabels[
                row.coordinateEvidence?.verificationStatus
              ] || "검토 필요"}{" "}
              · 마지막 수정: {row.lastModifiedBy || "기록 없음"} /{" "}
              {row.lastModifiedAt || "기록 없음"}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void open(row.id)}
            >
              위치정보 보완
              <span className="sr-only">
                {" "}
                {row.publicDisplayName || row.displayName}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {auth.token && listState === "loaded" && rows.length === 0 && !error && (
        <p>
          해당 조건의 장소가 없습니다. 좌표가 잘못된 장소는 전체 목록에서 확인해
          주세요.
        </p>
      )}
      {selected && (
        <section
          className="location-review-detail"
          aria-label="선택 장소 위치 검토"
        >
          <h3>{selected.publicDisplayName || selected.displayName}</h3>
          <p>
            현재 DB 표시명: {selected.displayName} · 대표명 변경은 기존 이름
            검토에서 별도로 진행합니다.
          </p>
          <p>
            주소: {selected.address || "미등록"} · 전화:{" "}
            {selected.phone || "미등록"}
          </p>
          <p>
            현재 좌표: {pairLabel(selected.current)} ·{" "}
            {selected.mapVisible ? "지도 공개 중" : selected.mapHiddenReason}
          </p>
          <p>
            좌표 출처:{" "}
            {locationSourceLabels[
              selected.coordinateEvidence?.sourceType ||
                selected.coordinateEvidence?.source?.sourceType
            ] || "기존 근거 확인 필요"}{" "}
            ·{" "}
            {selected.coordinateEvidence?.sourceReference ||
              selected.coordinateEvidence?.source?.sourceUrl ||
              "근거 미등록"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void open(selected.id)}
          >
            새로 불러오기
          </button>
          {selected.proposal && (
            <p>
              위치 검토 상태:{" "}
              {locationStatusLabels[selected.proposal.verificationStatus]} ·
              제안자 {selected.proposal.proposedBy} ·{" "}
              {selected.proposal.proposedAt}
            </p>
          )}
          <Suspense fallback={<p>검토 지도를 불러오는 중입니다.</p>}>
            <LocationPinMap
              key={selected.id}
              point={point}
              current={selected.current}
              center={selected.region?.center}
              editable={Boolean(writable && !pending)}
              onChange={(p) =>
                change({
                  latitude: p.latitude.toFixed(7),
                  longitude: p.longitude.toFixed(7),
                })
              }
            />
          </Suspense>
          <fieldset disabled={!writable || pending}>
            <legend>위치 후보와 근거</legend>
            <label>
              확인 주소
              <input
                value={form.normalizedAddress}
                onChange={(e) => change({ normalizedAddress: e.target.value })}
                maxLength={300}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  const version = epoch.current;
                  const result = await locationRequest(
                    auth,
                    regionId,
                    `/${encodeURIComponent(selected.id)}/candidates`,
                    { address: form.normalizedAddress },
                  );
                  if (version === epoch.current) setCandidates(result);
                })
              }
            >
              주소 기반 후보 확인
            </button>
            {candidates && (
              <div role="status">
                <p>
                  {
                    (
                      {
                        UNAVAILABLE:
                          "주소 검색을 사용할 수 없습니다. 잠시 후 다시 시도하거나 근거를 확인해 직접 핀을 지정해 주세요.",
                        EMPTY:
                          "주소 후보가 없습니다. 주소를 더 자세히 입력해 주세요.",
                        MULTIPLE:
                          "여러 후보가 있습니다. 주소와 지도를 대조해 하나를 선택해 주세요.",
                        LOW_CONFIDENCE:
                          "정확한 건물 위치가 아닐 수 있습니다. 추가 근거를 확인해 주세요.",
                        FOUND:
                          "주소 후보입니다. 실제 출입구를 지도에서 확인해 주세요.",
                      } as Record<string, string>
                    )[candidates.status]
                  }
                </p>
                {candidates.candidates.map((c: any, i: number) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() =>
                      change({
                        latitude: String(c.latitude),
                        longitude: String(c.longitude),
                        normalizedAddress: c.normalizedAddress,
                        sourceType: c.sourceType,
                        sourceReference: c.sourceReference,
                      })
                    }
                  >
                    {c.normalizedAddress} (
                    {c.confidence === "LOW"
                      ? "낮은 신뢰도"
                      : "주소 일치 · 미승인"}
                    )
                  </button>
                ))}
              </div>
            )}
            <div className="location-fields">
              <label>
                위도
                <input
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(e) => change({ latitude: e.target.value })}
                />
              </label>
              <label>
                경도
                <input
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(e) => change({ longitude: e.target.value })}
                />
              </label>
              <label>
                출처 유형
                <select
                  value={form.sourceType}
                  onChange={(e) => change({ sourceType: e.target.value })}
                >
                  {Object.entries(locationSourceLabels).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                출처 근거
                <input
                  value={form.sourceReference}
                  onChange={(e) => change({ sourceReference: e.target.value })}
                  maxLength={1000}
                  placeholder="공식 URL 또는 현장 확인 기록"
                />
              </label>
            </div>
            <label>
              변경 사유
              <textarea
                value={form.reason}
                onChange={(e) => change({ reason: e.target.value })}
                maxLength={500}
              />
            </label>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  const version = epoch.current;
                  const result = await locationRequest(
                    auth,
                    regionId,
                    `/${encodeURIComponent(selected.id)}/preview`,
                    locationPayload(form),
                  );
                  if (version === epoch.current) setPreview(result);
                })
              }
            >
              변경 전·후 비교
            </button>
            {preview && (
              <>
                <p>
                  변경 전: {pairLabel(preview.current)} → 제안:{" "}
                  {pairLabel(preview.proposal)}
                </p>
                <Warnings value={preview.warnings} />
                <button type="button" onClick={() => action("PROPOSE")}>
                  검토 요청
                </button>
              </>
            )}
          </fieldset>
          {pending && (
            <>
              <p>
                변경 전: {pairLabel(selected.current)} → 제안:{" "}
                {pairLabel(selected.proposal)}
              </p>
              <p>제안 주소: {selected.proposal.normalizedAddress}</p>
              <p>
                출처: {locationSourceLabels[selected.proposal.sourceType]} ·{" "}
                {selected.proposal.sourceReference}
              </p>
              <p>변경 사유: {selected.proposal.reason}</p>
              <Warnings value={selected.warnings} />
            </>
          )}
          {(pending || selected.canRestore) && (
            <fieldset disabled={!writable}>
              <legend>검토 결정</legend>
              {pending && (
                <p>
                  승인하면 검토한 위치가 공개 지도·거리 계산·길찾기에
                  반영됩니다. 별도의 공개 제한이 있는 장소는 그 검토도
                  필요합니다. 이름·별칭·장소 식별자·주소·전화는 바뀌지 않습니다.
                  반려하면 기존 공개 위치가 유지됩니다.
                </p>
              )}
              <p>
                되돌리기는 이 장소의 이전 좌표만 복원합니다. 승인 후 다른 수정이
                생기면 복원할 수 없으며 새 위치 검토가 필요합니다. 검토 이력은
                남고 다른 장소는 바뀌지 않습니다.
              </p>
              <label>
                검토 사유
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={500}
                />
              </label>
              {pending && (
                <>
                  <label>
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />{" "}
                    지도·출처·이동 거리·중복 경고를 확인했습니다.
                  </label>
                  <button
                    type="button"
                    disabled={
                      !confirmed ||
                      reason.trim().length < 5 ||
                      selected.warnings?.approvalBlocked
                    }
                    onClick={() => action("APPROVE")}
                  >
                    승인
                  </button>
                  <button
                    type="button"
                    disabled={reason.trim().length < 5}
                    onClick={() => action("REJECT")}
                  >
                    반려
                  </button>
                </>
              )}
              {selected.canRestore && (
                <button
                  type="button"
                  disabled={reason.trim().length < 5}
                  onClick={() => action("RESTORE")}
                >
                  이전 좌표로 조건부 복원
                </button>
              )}
            </fieldset>
          )}
          {selected.restoreBlocked && (
            <p role="status">
              승인 이후 다른 수정이 있어 이전 좌표로 바로 되돌릴 수 없습니다.
              현재 내용을 확인한 뒤 새 위치 검토를 요청해 주세요.
            </p>
          )}
        </section>
      )}
      {busy && <p role="status">처리 중입니다.</p>}
      {notice && <p role="status">{notice}</p>}
      {error && <p role="alert">{error}</p>}
      {retry && (
        <div>
          <p>
            응답 실패가 미반영을 뜻하지는 않습니다. 같은 요청을 재확인하거나
            장소를 새로 불러오세요.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void mutate(retry.path, retry.body)}
          >
            같은 요청 결과 재확인
          </button>
        </div>
      )}
    </section>
  );
}
