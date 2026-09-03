import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const output = resolve("../docs/evidence/receipt-45");
await mkdir(output, { recursive: true });
const port = process.argv[3] || "9223";
const browser = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
const socket = new WebSocket(browser.webSocketDebuggerUrl);
await new Promise((ready, reject) => { socket.addEventListener("open", ready, { once: true }); socket.addEventListener("error", reject, { once: true }); });
let sequence = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => { const message = JSON.parse(data); if (message.id && pending.has(message.id)) { const { resolve, reject } = pending.get(message.id); pending.delete(message.id); message.error ? reject(new Error(message.error.message)) : resolve(message.result); } });
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); });

const steps = [
  ["01-home-390x844.png", 390, 844, "/hapcheon?start=ai&lang=en"],
  ["02-nearby-360x800.png", 360, 800, "/hapcheon/nearby-discovery?lang=en"],
  ["03-location-390x844.png", 390, 844, "/hapcheon/nearby-discovery?lang=en"],
  ["04-results-844x390.png", 844, 390, "/hapcheon/nearby-discovery?category=FOOD&lang=en"],
  ["05-map-390x844.png", 390, 844, "/hapcheon/map?lang=en"],
  ["06-trip-390x844.png", 390, 844, "/hapcheon/itinerary?lang=en"],
  ["07-assistant-360x800.png", 360, 800, "/hapcheon/concierge?mode=now&lang=en"],
  ["08-crater-390x844.png", 390, 844, "/hapcheon/meteor-crater?lang=en"],
  ["09-home-landscape-844x390.png", 844, 390, "/hapcheon?start=ai&lang=en"],
  ["10-home-200pct-195x422.png", 195, 422, "/hapcheon?start=ai&lang=en"],
];
const selectedIndex = Number(process.argv[2] || 1) - 1;
const selectedSteps = Number.isInteger(selectedIndex) && steps[selectedIndex] ? [steps[selectedIndex]] : steps;
const report = [];
const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
for (const [name, width, height, path] of selectedSteps) {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 500 }, sessionId);
  await send("Page.navigate", { url: `http://127.0.0.1:5174${path}` }, sessionId);
  await new Promise((done) => setTimeout(done, 1800));
  const state = await send("Runtime.evaluate", { expression: `({url:location.href,lang:document.documentElement.lang,overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth,title:document.title})`, returnByValue: true }, sessionId);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true }, sessionId);
  await writeFile(resolve(output, name), Buffer.from(shot.data, "base64"));
  report.push({ step: name, width, height, ...state.result.value });
}
await writeFile(resolve(output, `flow-report-${selectedIndex + 1}.json`), `${JSON.stringify(report, null, 2)}\n`);
process.exit(0);
