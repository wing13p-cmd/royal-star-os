import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import { getSidebarNavigation } from "../utils/navigationModel.js";
import {
  buildAiCommandRouting,
  buildDocumentAutomationIntelligence,
  buildKnowledgeIntelligence,
  buildReportingIntelligence,
  buildSearchIntelligence,
} from "./intelligenceUpgradeEngine.js";
import { buildEnterpriseForecastingEngine } from "./enterpriseForecastingEngine.js";

const navigation = getSidebarNavigation();
const workspaceTabs = [
  ["knowledgeBase", "Knowledge"],
  ["enterpriseSearch", "Search"],
  ["forecastingCenter", "Forecasting"],
  ["reportingCenter", "Reporting"],
  ["documentAutomation", "Documents"],
  ["aiCommandCenter", "AI Commands"],
];

const titleByView = Object.fromEntries(workspaceTabs);
const safeArray = (value) => Array.isArray(value) ? value : [];
const formatCurrency = (value) => Number.isFinite(Number(value)) && Number(value) !== 0
  ? `$${Number(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`
  : "Insufficient Data";

function downloadJson(filename, payload) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Card({ title, children }) {
  return <section style={styles.card}><h2 style={styles.cardTitle}>{title}</h2>{children}</section>;
}

export default function IntelligenceWorkspace({ currentView = "knowledgeBase", onNavigate, onBack }) {
  const [data, setData] = useState({ deals: [], properties: [], contractors: [], lenders: [], intelligence: [], packets: [], rehabProjects: [] });
  const [status, setStatus] = useState("Loading saved RSOS data…");
  const [selectedDealId, setSelectedDealId] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    const endpoints = {
      deals: "/api/deals", properties: "/api/properties", contractors: "/api/contractors", lenders: "/api/lenders",
      intelligence: "/api/deal-intelligence", packets: "/api/appraisal-packets", rehabProjects: "/api/rehab-projects",
    };
    Promise.all(Object.entries(endpoints).map(async ([key, endpoint]) => {
      try {
        const response = await fetch(buildApiUrl(endpoint));
        return [key, response.ok ? safeArray(await response.json()) : []];
      } catch {
        return [key, []];
      }
    })).then((entries) => {
      if (cancelled) return;
      const next = Object.fromEntries(entries);
      setData(next);
      setSelectedDealId((current) => current || next.deals?.[0]?.id || "");
      setStatus(next.deals?.length ? "Live saved data loaded" : "No saved deals available");
    });
    return () => { cancelled = true; };
  }, []);

  const selectedDeal = useMemo(() => data.deals.find((deal) => String(deal.id) === String(selectedDealId)) || data.deals[0] || {}, [data.deals, selectedDealId]);
  const selectedAnalysis = useMemo(() => data.intelligence.find((entry) => String(entry.propertyId || entry.dealId) === String(selectedDeal.id)) || data.intelligence[0] || {}, [data.intelligence, selectedDeal]);
  const knowledge = useMemo(() => buildKnowledgeIntelligence(selectedDeal, selectedAnalysis, selectedAnalysis.knowledgeLessons || []), [selectedDeal, selectedAnalysis]);
  const search = useMemo(() => buildSearchIntelligence(query, data.deals, data.properties, data.contractors, data.lenders, data.intelligence, []), [query, data]);
  const reporting = useMemo(() => buildReportingIntelligence(selectedDeal, selectedAnalysis, {}, data.packets), [selectedDeal, selectedAnalysis, data.packets]);
  const documents = useMemo(() => buildDocumentAutomationIntelligence(selectedDeal, selectedAnalysis, data.packets), [selectedDeal, selectedAnalysis, data.packets]);
  const command = useMemo(() => buildAiCommandRouting(selectedDeal, selectedAnalysis), [selectedDeal, selectedAnalysis]);
  const forecast = useMemo(() => buildEnterpriseForecastingEngine({ properties: data.properties, deals: data.deals, rehabProjects: data.rehabProjects, portfolioIntelligence: {} }), [data]);
  const heading = titleByView[currentView] || "Intelligence";

  return <div style={styles.shell}>
    <aside style={styles.sidebar}>
      <button type="button" style={styles.brand} onClick={onBack}>ROYAL STAR OS</button>
      {navigation.map((item) => <button key={item.id} type="button" onClick={() => onNavigate?.(item.viewKey)} style={{ ...styles.nav, ...(item.viewKey === currentView ? styles.navActive : {}) }}>{item.icon} {item.label}</button>)}
    </aside>
    <main style={styles.main}>
      <div style={styles.header}><div><div style={styles.eyebrow}>ENTERPRISE INTELLIGENCE WORKSPACE</div><h1 style={styles.title}>{heading.toUpperCase()}</h1><div style={styles.status}>{status} • Advisory only • Approval required for changes</div></div>
        <select value={selectedDealId} onChange={(event) => setSelectedDealId(event.target.value)} style={styles.input} aria-label="Selected deal">{data.deals.length ? data.deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.propertyAddress || deal.address || deal.propertyName || "Saved deal"}</option>) : <option value="">No saved deals</option>}</select>
      </div>
      <div style={styles.tabs}>{workspaceTabs.map(([key, label]) => <button key={key} type="button" style={{ ...styles.tab, ...(key === currentView ? styles.tabActive : {}) }} onClick={() => onNavigate?.(key)}>{label}</button>)}</div>

      {currentView === "knowledgeBase" ? <div style={styles.grid}>
        <Card title="Knowledge summary"><p>{knowledge.summary}</p><p><strong>Next inquiry:</strong> {knowledge.recommendedNextInquiry}</p><p><strong>Confidence:</strong> {knowledge.confidence}</p></Card>
        <Card title="Knowledge records">{knowledge.entries.map((entry) => <div key={entry.id} style={styles.item}><strong>{entry.title}</strong><div>{entry.detail}</div><small>{entry.topic} • {entry.confidence}</small></div>)}</Card>
      </div> : null}

      {currentView === "enterpriseSearch" ? <Card title="Search saved RSOS records"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search addresses, deals, properties, contractors, lenders, or decisions" style={{ ...styles.input, width: "100%" }} />{query && !search.results.length ? <p>No matching saved records.</p> : search.results.map((result, index) => <button key={`${result.module}-${index}`} type="button" style={styles.result} onClick={() => onNavigate?.({ "Deal Analyzer": "dealAnalyzer", "Property Database": "propertyDatabase", "Contractor Hub": "contractorHub", "Lender Dashboard": "lenderDashboard", "Deal Intelligence": "dealIntelligence" }[result.module] || "dealIntelligence")}>{result.label}<span>{result.module}</span></button>)}</Card> : null}

      {currentView === "forecastingCenter" ? <div style={styles.grid}>
        <Card title="Executive forecast"><p>{forecast.executiveForecastSummary?.headline || "Insufficient saved assumptions for a forecast."}</p>{safeArray(forecast.executiveForecastSummary?.keySignals).map((signal) => <div key={signal} style={styles.item}>{signal}</div>)}</Card>
        <Card title="Portfolio value horizons">{safeArray(forecast.portfolioValueForecast).map((item, index) => <div key={item.label || index} style={styles.item}><strong>{item.label || `Forecast ${index + 1}`}</strong><div>{formatCurrency(item.projectedValue ?? item.value)}</div><small>Confidence: {item.confidenceScore ?? "Insufficient Data"}</small></div>)}</Card>
      </div> : null}

      {currentView === "reportingCenter" ? <Card title="Executive report preview">{reporting.sections.map((section) => <div key={section.title} style={styles.item}><strong>{section.title}</strong><div>{section.content}</div></div>)}<button type="button" style={styles.action} onClick={() => downloadJson("rsos-executive-report.json", reporting)}>DOWNLOAD REVIEW COPY</button></Card> : null}

      {currentView === "documentAutomation" ? <Card title="Document automation queue"><p>{documents.nextAction}</p>{documents.documents.map((document) => <div key={document.type} style={styles.item}><strong>{document.title}</strong><div>{document.status} • Owner: {document.owner}</div></div>)}<button type="button" style={styles.action} onClick={() => downloadJson("rsos-document-draft-package.json", { deal: selectedDeal, automation: documents })}>GENERATE DRAFT PACKAGE</button></Card> : null}

      {currentView === "aiCommandCenter" ? <div style={styles.grid}><Card title="Recommended command"><div style={styles.command}>{command.command}</div><p>{command.rationale}</p></Card><Card title="Governance"><div style={styles.item}><strong>Route</strong><div>{command.route}</div></div><div style={styles.item}><strong>Approval</strong><div>{command.approvalRequired}</div></div><div style={styles.item}><strong>Owner</strong><div>{command.recommendedOwner}</div></div><p style={styles.notice}>This command center uses RSOS deterministic advisory engines. It does not execute transactions or send data to an external AI model.</p></Card></div> : null}
    </main>
  </div>;
}

const styles = {
  shell: { minHeight: "100vh", display: "flex", background: "#070707", color: "#f4f4f4", fontFamily: "Arial, sans-serif" },
  sidebar: { width: "235px", padding: "20px 12px", borderRight: "1px solid #35311d", display: "flex", flexDirection: "column", gap: "5px" },
  brand: { color: "#f2c500", background: "transparent", border: 0, fontWeight: 800, fontSize: "18px", padding: "14px 10px", textAlign: "left", cursor: "pointer" },
  nav: { background: "transparent", border: 0, color: "#bbb", padding: "9px 10px", textAlign: "left", cursor: "pointer", fontSize: "12px" },
  navActive: { background: "#f2c500", color: "#080808", fontWeight: 800 }, main: { flex: 1, padding: "28px", minWidth: 0 },
  header: { display: "flex", justifyContent: "space-between", gap: "20px", alignItems: "center", flexWrap: "wrap" }, eyebrow: { color: "#f2c500", fontSize: "11px", letterSpacing: "2px" },
  title: { margin: "7px 0", fontSize: "30px" }, status: { color: "#aaa", fontSize: "12px" }, input: { background: "#111", border: "1px solid #665a20", color: "#fff", padding: "11px" },
  tabs: { display: "flex", flexWrap: "wrap", gap: "7px", margin: "24px 0" }, tab: { background: "#151515", border: "1px solid #444", color: "#ddd", padding: "10px 13px", cursor: "pointer" }, tabActive: { borderColor: "#f2c500", color: "#f2c500" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "16px" }, card: { background: "#101010", border: "1px solid #373737", padding: "20px", marginBottom: "16px" }, cardTitle: { color: "#f2c500", fontSize: "16px", marginTop: 0 },
  item: { borderTop: "1px solid #333", padding: "12px 0", lineHeight: 1.5 }, result: { width: "100%", display: "flex", justifyContent: "space-between", color: "#fff", background: "transparent", border: 0, borderBottom: "1px solid #333", padding: "14px 4px", cursor: "pointer" },
  action: { marginTop: "15px", background: "#f2c500", color: "#070707", border: 0, padding: "11px 15px", fontWeight: 800, cursor: "pointer" }, command: { color: "#f2c500", fontSize: "22px", fontWeight: 800 }, notice: { color: "#aaa", fontSize: "12px", lineHeight: 1.5 },
};
