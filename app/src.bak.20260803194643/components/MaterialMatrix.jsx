import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";

const API_BASE_URL = "";

const initialValues = {
  id: "",
  materialName: "",
  category: "General Materials",
  unit: "LF",
  estimatedQty: "",
  unitCost: "",
  totalCost: "",
  supplier: "",
  propertyId: "",
  propertyName: "",
  projectStage: "Planning",
  priority: "Medium",
  sourceProductId: "",
  leadTimeDays: "",
  warrantyMonths: "",
  wasteFactor: "",
  favorite: false,
  notes: "",
  createdAt: "",
  updatedAt: "",
};

const categories = ["General Materials", "Flooring", "Kitchen", "Bathroom", "Roofing", "Windows", "Doors", "Electrical", "Plumbing", "HVAC", "Drywall", "Paint", "Concrete", "Landscape", "Appliances", "Security", "Tools", "Other"];
const units = ["EA", "LF", "SF", "SY", "CY", "BX", "GAL", "EA", "Bundle", "Roll", "Ton", "Each", "Set"];
const stageOptions = ["Planning", "Budgeting", "In Progress", "Completed"];
const priorityOptions = ["Low", "Medium", "High", "Critical"];
const favoriteOptions = ["All", "Favorites Only"];
const sortOptions = [
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["highestCost", "Highest Cost"],
  ["lowestCost", "Lowest Cost"],
  ["name", "Material Name"],
  ["supplier", "Supplier"],
];

function createId(prefix = "material") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getStringValue(source, fallback = "") {
  const value = source ?? fallback;
  return typeof value === "string" ? value : "";
}

function parseNumber(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function formatCurrency(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "Insufficient Data";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value));
}

function formatNumber(value) {
  if (value === "" || value === null || value === undefined || !Number.isFinite(Number(value))) return "Insufficient Data";
  return Number(value).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function normalizeMaterialPayload(values) {
  const estimatedQty = parseNumber(values.estimatedQty);
  const unitCost = parseNumber(values.unitCost);
  const totalCost = parseNumber(values.totalCost);
  const derivedTotal = estimatedQty !== "" && unitCost !== "" ? estimatedQty * unitCost : totalCost;

  return {
    id: getStringValue(values.id),
    materialName: getStringValue(values.materialName),
    category: getStringValue(values.category, "General Materials"),
    unit: getStringValue(values.unit, "EA"),
    estimatedQty,
    unitCost,
    totalCost: derivedTotal !== "" ? derivedTotal : totalCost,
    supplier: getStringValue(values.supplier),
    propertyId: getStringValue(values.propertyId),
    propertyName: getStringValue(values.propertyName),
    projectStage: getStringValue(values.projectStage, "Planning"),
    priority: getStringValue(values.priority, "Medium"),
    sourceProductId: getStringValue(values.sourceProductId),
    leadTimeDays: parseNumber(values.leadTimeDays),
    warrantyMonths: parseNumber(values.warrantyMonths),
    wasteFactor: parseNumber(values.wasteFactor),
    favorite: Boolean(values.favorite),
    notes: getStringValue(values.notes),
    createdAt: getStringValue(values.createdAt),
    updatedAt: getStringValue(values.updatedAt),
  };
}

function validateMaterial(values) {
  const errors = [];
  if (!values.materialName?.trim()) errors.push("Material name is required.");
  if (!values.category?.trim()) errors.push("Category is required.");
  if (!values.unit?.trim()) errors.push("Unit is required.");
  if (!values.supplier?.trim()) errors.push("Supplier is required.");
  if (values.estimatedQty !== "" && values.estimatedQty < 0) errors.push("Estimated quantity cannot be negative.");
  if (values.unitCost !== "" && values.unitCost < 0) errors.push("Unit cost cannot be negative.");
  if (values.totalCost !== "" && values.totalCost < 0) errors.push("Total cost cannot be negative.");
  return errors;
}

function readLocalJson(key, fallback = []) {
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error(`Unable to read local storage for ${key}`, error);
    return fallback;
  }
}

export default function MaterialMatrix({ onBack, onOpenDealAnalyzer, onOpenFlipAnalyzer, onOpenBrrrrAnalyzer, onOpenProductVault, onOpenContractorHub, onOpenCompDatabase, onOpenDealIntelligence, onOpenNeighborhoodDatabase, onOpenPortfolioDashboard, onOpenPropertyDatabase, onOpenVendorDatabase }) {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [properties, setProperties] = useState([]);
  const [formValues, setFormValues] = useState(initialValues);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedDetailId, setSelectedDetailId] = useState("");
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stageFilter, setStageFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [favoriteFilter, setFavoriteFilter] = useState("All");
  const [sortBy, setSortBy] = useState("newest");
  const [statusMessage, setStatusMessage] = useState("Material Matrix ready.");
  const [errorMessage, setErrorMessage] = useState("");
  const [comparisonIds, setComparisonIds] = useState([]);

  useEffect(() => {
    const loadMaterials = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/materials"));
        if (!response.ok) throw new Error("Unable to load materials");
        const payload = await response.json();
        const nextMaterials = Array.isArray(payload) ? payload : [];
        setMaterials(nextMaterials);
        if (nextMaterials.length > 0) {
          setSelectedMaterialId(nextMaterials[0].id);
          setSelectedDetailId(nextMaterials[0].id);
        }
      } catch (error) {
        console.error("Unable to load materials from API, using localStorage fallback", error);
        const stored = readLocalJson("royalStarMaterials", []);
        setMaterials(Array.isArray(stored) ? stored : []);
        if (stored.length > 0) {
          setSelectedMaterialId(stored[0].id);
          setSelectedDetailId(stored[0].id);
        }
      }
    };

    const loadProducts = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/products"));
        if (!response.ok) throw new Error("Unable to load products");
        const payload = await response.json();
        setProducts(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Unable to load products", error);
        setProducts(readLocalJson("royalStarProducts", []));
      }
    };

    const loadVendors = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/vendors"));
        if (!response.ok) throw new Error("Unable to load vendors");
        const payload = await response.json();
        setVendors(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Unable to load vendors", error);
        setVendors(readLocalJson("royalStarVendors", []));
      }
    };

    const loadProperties = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/properties"));
        if (!response.ok) throw new Error("Unable to load properties");
        const payload = await response.json();
        setProperties(Array.isArray(payload) ? payload : []);
      } catch (error) {
        console.error("Unable to load properties", error);
        setProperties(readLocalJson("royalStarProperties", []));
      }
    };

    loadMaterials();
    loadProducts();
    loadVendors();
    loadProperties();
  }, []);

  const normalizedMaterials = useMemo(() => {
    return materials.map((material) => ({
      ...material,
      totalCost: material.totalCost ?? (Number(material.estimatedQty || 0) * Number(material.unitCost || 0)),
    }));
  }, [materials]);

  const filteredMaterials = useMemo(() => {
    let items = [...normalizedMaterials];
    const search = searchText.trim().toLowerCase();

    if (search) {
      items = items.filter((material) => [material.materialName, material.supplier, material.propertyName, material.category].filter(Boolean).join(" ").toLowerCase().includes(search));
    }

    if (categoryFilter !== "All") {
      items = items.filter((material) => material.category === categoryFilter);
    }

    if (stageFilter !== "All") {
      items = items.filter((material) => material.projectStage === stageFilter);
    }

    if (priorityFilter !== "All") {
      items = items.filter((material) => material.priority === priorityFilter);
    }

    if (favoriteFilter === "Favorites Only") {
      items = items.filter((material) => Boolean(material.favorite));
    }

    items.sort((left, right) => {
      switch (sortBy) {
        case "highestCost":
          return Number(right.totalCost || 0) - Number(left.totalCost || 0);
        case "lowestCost":
          return Number(left.totalCost || 0) - Number(right.totalCost || 0);
        case "name":
          return (left.materialName || "").localeCompare(right.materialName || "");
        case "supplier":
          return (left.supplier || "").localeCompare(right.supplier || "");
        case "oldest":
          return (left.createdAt || "").localeCompare(right.createdAt || "");
        case "newest":
        default:
          return (right.createdAt || "").localeCompare(left.createdAt || "");
      }
    });

    return items;
  }, [categoryFilter, favoriteFilter, normalizedMaterials, priorityFilter, searchText, sortBy, stageFilter]);

  const selectedMaterial = useMemo(() => normalizedMaterials.find((material) => material.id === selectedMaterialId) || null, [normalizedMaterials, selectedMaterialId]);
  const detailMaterial = useMemo(() => normalizedMaterials.find((material) => material.id === selectedDetailId) || null, [normalizedMaterials, selectedDetailId]);
  const comparisonItems = useMemo(() => normalizedMaterials.filter((material) => comparisonIds.includes(material.id)), [comparisonIds, normalizedMaterials]);

  const summaryStats = useMemo(() => {
    const totalBudget = normalizedMaterials.reduce((sum, material) => sum + Number(material.totalCost || 0), 0);
    const favoriteCount = normalizedMaterials.filter((material) => Boolean(material.favorite)).length;
    const highPriorityCount = normalizedMaterials.filter((material) => material.priority === "High" || material.priority === "Critical").length;
    const costlier = [...normalizedMaterials].sort((left, right) => Number(right.totalCost || 0) - Number(left.totalCost || 0))[0] || null;
    return {
      totalBudget,
      favoriteCount,
      highPriorityCount,
      count: normalizedMaterials.length,
      costlier,
    };
  }, [normalizedMaterials]);

  const categoryOptions = useMemo(() => ["All", ...Array.from(new Set(normalizedMaterials.map((material) => material.category).filter(Boolean))).sort()], [normalizedMaterials]);
  const stageOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedMaterials.map((material) => material.projectStage).filter(Boolean))).sort()], [normalizedMaterials]);
  const priorityOptionsList = useMemo(() => ["All", ...Array.from(new Set(normalizedMaterials.map((material) => material.priority).filter(Boolean))).sort()], [normalizedMaterials]);

  const handleInputChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSelectProduct = (event) => {
    const selectedProductId = event.target.value;
    const selectedProduct = products.find((product) => product.id === selectedProductId);
    if (!selectedProduct) return;

    setFormValues((current) => ({
      ...current,
      sourceProductId: selectedProductId,
      materialName: current.materialName || selectedProduct.productName || selectedProduct.name || "",
      category: current.category || selectedProduct.category || "General Materials",
      supplier: current.supplier || selectedProduct.vendor || "",
      unitCost: current.unitCost === "" ? selectedProduct.currentPrice ?? "" : current.unitCost,
      notes: current.notes || selectedProduct.notes || "",
    }));
  };

  const handleSelectProperty = (event) => {
    const propertyId = event.target.value;
    const selectedProperty = properties.find((property) => property.id === propertyId);
    if (!selectedProperty) return;

    setFormValues((current) => ({
      ...current,
      propertyId,
      propertyName: selectedProperty.propertyName || selectedProperty.address || current.propertyName,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalized = normalizeMaterialPayload(formValues);
    const errors = validateMaterial(normalized);
    if (errors.length > 0) {
      setErrorMessage(errors.join(" • "));
      setStatusMessage("Please correct the highlighted fields.");
      return;
    }

    setErrorMessage("");
    const now = new Date().toISOString();
    const payload = {
      ...normalized,
      id: normalized.id || createId(),
      createdAt: normalized.createdAt || now,
      updatedAt: now,
    };

    const existingMaterial = materials.find((material) => material.id === payload.id);
    const nextMaterials = existingMaterial
      ? materials.map((material) => (material.id === payload.id ? payload : material))
      : [...materials, payload];

    setMaterials(nextMaterials);
    setSelectedMaterialId(payload.id);
    setSelectedDetailId(payload.id);
    window.localStorage.setItem("royalStarMaterials", JSON.stringify(nextMaterials));

    try {
      const response = await fetch(buildApiUrl(`/api/materials${payload.id && existingMaterial ? `/${payload.id}` : ""}`), {
        method: payload.id && existingMaterial ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to save material");
      const saved = await response.json();
      const syncedMaterials = existingMaterial
        ? nextMaterials.map((material) => (material.id === saved.id ? saved : material))
        : [...nextMaterials.filter((material) => material.id !== payload.id), saved];
      setMaterials(syncedMaterials);
      setSelectedMaterialId(saved.id);
      setSelectedDetailId(saved.id);
      window.localStorage.setItem("royalStarMaterials", JSON.stringify(syncedMaterials));
      setStatusMessage(existingMaterial ? "Material updated and saved." : "Material saved to the matrix.");
      setFormValues(initialValues);
    } catch (error) {
      console.error("Unable to save material via API, using local fallback", error);
      setStatusMessage(existingMaterial ? "Material updated locally." : "Material saved locally.");
      setFormValues(initialValues);
    }
  };

  const handleEdit = (material) => {
    setFormValues({
      ...initialValues,
      ...material,
    });
    setSelectedMaterialId(material.id);
    setSelectedDetailId(material.id);
    setStatusMessage(`Editing ${material.materialName}.`);
  };

  const handleDelete = async (materialId) => {
    if (!window.confirm("Remove this material from the matrix?")) return;

    const nextMaterials = materials.filter((material) => material.id !== materialId);
    setMaterials(nextMaterials);
    window.localStorage.setItem("royalStarMaterials", JSON.stringify(nextMaterials));

    try {
      const response = await fetch(buildApiUrl(`/api/materials/${materialId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete material");
      setStatusMessage("Material removed.");
    } catch (error) {
      console.error("Unable to delete material via API", error);
      setStatusMessage("Material removed locally.");
    }

    if (selectedMaterialId === materialId) {
      setSelectedMaterialId(nextMaterials[0]?.id || "");
      setSelectedDetailId(nextMaterials[0]?.id || "");
    }
  };

  const handleToggleFavorite = async (materialId) => {
    const target = materials.find((material) => material.id === materialId);
    if (!target) return;

    const nextMaterials = materials.map((material) => (material.id === materialId ? { ...material, favorite: !material.favorite } : material));
    setMaterials(nextMaterials);
    window.localStorage.setItem("royalStarMaterials", JSON.stringify(nextMaterials));

    try {
      const response = await fetch(buildApiUrl(`/api/materials/${materialId}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...target, favorite: !target.favorite }),
      });
      if (!response.ok) throw new Error("Unable to update favorite");
    } catch (error) {
      console.error("Unable to update favorite via API", error);
    }
  };

  const handleCompareToggle = (materialId) => {
    setComparisonIds((current) => (current.includes(materialId) ? current.filter((id) => id !== materialId) : current.length >= 3 ? current : [...current, materialId]));
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    const rows = filteredMaterials.map((material) => ({
      name: material.materialName,
      category: material.category,
      supplier: material.supplier,
      property: material.propertyName,
      quantity: material.estimatedQty,
      unitCost: material.unitCost,
      totalCost: material.totalCost,
      priority: material.priority,
      stage: material.projectStage,
    }));
    const header = ["name", "category", "supplier", "property", "quantity", "unitCost", "totalCost", "priority", "stage"];
    const csv = [header.join(",")].concat(rows.map((row) => header.map((field) => `"${String(row[field] ?? "").replace(/"/g, '""')}"`).join(","))).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "royal-star-material-matrix.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Matrix export generated.");
  };

  return (
    <div style={styles.page}>
      <aside style={styles.sidebar}>
        <div style={styles.logoArea}>
          <img src={logo} alt="Royal Star Properties" style={styles.logo} />
        </div>
        <div style={styles.sidebarCard}>
          <div style={styles.kicker}>MATERIAL COMMAND</div>
          <button type="button" style={styles.backButton} onClick={onBack}>← BACK TO DASHBOARD</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>DEAL ANALYZER</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenFlipAnalyzer}>FLIP ANALYZER</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenBrrrrAnalyzer}>BRRRR ANALYZER</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenProductVault}>PRODUCT VAULT</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenContractorHub}>CONTRACTOR HUB</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenCompDatabase}>COMP DATABASE</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenNeighborhoodDatabase}>NEIGHBORHOOD DB</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenPortfolioDashboard}>PORTFOLIO DASHBOARD</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenPropertyDatabase}>PROPERTY DATABASE</button>
          <button type="button" style={styles.secondaryButton} onClick={onOpenVendorDatabase}>VENDOR DATABASE</button>
        </div>
      </aside>

      <main style={styles.main}>
        <section style={styles.headerBar}>
          <div>
            <div style={styles.kicker}>ROYAL STAR OPERATING SYSTEM</div>
            <h1 style={styles.title}>MATERIAL MATRIX</h1>
            <p style={styles.subtitle}>Track material spend, vendor links, project risk, and import-ready sourcing data.</p>
          </div>
          <div style={styles.headerActions}>
            <button type="button" style={styles.ghostButton} onClick={handleRefresh}>REFRESH</button>
            <button type="button" style={styles.actionButton} onClick={handleExport}>EXPORT CSV</button>
          </div>
        </section>

        <section style={styles.summaryGrid}>
          <SummaryCard label="Tracked Items" value={summaryStats.count} accent="#f2c500" />
          <SummaryCard label="Budgeted Spend" value={formatCurrency(summaryStats.totalBudget)} accent="#f2c500" />
          <SummaryCard label="Favorites" value={summaryStats.favoriteCount} accent="#c89f00" />
          <SummaryCard label="High Priority" value={summaryStats.highPriorityCount} accent="#ff8c00" />
        </section>

        <section style={styles.contentGrid}>
          <div style={styles.leftColumn}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <h2 style={styles.panelTitle}>ENTRY FORM</h2>
                <span style={styles.muted}>{statusMessage}</span>
              </div>
              <form onSubmit={handleSubmit} style={styles.formGrid}>
                <label style={styles.label}>Material Name
                  <input name="materialName" value={formValues.materialName} onChange={handleInputChange} style={styles.input} placeholder="e.g. LVP Flooring" />
                </label>
                <label style={styles.label}>Category
                  <select name="category" value={formValues.category} onChange={handleInputChange} style={styles.input}>
                    {categories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <label style={styles.label}>Unit
                  <select name="unit" value={formValues.unit} onChange={handleInputChange} style={styles.input}>
                    {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </label>
                <label style={styles.label}>Estimated Qty
                  <input name="estimatedQty" type="number" value={formValues.estimatedQty} onChange={handleInputChange} style={styles.input} />
                </label>
                <label style={styles.label}>Unit Cost
                  <input name="unitCost" type="number" value={formValues.unitCost} onChange={handleInputChange} style={styles.input} />
                </label>
                <label style={styles.label}>Supplier
                  <input name="supplier" value={formValues.supplier} onChange={handleInputChange} style={styles.input} placeholder="Vendor or supplier" />
                </label>
                <label style={styles.label}>Project Stage
                  <select name="projectStage" value={formValues.projectStage} onChange={handleInputChange} style={styles.input}>
                    {stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                  </select>
                </label>
                <label style={styles.label}>Priority
                  <select name="priority" value={formValues.priority} onChange={handleInputChange} style={styles.input}>
                    {priorityOptions.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                <label style={styles.label}>Property Link
                  <select value={formValues.propertyId} onChange={handleSelectProperty} style={styles.input}>
                    <option value="">Select property</option>
                    {properties.map((property) => <option key={property.id} value={property.id}>{property.propertyName || property.address}</option>)}
                  </select>
                </label>
                <label style={styles.label}>Product Vault Link
                  <select value={formValues.sourceProductId} onChange={handleSelectProduct} style={styles.input}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.productName || product.name || product.id}</option>)}
                  </select>
                </label>
                <label style={styles.label}>Lead Time (Days)
                  <input name="leadTimeDays" type="number" value={formValues.leadTimeDays} onChange={handleInputChange} style={styles.input} />
                </label>
                <label style={styles.label}>Warranty (Months)
                  <input name="warrantyMonths" type="number" value={formValues.warrantyMonths} onChange={handleInputChange} style={styles.input} />
                </label>
                <label style={styles.label}>Waste Factor (%)
                  <input name="wasteFactor" type="number" value={formValues.wasteFactor} onChange={handleInputChange} style={styles.input} />
                </label>
                <label style={styles.label}>Notes
                  <textarea name="notes" value={formValues.notes} onChange={handleInputChange} style={{ ...styles.input, minHeight: 96 }} />
                </label>
                <label style={styles.checkboxRow}>
                  <input name="favorite" type="checkbox" checked={Boolean(formValues.favorite)} onChange={handleInputChange} />
                  <span>Favorite this material</span>
                </label>
                {errorMessage ? <div style={styles.errorText}>{errorMessage}</div> : null}
                <div style={styles.actionsRow}>
                  <button type="submit" style={styles.actionButton}>SAVE MATERIAL</button>
                  <button type="button" style={styles.ghostButton} onClick={() => setFormValues(initialValues)}>RESET</button>
                </div>
              </form>
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <h2 style={styles.panelTitle}>FILTERS & MATERIAL LIST</h2>
                <span style={styles.muted}>{filteredMaterials.length} visible</span>
              </div>
              <div style={styles.filterRow}>
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} style={styles.input} placeholder="Search by name, supplier, or property" />
                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={styles.input}>
                  {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
                </select>
                <select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} style={styles.input}>
                  {stageOptionsList.map((stage) => <option key={stage} value={stage}>{stage}</option>)}
                </select>
                <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} style={styles.input}>
                  {priorityOptionsList.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                </select>
                <select value={favoriteFilter} onChange={(event) => setFavoriteFilter(event.target.value)} style={styles.input}>
                  {favoriteOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.input}>
                  {sortOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div style={styles.materialList}>
                {filteredMaterials.length === 0 ? <div style={styles.emptyState}>No materials match the current filters.</div> : filteredMaterials.map((material) => (
                  <article key={material.id} style={{ ...styles.materialCard, borderColor: selectedMaterialId === material.id ? "#f2c500" : "#3b2b00" }}>
                    <div style={styles.materialHeader}>
                      <button type="button" style={styles.materialTitleButton} onClick={() => { setSelectedMaterialId(material.id); setSelectedDetailId(material.id); }}>
                        <strong>{material.materialName}</strong>
                      </button>
                      <button type="button" style={styles.favoriteButton} onClick={() => handleToggleFavorite(material.id)}>
                        {material.favorite ? "★" : "☆"}
                      </button>
                    </div>
                    <div style={styles.materialMeta}>{material.category} • {material.supplier}</div>
                    <div style={styles.materialMeta}>Qty {formatNumber(material.estimatedQty)} {material.unit} • Budget {formatCurrency(material.totalCost)}</div>
                    <div style={styles.materialMeta}>Stage {material.projectStage} • Priority {material.priority}</div>
                    <div style={styles.cardActions}>
                      <button type="button" style={styles.ghostButton} onClick={() => handleEdit(material)}>EDIT</button>
                      <button type="button" style={styles.ghostButton} onClick={() => handleCompareToggle(material.id)}>COMPARE</button>
                      <button type="button" style={styles.ghostButton} onClick={() => handleDelete(material.id)}>DELETE</button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.rightColumn}>
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <h2 style={styles.panelTitle}>DETAIL VIEW</h2>
                <span style={styles.muted}>{detailMaterial ? detailMaterial.materialName : "Select a material"}</span>
              </div>
              {detailMaterial ? (
                <div style={styles.detailCard}>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Material</span><strong>{detailMaterial.materialName}</strong></div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Category</span>{detailMaterial.category}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Supplier</span>{detailMaterial.supplier}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Property</span>{detailMaterial.propertyName || "Unassigned"}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Estimated Qty</span>{formatNumber(detailMaterial.estimatedQty)} {detailMaterial.unit}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Unit Cost</span>{formatCurrency(detailMaterial.unitCost)}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Total Cost</span>{formatCurrency(detailMaterial.totalCost)}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Lead Time</span>{detailMaterial.leadTimeDays ? `${detailMaterial.leadTimeDays} days` : "—"}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Waste Factor</span>{detailMaterial.wasteFactor ? `${detailMaterial.wasteFactor}%` : "—"}</div>
                  <div style={styles.detailRow}><span style={styles.detailLabel}>Updated</span>{formatDate(detailMaterial.updatedAt)}</div>
                  <div style={styles.detailNotes}>{detailMaterial.notes || "No notes recorded yet."}</div>
                  <div style={styles.warningBox}>
                    {Number(detailMaterial.totalCost || 0) > 1500 ? "Budget risk: spend exceeds the $1.5k threshold." : "Spend is tracking within the planned range."}
                    {detailMaterial.priority === "Critical" ? " • Critical priority review recommended." : ""}
                  </div>
                </div>
              ) : <div style={styles.emptyState}>Choose a material to inspect the full record.</div>}
            </div>

            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <h2 style={styles.panelTitle}>COMPARE SNAPSHOT</h2>
                <span style={styles.muted}>{comparisonItems.length}/3 selected</span>
              </div>
              {comparisonItems.length === 0 ? <div style={styles.emptyState}>Select up to three items for side-by-side comparison.</div> : (
                <div style={styles.compareList}>
                  {comparisonItems.map((material) => (
                    <div key={material.id} style={styles.compareRow}>
                      <strong>{material.materialName}</strong>
                      <span>{formatCurrency(material.totalCost)}</span>
                      <span>{material.priority}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, accent }) {
  return (
    <div style={{ ...styles.summaryCard, borderColor: accent }}>
      <div style={styles.summaryLabel}>{label}</div>
      <div style={styles.summaryValue}>{value}</div>
    </div>
  );
}

const GOLD = "#f2c500";
const BLACK = "#050505";
const BORDER = "#c89f00";
const PANEL = "#121212";

const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    backgroundColor: BLACK,
    color: "#f4f3ed",
    fontFamily: "Inter, Arial, sans-serif",
  },
  sidebar: {
    width: 280,
    padding: 24,
    borderRight: `1px solid ${BORDER}`,
    background: "linear-gradient(180deg, rgba(242,197,0,0.09), rgba(5,5,5,0.94))",
  },
  logoArea: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 24,
  },
  logo: {
    width: 150,
    height: 150,
    objectFit: "contain",
  },
  sidebarCard: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  kicker: {
    fontSize: 11,
    letterSpacing: "0.24em",
    color: GOLD,
    marginBottom: 4,
  },
  backButton: {
    border: `1px solid ${BORDER}`,
    backgroundColor: GOLD,
    color: BLACK,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${BORDER}`,
    background: "transparent",
    color: "#f4f3ed",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
  },
  main: {
    flex: 1,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 18,
  },
  headerBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    padding: 20,
    border: `1px solid ${BORDER}`,
    backgroundColor: PANEL,
  },
  title: {
    margin: "4px 0 0",
    fontSize: 30,
    color: GOLD,
    letterSpacing: "0.18em",
  },
  subtitle: {
    margin: "6px 0 0",
    color: "#d3c18a",
  },
  headerActions: {
    display: "flex",
    gap: 10,
  },
  actionButton: {
    border: `1px solid ${BORDER}`,
    backgroundColor: GOLD,
    color: BLACK,
    padding: "10px 12px",
    fontWeight: 700,
    cursor: "pointer",
  },
  ghostButton: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "transparent",
    color: "#f4f3ed",
    padding: "10px 12px",
    cursor: "pointer",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
  },
  summaryCard: {
    border: "1px solid",
    backgroundColor: PANEL,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  summaryLabel: {
    color: "#b3a06b",
    fontSize: 12,
    letterSpacing: "0.16em",
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 700,
    color: GOLD,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.3fr 0.9fr",
    gap: 18,
  },
  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  rightColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  panel: {
    border: `1px solid ${BORDER}`,
    backgroundColor: PANEL,
    padding: 16,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  panelTitle: {
    margin: 0,
    color: GOLD,
    fontSize: 16,
    letterSpacing: "0.12em",
  },
  muted: {
    color: "#989067",
    fontSize: 12,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    color: "#e2dab8",
    fontSize: 13,
  },
  input: {
    border: `1px solid ${BORDER}`,
    backgroundColor: "#0f0f0f",
    color: "#f4f3ed",
    padding: "10px 12px",
    fontSize: 14,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    gridColumn: "span 2",
    color: "#e2dab8",
  },
  actionsRow: {
    display: "flex",
    gap: 10,
    gridColumn: "span 2",
  },
  errorText: {
    gridColumn: "span 2",
    backgroundColor: "rgba(255, 140, 0, 0.14)",
    color: "#ffb347",
    padding: 10,
    border: "1px solid #ff8c00",
  },
  filterRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },
  materialList: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginTop: 12,
  },
  materialCard: {
    border: "1px solid",
    backgroundColor: "#0d0d0d",
    padding: 12,
  },
  materialHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  materialTitleButton: {
    border: "none",
    background: "transparent",
    color: "#f4f3ed",
    textAlign: "left",
    padding: 0,
    cursor: "pointer",
  },
  favoriteButton: {
    border: "none",
    background: "transparent",
    color: GOLD,
    cursor: "pointer",
    fontSize: 16,
  },
  materialMeta: {
    marginTop: 4,
    color: "#cbbf87",
    fontSize: 13,
  },
  cardActions: {
    display: "flex",
    gap: 8,
    marginTop: 8,
  },
  detailCard: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  detailRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#e6dcba",
  },
  detailLabel: {
    color: "#8f8251",
  },
  detailNotes: {
    padding: 12,
    border: `1px solid ${BORDER}`,
    backgroundColor: "#0b0b0b",
    color: "#f2e9c9",
    whiteSpace: "pre-wrap",
  },
  warningBox: {
    padding: 10,
    border: `1px solid #ff8c00`,
    backgroundColor: "rgba(255, 140, 0, 0.16)",
    color: "#ffd27f",
  },
  compareList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  compareRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: 8,
    backgroundColor: "#0d0d0d",
  },
  emptyState: {
    border: `1px dashed ${BORDER}`,
    padding: 16,
    color: "#b3a06b",
    textAlign: "center",
  },
};
