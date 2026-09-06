import test from "node:test";
import assert from "node:assert/strict";
import {
  locationPair,
  locationPayload,
  locationMutation,
  locationRequest,
} from "./locationReview.ts";

test("location input rejects blank, NaN, zero-zero and range errors while accepting valid edges", () => {
  for (const pair of [
    ["", "128"],
    [" ", "128"],
    ["NaN", "128"],
    [null, 128],
    [true, 128],
    [91, 128],
    [35, 181],
    [0, 0],
    [Infinity, 128],
  ])
    assert.equal(locationPair(...(pair as [any, any])), undefined);
  assert.deepEqual(locationPair("-90", "180"), {
    latitude: -90,
    longitude: 180,
  });
});
test("payload includes only proposal facts and requires provenance and reason", () => {
  const form = {
    latitude: "35.55",
    longitude: "128.05",
    normalizedAddress: " 확인 주소 ",
    sourceType: "FIELD_SURVEY",
    sourceReference: "현장 확인 기록 34",
    reason: "출입구 위치 확인",
  };
  assert.equal(locationPayload(form).normalizedAddress, "확인 주소");
  for (const patch of [
    { reason: "" },
    { sourceReference: "" },
    { normalizedAddress: "" },
    { sourceType: "" },
  ])
    assert.throws(() => locationPayload({ ...form, ...patch }));
  assert.equal("verificationStatus" in locationPayload(form), false);
});
test("admin and JWT requests use separate credentials and scope every request", async () => {
  for (const kind of ["admin", "copilot"] as const) {
    const calls: any[] = [];
    const fetcher = async (url: any, init: any) => {
      calls.push({ url, init });
      return { ok: true, json: async () => ({ records: [] }) } as Response;
    };
    await locationRequest(
      { kind, token: "fixture-token" },
      "okcheon",
      "?missingOnly=true",
      undefined,
      fetcher,
    );
    assert.equal(calls[0].init.method, "GET");
    assert.match(calls[0].url, /regionId=okcheon/);
    assert.equal(
      calls[0].init.headers[
        kind === "admin" ? "x-admin-token" : "Authorization"
      ],
      kind === "admin" ? "fixture-token" : "Bearer fixture-token",
    );
    assert.equal(
      calls[0].init.headers[
        kind === "admin" ? "Authorization" : "x-admin-token"
      ],
      undefined,
    );
  }
});
test("retry body retains captured version, hash and request ID; no automatic re-preflight", async () => {
  const body = locationMutation(
    { expectedVersion: 3, expectedHash: "a".repeat(64) },
    { reason: "승인 검토 완료", reviewConfirmed: true },
    "fixture-request",
  );
  const sent: any[] = [];
  const fetcher = async (_url: any, init: any) => {
    sent.push(init.body);
    return {
      ok: false,
      status: 409,
      text: () => {
        throw Error("must not read raw error");
      },
    } as any;
  };
  await assert.rejects(
    locationRequest(
      { kind: "admin", token: "fixture" },
      "gajo",
      "/id/actions/APPROVE",
      body,
      fetcher,
    ),
    /충돌/,
  );
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(sent[0]).precondition, {
    expectedVersion: 3,
    expectedHash: "a".repeat(64),
    requestId: "fixture-request",
  });
});
test("missing credentials and region are blocked before HTTP", async () => {
  const fetcher = async () => {
    throw Error("must not fetch");
  };
  await assert.rejects(
    locationRequest(
      { kind: "admin", token: "" },
      "hapcheon",
      "",
      undefined,
      fetcher,
    ),
    /인증/,
  );
  await assert.rejects(
    locationRequest(
      { kind: "admin", token: "fixture" },
      "",
      "",
      undefined,
      fetcher,
    ),
    /인증/,
  );
});
