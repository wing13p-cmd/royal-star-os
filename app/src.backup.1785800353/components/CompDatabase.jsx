import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";

const API_BASE_URL = "";

const navigation = [
  ["🏠", "COMMAND CENTER"],
  ["🔎", "DEAL ANALYZER"],
  ["📈", "FLIP ANALYZER"],
  ["💳", "BRRRR ANALYZER"],
  ["▣", "PRODUCT VAULT"],
  ["👥", "CONTRACTOR HUB"],
  ["🏘️", "COMP DATABASE"],
  ["📍", "NEIGHBORHOOD DB"],
  ["👥", "PORTFOLIO DASHBOARD"],
  ["🏦", "LENDER DASHBOARD"],
  ["📄", "APPRAISER PACKET BUILDER"],
  ["🗂️", "PROPERTY DATABASE"],
  ["🗃️", "VENDOR DATABASE"],
  ["▪", "MATERIAL MATRIX"],
];

const propertyTypes = ["Single Family", "Condo", "Townhome", "Multi-Family", "Land", "Other"];
const conditionOptions = ["Poor", "Fair", "Average", "Good", "Renovated", "New Construction"];
const qualityGrades = ["A", "B", "C", "D", "F"];
const includedFilterOptions = ["All", "Included", "Excluded"];
const sortOptions = [
  ["newestSale", "Newest Sale"],
  ["closestDistance", "Closest Distance"],
  ["highestQuality", "Highest Quality Score"],
  ["lowestQuality", "Lowest Quality Score"],
  ["pricePerSqft", "Price Per Square Foot"],
  ["salePrice", "Sale Price"],
];

const initialValues = {
  subjectProperty: "",
  compAddress: "",
  city: "",
  state: "",
  zipCode: "",
  salePrice: "",
  saleDate: "",
  listPrice: "",
  propertyType: "Single Family",
  bedrooms: "",
  bathrooms: "",
  squareFeet: "",
  yearBuilt: "",
  lotSize: "",
  distanceMiles: "",
  condition: "Average",
  garage: "",
  basement: "",
  source: "",
  sourceLink: "",
  notes: "",
  included: true,
};

function createId(prefix = "comp") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getDaysSinceSale(saleDate) {
  if (!saleDate) return null;
  const sale = new Date(saleDate);
  if (Number.isNaN(sale.getTime())) return null;
  const today = new Date();
  const diffMs = today.setHours(0, 0, 0, 0) - sale.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function getQualityGrade(score) {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  if (score >= 40) return "D";
  return "F";
}

function normalizeCompPayload(values) {
  return {
    subjectProperty: values.subjectProperty || "",
    compAddress: values.compAddress || "",
    city: values.city || "",
    state: values.state || "",
    zipCode: values.zipCode || "",
    salePrice: parseOptionalNumber(values.salePrice),
    saleDate: values.saleDate || "",
    listPrice: parseOptionalNumber(values.listPrice),
    propertyType: values.propertyType || "Single Family",
    bedrooms: parseOptionalNumber(values.bedrooms),
    bathrooms: parseOptionalNumber(values.bathrooms),
    squareFeet: parseOptionalNumber(values.squareFeet),
    yearBuilt: parseOptionalNumber(values.yearBuilt),
    lotSize: values.lotSize || "",
    distanceMiles: parseOptionalNumber(values.distanceMiles),
    condition: values.condition || "Average",
    garage: values.garage || "",
    basement: values.basement || "",
    source: values.source || "",
    sourceLink: values.sourceLink || "",
    notes: values.notes || "",
    included: Boolean(values.included !== false),
  };
}

function getConditionSimilarity(compCondition, subjectCondition) {
  const conditionRank = {
    Poor: 1,
    Fair: 2,
    Average: 3,
    Good: 4,
    Renovated: 5,
    "New Construction": 6,
  };

  if (!compCondition || !subjectCondition) return 0.5;
  const left = conditionRank[compCondition] || 3;
  const right = conditionRank[subjectCondition] || 3;
  const delta = Math.abs(left - right);
  const similarity = Math.max(0, 1 - delta / 6);
  return similarity;
}

function getValueSimilarity(compValue, subjectValue, fallback = 0.5) {
  if (compValue === "" || compValue === null || compValue === undefined || subjectValue === "" || subjectValue === null || subjectValue === undefined) {
    return fallback;
  }

  const left = Number(compValue);
  const right = Number(subjectValue);
  if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
    return fallback;
  }

  const ratio = Math.min(1, Math.max(0, 1 - Math.abs(left - right) / Math.max(right, 1)));
  return ratio;
}

function getBasicQualityScore(comp, subject) {
  const recencyDays = getDaysSinceSale(comp.saleDate) ?? 365;
  const recencyScore = Math.max(0, Math.min(1, 1 - recencyDays / 1800));
  const distanceScore = comp.distanceMiles ? Math.max(0, Math.min(1, 1 - comp.distanceMiles / 15)) : 0.65;
  const sqftScore = getValueSimilarity(comp.squareFeet, subject?.squareFeet ?? comp.squareFeet, 0.65);
  const bedroomScore = getValueSimilarity(comp.bedrooms, subject?.bedrooms, 0.65);
  const bathroomScore = getValueSimilarity(comp.bathrooms, subject?.bathrooms, 0.65);
  const yearBuiltScore = getValueSimilarity(comp.yearBuilt, subject?.yearBuilt, 0.65);
  const conditionScore = getConditionSimilarity(comp.condition, subject?.condition);

  const weightedScore =
    recencyScore * 0.18 +
    distanceScore * 0.2 +
    sqftScore * 0.18 +
    bedroomScore * 0.12 +
    bathroomScore * 0.12 +
    yearBuiltScore * 0.1 +
    conditionScore * 0.1;

  return Math.max(0, Math.min(100, weightedScore * 100));
}

function getArvConfidence(includedComps, avgPpsf, priceSpread) {
  const strongComps = includedComps.filter((comp) => comp.qualityScore >= 75).length;
  const recentSales = includedComps.filter((comp) => getDaysSinceSale(comp.saleDate) !== null && getDaysSinceSale(comp.saleDate) <= 365).length;
  const closeDistance = includedComps.filter((comp) => comp.distanceMiles !== "" && comp.distanceMiles <= 3).length;
  const consistentPricing = priceSpread <= 0.18;

  if (includedComps.length >= 3 && strongComps >= 3 && recentSales >= 2 && closeDistance >= 2 && consistentPricing) {
    return "High";
  }

  if (includedComps.length >= 2 && (strongComps >= 2 || recentSales >= 1) && closeDistance >= 1) {
    return "Medium";
  }

  return "Low";
}

function getArvRecommendation(estimateLow, estimateBase, estimateHigh, confidence) {
  if (confidence === "High") {
    return {
      conservative: estimateLow,
      base: estimateBase,
      aggressive: estimateHigh,
      recommended: estimateBase,
      explanation: "High confidence and a tight pricing spread support using the base ARV estimate.",
    };
  }

  if (confidence === "Medium") {
    return {
      conservative: estimateLow,
      base: estimateBase,
      aggressive: estimateHigh,
      recommended: estimateBase,
      explanation: "Moderate confidence keeps the underwriting ARV centered on the base estimate while avoiding the aggressive outcome.",
    };
  }

  return {
    conservative: estimateLow,
    base: estimateBase,
    aggressive: estimateHigh,
    recommended: estimateLow,
    explanation: "Low confidence calls for a conservative underwriting approach until more recent comps are available.",
    };
}

function getOutlierFlags(includedComps) {
  const salePrices = includedComps.map((comp) => toNumber(comp.salePrice)).filter((value) => value > 0);
  const pricePerSqft = includedComps.map((comp) => toNumber(comp.pricePerSqft)).filter((value) => value > 0);
  const avgSale = salePrices.length > 0 ? salePrices.reduce((sum, value) => sum + value, 0) / salePrices.length : 0;
  const avgPpsf = pricePerSqft.length > 0 ? pricePerSqft.reduce((sum, value) => sum + value, 0) / pricePerSqft.length : 0;
  const varianceSale = salePrices.length > 1 ? salePrices.reduce((sum, value) => sum + (value - avgSale) ** 2, 0) / salePrices.length : 0;
  const variancePpsf = pricePerSqft.length > 1 ? pricePerSqft.reduce((sum, value) => sum + (value - avgPpsf) ** 2, 0) / pricePerSqft.length : 0;
  const stdSale = Math.sqrt(varianceSale);
  const stdPpsf = Math.sqrt(variancePpsf);

  return includedComps.map((comp) => {
    const saleOutlier = stdSale > 0 && Math.abs(toNumber(comp.salePrice) - avgSale) > stdSale * 1.5;
    const ppsfOutlier = stdPpsf > 0 && Math.abs(toNumber(comp.pricePerSqft) - avgPpsf) > stdPpsf * 1.5;
    return { ...comp, saleOutlier, ppsfOutlier };
  });
}

export default function CompDatabase({
  onBack,
  onOpenDealIntake,
  onOpenDealAnalyzer,
  onOpenFlipAnalyzer,
  onOpenBrrrrAnalyzer,
  onOpenProductVault,
  onOpenContractorHub,
  onOpenDealIntelligence,
  onOpenCompDatabase,
}) {
  const [comps, setComps] = useState([]);
  const [deals, setDeals] = useState([]);
  const [selectedCompId, setSelectedCompId] = useState("");
  const [formValues, setFormValues] = useState(initialValues);
  const [searchText, setSearchText] = useState("");
  const [propertyTypeFilter, setPropertyTypeFilter] = useState("All");
  const [conditionFilter, setConditionFilter] = useState("All");
  const [zipFilter, setZipFilter] = useState("All");
  const [includeFilter, setIncludeFilter] = useState("All");
  const [gradeFilter, setGradeFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newestSale");
  const [subjectDealId, setSubjectDealId] = useState("");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const loadComps = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/comps"));
        if (!response.ok) throw new Error("Unable to fetch comps");
        const apiComps = await response.json();
        setComps(Array.isArray(apiComps) ? apiComps : []);
        setConnectionState("Backend Connected");
      } catch (error) {
        console.error("Unable to load comps from API, using localStorage fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const storedComps = JSON.parse(window.localStorage.getItem("royalStarComps") || "[]") || [];
            setComps(Array.isArray(storedComps) ? storedComps : []);
          } catch (localError) {
            console.error("Unable to read comps from localStorage", localError);
            setComps([]);
          }
        }
      }
    };

    const loadDeals = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/deals"));
        if (!response.ok) throw new Error("Unable to fetch deals");
        const apiDeals = await response.json();
        setDeals(Array.isArray(apiDeals) ? apiDeals : []);
      } catch (error) {
        console.error("Unable to load deals for subject selection", error);
        if (typeof window !== "undefined") {
          try {
            const storedDeals = JSON.parse(window.localStorage.getItem("royalStarDeals") || "[]") || [];
            setDeals(Array.isArray(storedDeals) ? storedDeals : []);
          } catch (localError) {
            console.error("Unable to read deals from localStorage", localError);
            setDeals([]);
          }
        }
      }
    };

    loadComps();
    loadDeals();
  }, []);

  const selectedSubjectDeal = useMemo(() => deals.find((deal) => deal.id === subjectDealId) || null, [deals, subjectDealId]);

  const normalizedComps = useMemo(() => {
    return comps.map((comp) => ({
      ...comp,
      salePrice: toNumber(comp.salePrice),
      listPrice: toNumber(comp.listPrice),
      bedrooms: toNumber(comp.bedrooms),
      bathrooms: toNumber(comp.bathrooms),
      squareFeet: toNumber(comp.squareFeet),
      yearBuilt: toNumber(comp.yearBuilt),
      distanceMiles: toNumber(comp.distanceMiles),
      pricePerSqft: toNumber(comp.squareFeet) > 0 ? toNumber(comp.salePrice) / toNumber(comp.squareFeet) : 0,
      qualityScore: getBasicQualityScore(comp, selectedSubjectDeal),
      grade: getQualityGrade(getBasicQualityScore(comp, selectedSubjectDeal)),
      daysSinceSale: getDaysSinceSale(comp.saleDate),
      priceDifference: selectedSubjectDeal?.salePrice ? toNumber(comp.salePrice) - toNumber(selectedSubjectDeal.salePrice) : null,
      sqFtDifference: selectedSubjectDeal?.squareFeet ? toNumber(comp.squareFeet) - toNumber(selectedSubjectDeal.squareFeet) : null,
      bedroomDifference: selectedSubjectDeal?.bedrooms ? toNumber(comp.bedrooms) - toNumber(selectedSubjectDeal.bedrooms) : null,
      bathroomDifference: selectedSubjectDeal?.bathrooms ? toNumber(comp.bathrooms) - toNumber(selectedSubjectDeal.bathrooms) : null,
      ageDifference: selectedSubjectDeal?.yearBuilt ? toNumber(comp.yearBuilt) - toNumber(selectedSubjectDeal.yearBuilt) : null,
    }));
  }, [comps, selectedSubjectDeal]);

  const filteredComps = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let items = [...normalizedComps];

    if (search) {
      items = items.filter((comp) => {
        const haystack = [comp.compAddress, comp.city, comp.zipCode, comp.source].filter(Boolean).join(" ").toLowerCase();
        return haystack.includes(search);
      });
    }

    if (propertyTypeFilter !== "All") items = items.filter((comp) => comp.propertyType === propertyTypeFilter);
    if (conditionFilter !== "All") items = items.filter((comp) => comp.condition === conditionFilter);
    if (zipFilter !== "All") items = items.filter((comp) => comp.zipCode === zipFilter);
    if (includeFilter === "Included") items = items.filter((comp) => comp.included !== false);
    if (includeFilter === "Excluded") items = items.filter((comp) => comp.included === false);
    if (gradeFilter !== "All") items = items.filter((comp) => comp.grade === gradeFilter);

    items.sort((left, right) => {
      switch (sortBy) {
        case "closestDistance":
          return toNumber(left.distanceMiles) - toNumber(right.distanceMiles);
        case "highestQuality":
          return right.qualityScore - left.qualityScore;
        case "lowestQuality":
          return left.qualityScore - right.qualityScore;
        case "pricePerSqft":
          return right.pricePerSqft - left.pricePerSqft;
        case "salePrice":
          return right.salePrice - left.salePrice;
        default:
          return (right.saleDate || "").localeCompare(left.saleDate || "");
      }
    });

    return items;
  }, [normalizedComps, searchText, propertyTypeFilter, conditionFilter, zipFilter, includeFilter, gradeFilter, sortBy]);

  const selectedComp = useMemo(() => filteredComps.find((comp) => comp.id === selectedCompId) || normalizedComps.find((comp) => comp.id === selectedCompId) || null, [filteredComps, normalizedComps, selectedCompId]);

  const summaryStats = useMemo(() => {
    const included = normalizedComps.filter((comp) => comp.included !== false);
    const averageSalePrice = included.length > 0 ? included.reduce((sum, comp) => sum + toNumber(comp.salePrice), 0) / included.length : 0;
    const averagePpsf = included.length > 0 ? included.reduce((sum, comp) => sum + toNumber(comp.pricePerSqft), 0) / included.length : 0;
    const subjectSqft = selectedSubjectDeal?.squareFeet ? toNumber(selectedSubjectDeal.squareFeet) : null;
    const baseArv = subjectSqft && averagePpsf > 0 ? averagePpsf * subjectSqft : averageSalePrice;
    const lowArv = subjectSqft && averagePpsf > 0 ? averagePpsf * subjectSqft * 0.95 : averageSalePrice * 0.9;
    const highArv = subjectSqft && averagePpsf > 0 ? averagePpsf * subjectSqft * 1.05 : averageSalePrice * 1.1;
    const priceSpread = averagePpsf > 0 ? (highArv - lowArv) / averagePpsf : 0;
    const confidence = getArvConfidence(included, averagePpsf, priceSpread);
    const recommendation = getArvRecommendation(lowArv, baseArv, highArv, confidence);
    const strongest = [...included].sort((left, right) => right.qualityScore - left.qualityScore)[0] || null;
    const recent = [...included].sort((left, right) => (right.saleDate || "").localeCompare(left.saleDate || ""))[0] || null;

    return {
      total: normalizedComps.length,
      included: included.length,
      averageSalePrice,
      averagePpsf,
      baseArv,
      confidence,
      recommendation,
      strongest,
      recent,
    };
  }, [normalizedComps, selectedSubjectDeal]);

  const outlierDetails = useMemo(() => getOutlierFlags(normalizedComps.filter((comp) => comp.included !== false)), [normalizedComps]);
  const selectedOutlier = useMemo(() => outlierDetails.find((comp) => comp.id === selectedCompId) || null, [outlierDetails, selectedCompId]);

  const propertyTypeOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedComps.map((comp) => comp.propertyType).filter(Boolean))).sort()], [normalizedComps]);
  const conditionOptionsList = useMemo(() => ["All", ...conditionOptions], []);
  const zipCodeOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedComps.map((comp) => comp.zipCode).filter(Boolean))).sort()], [normalizedComps]);
  const gradeOptions = useMemo(() => ["All", ...qualityGrades], []);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleSelectComp = (comp) => {
    setSelectedCompId(comp.id);
    setFormValues({ ...initialValues, ...comp, included: comp.included !== false });
    setMessage({ type: "", text: "" });
  };

  const handleClearForm = () => {
    setSelectedCompId("");
    setFormValues(initialValues);
    setMessage({ type: "", text: "" });
  };

  const persistComp = async (payload, existingComp = null) => {
    if (existingComp) {
      try {
        const response = await fetch(buildApiUrl(`/api/comps/${existingComp.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to update comp");
        return response.json();
      } catch (error) {
        console.error("Unable to update comp via API, using local fallback", error);
        return { ...payload, id: existingComp.id, createdAt: existingComp.createdAt, updatedAt: new Date().toISOString() };
      }
    }

    try {
      const response = await fetch(buildApiUrl("/api/comps"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to create comp");
      return response.json();
    } catch (error) {
      console.error("Unable to create comp via API, using local fallback", error);
      return { ...payload, id: createId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.compAddress.trim()) {
      setMessage({ type: "error", text: "Comp address is required." });
      return;
    }
    if (!formValues.salePrice || toNumber(formValues.salePrice) < 0) {
      setMessage({ type: "error", text: "Sale price is required and cannot be negative." });
      return;
    }
    if (!formValues.saleDate) {
      setMessage({ type: "error", text: "Sale date is required." });
      return;
    }
    if (!formValues.squareFeet || toNumber(formValues.squareFeet) < 0) {
      setMessage({ type: "error", text: "Square feet are required and cannot be negative." });
      return;
    }
    if (!formValues.source.trim()) {
      setMessage({ type: "error", text: "Source is required." });
      return;
    }

    const existingComp = comps.find((comp) => comp.id === selectedCompId);
    const normalizedPayload = normalizeCompPayload({ ...formValues, subjectProperty: selectedSubjectDeal?.propertyAddress || formValues.subjectProperty });
    const savedComp = await persistComp(normalizedPayload, existingComp);

    const nextComps = existingComp ? comps.map((comp) => (comp.id === existingComp.id ? { ...comp, ...savedComp, id: existingComp.id } : comp)) : [...comps, savedComp];
    setComps(nextComps);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
    }
    setSelectedCompId(savedComp.id);
    setFormValues({ ...initialValues, ...savedComp, included: savedComp.included !== false, subjectProperty: savedComp.subjectProperty || selectedSubjectDeal?.propertyAddress || "" });
    setMessage({ type: "success", text: existingComp ? "Comp updated successfully." : "Comp added successfully." });
  };

  const handleDeleteComp = async (compId) => {
    const target = comps.find((comp) => comp.id === compId);
    if (!target) return;

    try {
      const response = await fetch(buildApiUrl(`/api/comps/${compId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete comp");
      const nextComps = comps.filter((comp) => comp.id !== compId);
      setComps(nextComps);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
      }
      setSelectedCompId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Comp deleted successfully." });
    } catch (error) {
      console.error("Unable to delete comp via API, using local fallback", error);
      const nextComps = comps.filter((comp) => comp.id !== compId);
      setComps(nextComps);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
      }
      setSelectedCompId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Comp deleted successfully." });
    }
  };

  const handleToggleInclude = (compId) => {
    const nextComps = comps.map((comp) => (comp.id === compId ? { ...comp, included: comp.included === false } : comp));
    setComps(nextComps);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("royalStarComps", JSON.stringify(nextComps));
    }
  };

  const subjectFields = selectedSubjectDeal
    ? [
        ["Property", selectedSubjectDeal.propertyAddress || selectedSubjectDeal.address || "—"],
        ["City", selectedSubjectDeal.city || "—"],
        ["State", selectedSubjectDeal.state || "—"],
        ["ZIP", selectedSubjectDeal.zipCode || selectedSubjectDeal.zip || "—"],
        ["Square Feet", selectedSubjectDeal.squareFeet || "—"],
        ["Bedrooms", selectedSubjectDeal.bedrooms || "—"],
        ["Bathrooms", selectedSubjectDeal.bathrooms || "—"],
        ["Year Built", selectedSubjectDeal.yearBuilt || "—"],
      ]
    : [];

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>
        <nav style={styles.nav}>
          {navigation.map(([icon, label]) => {
            const isDealAnalyzer = label === "DEAL ANALYZER";
            const isFlipAnalyzer = label === "FLIP ANALYZER";
            const isBrrrrAnalyzer = label === "BRRRR ANALYZER";
            const isProductVault = label === "PRODUCT VAULT";
            const isContractorHub = label === "CONTRACTOR HUB";
            const isCompDatabase = label === "COMP DATABASE";
            return (
              <button
                key={label}
                type="button"
                style={styles.navButton}
                onClick={
                  isDealAnalyzer
                    ? onOpenDealAnalyzer
                    : isFlipAnalyzer
                      ? onOpenFlipAnalyzer
                      : isBrrrrAnalyzer
                        ? onOpenBrrrrAnalyzer
                        : isProductVault
                          ? onOpenProductVault
                          : isContractorHub
                            ? onOpenContractorHub
                            : isCompDatabase
                              ? onOpenCompDatabase
                              : undefined
                }
              >
                <span style={styles.navIcon}>{icon}</span>
                <span>{label}</span>
                <span style={styles.navTab} />
              </button>
            );
          })}
          <button type="button" style={styles.logout} onClick={onBack}>
            <span style={styles.navIcon}>↪</span>
            <span>COMMAND CENTER</span>
          </button>
        </nav>
        <div style={styles.smallMark}>RS★</div>
      </aside>

      <main style={styles.main}>
        <section style={styles.topBar}>
          <button type="button" style={styles.backButton} onClick={onBack}>◀ COMMAND CENTER</button>
          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>COMP DATABASE / COMPARABLE SALES</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenProductVault}>PRODUCT VAULT</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntake}>ADD NEW DEAL</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntelligence}>DEAL INTELLIGENCE</button>
            <button type="button" style={styles.primaryButton} onClick={onOpenContractorHub}>CONTRACTOR HUB</button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>COMP DATABASE</h2>
              <p style={styles.cardSubtitle}>Track visible comparable sales, quality scores, ARV logic, and include/exclude decisions.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard label="Total Comps" value={summaryStats.total} />
            <SummaryCard label="Included Comps" value={summaryStats.included} />
            <SummaryCard label="Average Sale Price" value={formatCurrency(summaryStats.averageSalePrice)} />
            <SummaryCard label="Average Price / Sq Ft" value={formatCurrency(summaryStats.averagePpsf)} />
            <SummaryCard label="Base ARV" value={formatCurrency(summaryStats.baseArv)} />
            <SummaryCard label="ARV Confidence" value={summaryStats.confidence} />
            <SummaryCard label="Strongest Comp" value={summaryStats.strongest ? `${summaryStats.strongest.compAddress} (${summaryStats.strongest.grade})` : "—"} />
            <SummaryCard label="Most Recent Sale" value={summaryStats.recent ? `${formatDate(summaryStats.recent.saleDate)} • ${formatCurrency(summaryStats.recent.salePrice)}` : "—"} />
          </div>

          <div style={styles.controlsRow}>
            <input type="text" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search address, city, ZIP, or source" style={styles.input} />
            <select value={propertyTypeFilter} onChange={(event) => setPropertyTypeFilter(event.target.value)} style={styles.select}>
              {propertyTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={conditionFilter} onChange={(event) => setConditionFilter(event.target.value)} style={styles.select}>
              {conditionOptionsList.map((option) => <option key={option} value={option}>{option === "All" ? "All Conditions" : option}</option>)}
            </select>
            <select value={zipFilter} onChange={(event) => setZipFilter(event.target.value)} style={styles.select}>
              {zipCodeOptions.map((option) => <option key={option} value={option}>{option === "All" ? "All ZIPs" : option}</option>)}
            </select>
            <select value={includeFilter} onChange={(event) => setIncludeFilter(event.target.value)} style={styles.select}>
              {includedFilterOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
            <select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} style={styles.select}>
              {gradeOptions.map((option) => <option key={option} value={option}>{option === "All" ? "All Grades" : option}</option>)}
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.select}>
              {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>

          {message.text ? <div style={message.type === "success" ? styles.successMessage : styles.errorMessage}>{message.text}</div> : null}

          <div style={styles.gridTwo}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>COMP FORM</h3>
              <div style={styles.formGrid}>
                <label style={styles.label}><span style={styles.fieldLabel}>Subject Deal</span><select name="subjectProperty" value={subjectDealId} onChange={(event) => setSubjectDealId(event.target.value)} style={styles.select}>{deals.length === 0 ? <option value="">No saved deals</option> : <><option value="">Select subject deal</option>{deals.map((deal) => <option key={deal.id} value={deal.id}>{deal.propertyAddress || deal.address || deal.id}</option>)}</>}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Comp Address</span><input type="text" name="compAddress" value={formValues.compAddress} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>City</span><input type="text" name="city" value={formValues.city} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>State</span><input type="text" name="state" value={formValues.state} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>ZIP Code</span><input type="text" name="zipCode" value={formValues.zipCode} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Sale Price</span><input type="number" min="0" name="salePrice" value={formValues.salePrice} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Sale Date</span><input type="date" name="saleDate" value={formValues.saleDate} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>List Price</span><input type="number" min="0" name="listPrice" value={formValues.listPrice} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Property Type</span><select name="propertyType" value={formValues.propertyType} onChange={handleFieldChange} style={styles.select}>{propertyTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Bedrooms</span><input type="number" min="0" name="bedrooms" value={formValues.bedrooms} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Bathrooms</span><input type="number" min="0" name="bathrooms" value={formValues.bathrooms} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Square Feet</span><input type="number" min="0" name="squareFeet" value={formValues.squareFeet} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Year Built</span><input type="number" min="1800" name="yearBuilt" value={formValues.yearBuilt} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Lot Size</span><input type="text" name="lotSize" value={formValues.lotSize} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Distance Miles</span><input type="number" min="0" name="distanceMiles" value={formValues.distanceMiles} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Condition</span><select name="condition" value={formValues.condition} onChange={handleFieldChange} style={styles.select}>{conditionOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Garage</span><input type="text" name="garage" value={formValues.garage} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Basement</span><input type="text" name="basement" value={formValues.basement} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Source</span><input type="text" name="source" value={formValues.source} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Source Link</span><input type="text" name="sourceLink" value={formValues.sourceLink} onChange={handleFieldChange} style={styles.input} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Notes</span><textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: "90px" }} /></label>
                <label style={styles.label}><span style={styles.fieldLabel}>Include in ARV</span><input type="checkbox" name="included" checked={formValues.included !== false} onChange={handleFieldChange} /></label>
              </div>
              <div style={styles.formActions}>
                <button type="button" style={styles.primaryButton} onClick={handleSubmit}>{selectedCompId ? "UPDATE COMP" : "ADD COMP"}</button>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>CLEAR FORM</button>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>SUBJECT PROPERTY</h3>
              {selectedSubjectDeal ? (
                <div>
                  <div style={styles.summaryLabel}>Selected subject property</div>
                  <div style={styles.summaryValue}>{selectedSubjectDeal.propertyAddress || selectedSubjectDeal.address || "Selected deal"}</div>
                  {subjectFields.map(([label, value]) => <div key={label} style={styles.detailRow}><span>{label}</span><span>{value}</span></div>)}
                </div>
              ) : (
                <div style={styles.emptyState}>Select a saved deal to prefill subject-property fields.</div>
              )}

              <div style={{ marginTop: "12px" }}>
                <h4 style={styles.sectionTitle}>ARV ANALYSIS</h4>
                <div style={styles.summaryGrid}>
                  <SummaryCard label="Average Sale Price" value={formatCurrency(summaryStats.averageSalePrice)} />
                  <SummaryCard label="Median Sale Price" value={formatCurrency([...filteredComps].filter((comp) => comp.included !== false).map((comp) => comp.salePrice).sort((left, right) => left - right)[Math.floor((filteredComps.filter((comp) => comp.included !== false).length - 1) / 2)] || 0)} />
                  <SummaryCard label="Average Price / Sq Ft" value={formatCurrency(summaryStats.averagePpsf)} />
                  <SummaryCard label="Median Price / Sq Ft" value={formatCurrency([...(filteredComps.filter((comp) => comp.included !== false).map((comp) => comp.pricePerSqft) || [])].sort((left, right) => left - right)[Math.floor((filteredComps.filter((comp) => comp.included !== false).length - 1) / 2)] || 0)} />
                  <SummaryCard label="Low ARV" value={formatCurrency(summaryStats.recommendation?.conservative || 0)} />
                  <SummaryCard label="Base ARV" value={formatCurrency(summaryStats.recommendation?.base || 0)} />
                  <SummaryCard label="High ARV" value={formatCurrency(summaryStats.recommendation?.aggressive || 0)} />
                </div>
                <div style={styles.recommendationBox}>
                  <div style={styles.summaryValue}>{formatCurrency(summaryStats.recommendation?.recommended || 0)}</div>
                  <div style={styles.summaryLabel}>{summaryStats.recommendation?.explanation || "No recommendation yet."}</div>
                </div>
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>COMPARABLE SALES</h3>
            {filteredComps.length === 0 ? (
              <div style={styles.emptyState}>
                No comparable sales available.
                <div style={{ marginTop: "8px" }}><button type="button" style={styles.primaryButton} onClick={handleClearForm}>Add Comp</button></div>
              </div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Include</th>
                      <th style={styles.th}>Address</th>
                      <th style={styles.th}>Sale Price</th>
                      <th style={styles.th}>Sale Date</th>
                      <th style={styles.th}>Distance</th>
                      <th style={styles.th}>Beds</th>
                      <th style={styles.th}>Baths</th>
                      <th style={styles.th}>Sq Ft</th>
                      <th style={styles.th}>Price / Sq Ft</th>
                      <th style={styles.th}>Year Built</th>
                      <th style={styles.th}>Condition</th>
                      <th style={styles.th}>Quality</th>
                      <th style={styles.th}>Grade</th>
                      <th style={styles.th}>Link</th>
                      <th style={styles.th}>View</th>
                      <th style={styles.th}>Edit</th>
                      <th style={styles.th}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComps.map((comp) => (
                      <tr key={comp.id}>
                        <td style={styles.td}><input type="checkbox" checked={comp.included !== false} onChange={() => handleToggleInclude(comp.id)} /></td>
                        <td style={styles.td}>{comp.compAddress}</td>
                        <td style={styles.td}>{formatCurrency(comp.salePrice)}</td>
                        <td style={styles.td}>{formatDate(comp.saleDate)}</td>
                        <td style={styles.td}>{comp.distanceMiles ? `${comp.distanceMiles} mi` : "—"}</td>
                        <td style={styles.td}>{comp.bedrooms || "—"}</td>
                        <td style={styles.td}>{comp.bathrooms || "—"}</td>
                        <td style={styles.td}>{comp.squareFeet || "—"}</td>
                        <td style={styles.td}>{formatCurrency(comp.pricePerSqft)}</td>
                        <td style={styles.td}>{comp.yearBuilt || "—"}</td>
                        <td style={styles.td}>{comp.condition}</td>
                        <td style={styles.td}>{comp.qualityScore.toFixed(1)}</td>
                        <td style={styles.td}>{comp.grade}</td>
                        <td style={styles.td}>{comp.sourceLink ? <a href={comp.sourceLink} target="_blank" rel="noreferrer" style={{ color: GOLD }}>Open</a> : "No Link"}</td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleSelectComp(comp)}>View</button></td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleSelectComp(comp)}>Edit</button></td>
                        <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleDeleteComp(comp.id)}>Delete</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selectedComp ? (
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>DETAIL PANEL</h3>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Address" value={selectedComp.compAddress} />
                <SummaryCard label="Sale Price" value={formatCurrency(selectedComp.salePrice)} />
                <SummaryCard label="Price / Sq Ft" value={formatCurrency(selectedComp.pricePerSqft)} />
                <SummaryCard label="Quality Score" value={`${selectedComp.qualityScore.toFixed(1)}/100`} />
                <SummaryCard label="Grade" value={selectedComp.grade} />
                <SummaryCard label="Status" value={selectedComp.included === false ? "Excluded" : "Included"} />
              </div>
              <div style={styles.recommendationBox}>
                <div style={styles.summaryValue}>{selectedComp.grade}</div>
                <div style={styles.summaryLabel}>Quality score explanation: Recency, distance, size similarity, year-built similarity, and condition similarity drove the score.</div>
              </div>
              <div style={styles.gridTwo}>
                <div>
                  <h4 style={styles.sectionTitle}>COMPARISON AGAINST SUBJECT</h4>
                  <div style={styles.detailRow}><span>Price Difference</span><span>{selectedComp.priceDifference !== null ? formatCurrency(selectedComp.priceDifference) : "—"}</span></div>
                  <div style={styles.detailRow}><span>Square-Footage Difference</span><span>{selectedComp.sqFtDifference !== null ? `${selectedComp.sqFtDifference} sq ft` : "—"}</span></div>
                  <div style={styles.detailRow}><span>Bedroom Difference</span><span>{selectedComp.bedroomDifference !== null ? selectedComp.bedroomDifference : "—"}</span></div>
                  <div style={styles.detailRow}><span>Bathroom Difference</span><span>{selectedComp.bathroomDifference !== null ? selectedComp.bathroomDifference : "—"}</span></div>
                  <div style={styles.detailRow}><span>Age Difference</span><span>{selectedComp.ageDifference !== null ? `${selectedComp.ageDifference} years` : "—"}</span></div>
                  <div style={styles.detailRow}><span>Distance Adjustment</span><span>{selectedComp.distanceMiles ? (selectedComp.distanceMiles <= 3 ? "Close" : selectedComp.distanceMiles <= 8 ? "Moderate" : "High") : "—"}</span></div>
                  <div style={styles.detailRow}><span>Condition Adjustment</span><span>{selectedComp.condition || "—"}</span></div>
                </div>
                <div>
                  <h4 style={styles.sectionTitle}>STRENGTHS / WEAKNESSES</h4>
                  <div style={styles.warningList}>
                    <div style={styles.warning}>Strengths: strong recency and fit to the selected subject property.</div>
                    <div style={styles.warning}>Weaknesses: large distance or condition difference may require an adjustment.</div>
                    {selectedOutlier?.saleOutlier || selectedOutlier?.ppsfOutlier ? <div style={styles.warning}>Outlier warning: this comp is outside the typical price or price-per-square-foot range.</div> : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const GOLD = "#f2c500";
const BLACK = "#050505";
const BORDER = "#c89f00";

const styles = {
  page: { minHeight: "100vh", width: "100%", display: "flex", overflow: "hidden", backgroundColor: BLACK, color: GOLD, fontFamily: "Arial, Helvetica, sans-serif", fontWeight: 700 },
  sidebar: { flex: "0 0 178px", minHeight: "100vh", padding: "18px 0 10px", boxSizing: "border-box", backgroundColor: BLACK, display: "flex", flexDirection: "column", position: "relative" },
  logoArea: { height: "114px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 15px 10px", boxSizing: "border-box" },
  logo: { display: "block", width: "135px", height: "104px", objectFit: "contain", backgroundColor: "#ffffff" },
  nav: { display: "flex", flexDirection: "column", gap: "1px", paddingRight: "14px" },
  navButton: { position: "relative", width: "100%", minHeight: "36px", padding: "7px 10px", border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", textAlign: "left", fontSize: "10px", fontWeight: 500, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  navIcon: { width: "18px", textAlign: "center", fontSize: "12px" },
  navTab: { position: "absolute", right: "-13px", top: "8px", width: "13px", height: "20px", backgroundColor: GOLD, border: `1px solid ${BORDER}`, boxSizing: "border-box" },
  logout: { width: "100%", minHeight: "34px", padding: "7px 10px", border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", textAlign: "left", fontSize: "10px", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" },
  smallMark: { marginTop: "8px", paddingLeft: "12px", fontFamily: "Georgia, serif", fontSize: "25px", color: GOLD },
  main: { flex: 1, minWidth: 0, padding: "20px 20px 18px", boxSizing: "border-box", backgroundColor: BLACK },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "16px" },
  backButton: { border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  headingBlock: { flex: 1, textAlign: "center" },
  company: { margin: 0, fontSize: "22px", letterSpacing: "1px" },
  subtitle: { margin: "4px 0 0", fontSize: "12px", letterSpacing: "1.4px", color: "#f9e27b" },
  headerActions: { display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" },
  primaryButton: { border: `1px solid ${BORDER}`, background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)", color: "#17120a", padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  secondaryButton: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "10px 14px", fontWeight: 700, cursor: "pointer" },
  card: { border: `1px solid ${BORDER}`, background: "#0b0b0b", padding: "16px", boxSizing: "border-box" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", marginBottom: "10px" },
  cardTitle: { margin: 0, fontSize: "20px", color: GOLD },
  cardSubtitle: { margin: "4px 0 0", fontSize: "12px", color: "#f9e27b" },
  connectionBadge: { border: `1px solid ${BORDER}`, padding: "8px 10px", fontSize: "12px", color: GOLD, background: "#111111" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px", marginBottom: "12px" },
  summaryCard: { border: `1px solid ${BORDER}`, background: "#111111", padding: "10px", boxSizing: "border-box" },
  summaryLabel: { fontSize: "11px", textTransform: "uppercase", color: "#f9e27b", marginBottom: "6px" },
  summaryValue: { fontSize: "16px", color: GOLD, fontWeight: 700 },
  controlsRow: { display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "12px" },
  input: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "8px 10px", fontSize: "12px", minWidth: "120px", boxSizing: "border-box" },
  select: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "8px 10px", fontSize: "12px", minWidth: "140px" },
  gridTwo: { display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "12px", marginBottom: "12px" },
  section: { border: `1px solid ${BORDER}`, background: "#111111", padding: "12px", boxSizing: "border-box" },
  sectionTitle: { margin: "0 0 10px", fontSize: "15px", color: GOLD },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: "10px" },
  label: { display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#f9e27b" },
  fieldLabel: { fontSize: "11px", textTransform: "uppercase" },
  formActions: { display: "flex", gap: "10px", marginTop: "12px" },
  successMessage: { border: "1px solid #4caf50", color: "#4caf50", padding: "8px 10px", marginBottom: "10px", fontSize: "12px" },
  errorMessage: { border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "8px 10px", marginBottom: "10px", fontSize: "12px" },
  emptyState: { border: `1px dashed ${BORDER}`, padding: "14px", color: "#f9e27b", fontSize: "12px", background: "#0c0c0c" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "12px" },
  th: { textAlign: "left", padding: "8px 6px", borderBottom: `1px solid ${BORDER}`, color: GOLD, textTransform: "uppercase" },
  td: { padding: "8px 6px", borderBottom: "1px solid #2a2400", verticalAlign: "top" },
  tableButton: { border: `1px solid ${BORDER}`, background: "#111111", color: GOLD, padding: "6px 8px", cursor: "pointer" },
  recommendationBox: { border: `1px solid ${BORDER}`, background: "#0c0c0c", padding: "12px", marginBottom: "10px" },
  warningList: { display: "flex", flexDirection: "column", gap: "8px" },
  warning: { border: "1px solid #ff6b6b", color: "#ff6b6b", padding: "8px 10px", fontSize: "12px" },
  detailRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #2a2400", fontSize: "12px" },
};
