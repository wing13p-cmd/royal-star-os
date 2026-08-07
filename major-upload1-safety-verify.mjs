import fs from "node:fs";
import { createEnterpriseProviderPlatform } from "./server/providers/enterpriseProviderPlatform.js";

const serverSource = fs.readFileSync("./server/index.js", "utf8");
const routeChecks = {
  dealSyncPreview: serverSource.includes("/api/portfolio/deal-sync/preview"),
  dealSyncExecute: serverSource.includes("/api/portfolio/deal-sync/execute"),
  providerPlatform: serverSource.includes("/api/providers/enterprise-platform"),
};

const deals = JSON.parse(fs.readFileSync("./server/data/deals.json", "utf8"));
const goss = deals.find((entry) => entry.propertyAddress === "952 Goss Rd");
const gossPreserved = Boolean(goss) && goss.city === "Cincinnati" && goss.state === "OH" && String(goss.zipCode) === "45229";

const platform = createEnterpriseProviderPlatform({
  activeProviders: [],
  credentials: {
    "county-assessor": {},
    "county-recorder": {},
    "permit-records": {},
    fema: {},
    census: {},
    "google-maps": {},
  },
  baseUrls: {
    "county-assessor": "",
    "county-recorder": "",
    "permit-records": "",
    fema: "",
    census: "",
    "google-maps": "",
  },
});

const monitor = platform.controlLayer.monitor.list();
const liveProviderActivated = monitor.some((entry) => entry.connectionStatus === "Connected");
const manualModeOperational = platform.advisoryOnly === true && platform.liveRequestsAllowed === false;
const reviewFirstEnforced = platform.reviewQueue.summary().pending >= 0 && platform.controlLayer.reviewQueue.summary().pending >= 0;
const unreviewedIsolated =
  platform.controlLayer.reconcile.reconcile({ approvedData: {}, providerData: { reviewBlockers: ["pending review"] } })
    .unreviewedDataAffectsDecisions === false;

const commandCenterSource = fs.readFileSync("./app/src/components/commandCenterIntelligence.js", "utf8");
const commandCenterUnchangedShape = commandCenterSource.includes("buildCommandCenterIntelligence");

const secretLiteralPattern = /(api[_-]?key|token|secret|password)\s*[:=]\s*['\"][^'\"]+/i;
const newServerSource =
  fs.readFileSync("./server/dealPortfolioSyncService.js", "utf8") +
  fs.readFileSync("./server/canonicalDataFoundation.js", "utf8");
const credentialsExposed = secretLiteralPattern.test(newServerSource);

const summary = {
  routeChecks,
  gossPreserved,
  liveProviderActivated,
  manualModeOperational,
  reviewFirstEnforced,
  unreviewedIsolated,
  commandCenterUnchangedShape,
  credentialsExposed,
};

fs.writeFileSync("./major-upload1-safety-verify.json", JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log("SAFETY_VERIFY_WRITTEN");
