import { useEffect, useMemo, useState } from "react";
import { buildApiUrl } from "../utils/apiClient.js";
import logo from "../assets/royal-star-logo.png";
import { buildProductVaultIntelligence } from "./optionExpansionIntelligence.js";

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

const categories = [
  "Bathroom",
  "Kitchen",
  "Flooring",
  "Roofing",
  "Windows",
  "Electrical",
  "Plumbing",
  "HVAC",
  "Security",
  "Concrete",
  "Paint",
  "Exterior",
  "Appliances",
  "General Materials",
];

const tiers = ["Rental", "Standard", "Premium"];

const initialValues = {
  category: "Bathroom",
  subcategory: "",
  productName: "",
  tier: "Standard",
  vendor: "",
  sku: "",
  currentPrice: "",
  previousPrice: "",
  unit: "",
  quantity: "",
  productLink: "",
  imageLink: "",
  notes: "",
  approved: false,
  preferred: false,
};

function createId() {
  return `product-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "Not Available";
  return `${(value * 100).toFixed(1)}%`;
}

function getPriceChange(currentPrice, previousPrice) {
  const current = toNumber(currentPrice);
  const previous = toNumber(previousPrice);
  const dollarChange = current - previous;
  const percentChange = previous > 0 ? dollarChange / previous : 0;
  return { dollarChange, percentChange };
}

function normalizeProductPayload(values) {
  const currentPrice = toNumber(values.currentPrice);
  const previousPrice = toNumber(values.previousPrice);

  return {
    category: values.category || "",
    subcategory: values.subcategory || "",
    productName: values.productName || "",
    tier: values.tier || "Standard",
    vendor: values.vendor || "",
    sku: values.sku || "",
    currentPrice,
    previousPrice,
    unit: values.unit || "",
    quantity: toNumber(values.quantity),
    productLink: values.productLink || "",
    imageLink: values.imageLink || "",
    notes: values.notes || "",
    approved: Boolean(values.approved),
    preferred: Boolean(values.preferred),
  };
}

export default function ProductVault({
  onBack,
  onOpenDealIntake,
  onOpenDealAnalyzer,
  onOpenFlipAnalyzer,
  onOpenBrrrrAnalyzer,
  onOpenProductVault,
  onOpenDealIntelligence,
}) {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formValues, setFormValues] = useState(initialValues);
  const [searchText, setSearchText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [tierFilter, setTierFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [approvedFilter, setApprovedFilter] = useState("All");
  const [preferredFilter, setPreferredFilter] = useState("All");
  const [sortBy, setSortBy] = useState("productName");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [taxPercent, setTaxPercent] = useState("");
  const [connectionState, setConnectionState] = useState("Backend Connected");
  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/products"));
        if (!response.ok) throw new Error("Unable to fetch products");

        const apiProducts = await response.json();
        setProducts(Array.isArray(apiProducts) ? apiProducts : []);
        setConnectionState("Backend Connected");
      } catch (error) {
        console.error("Unable to load products from API, using localStorage fallback", error);
        setConnectionState("Local Fallback");
        if (typeof window !== "undefined") {
          try {
            const storedProducts = JSON.parse(window.localStorage.getItem("royalStarProducts") || "[]") || [];
            setProducts(Array.isArray(storedProducts) ? storedProducts : []);
          } catch (localError) {
            console.error("Unable to read products from localStorage", localError);
            setProducts([]);
          }
        }
      }
    };

    loadProducts();
  }, []);

  const vendorOptions = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.vendor).filter(Boolean))).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    let items = [...products];

    if (search) {
      items = items.filter((product) => {
        const haystack = [product.productName, product.vendor, product.sku, product.category]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (categoryFilter !== "All") {
      items = items.filter((product) => product.category === categoryFilter);
    }

    if (tierFilter !== "All") {
      items = items.filter((product) => product.tier === tierFilter);
    }

    if (vendorFilter !== "All") {
      items = items.filter((product) => product.vendor === vendorFilter);
    }

    if (approvedFilter !== "All") {
      const approved = approvedFilter === "Approved";
      items = items.filter((product) => Boolean(product.approved) === approved);
    }

    if (preferredFilter !== "All") {
      const preferred = preferredFilter === "Preferred";
      items = items.filter((product) => Boolean(product.preferred) === preferred);
    }

    items.sort((left, right) => {
      switch (sortBy) {
        case "lowestPrice":
          return toNumber(left.currentPrice) - toNumber(right.currentPrice);
        case "highestPrice":
          return toNumber(right.currentPrice) - toNumber(left.currentPrice);
        case "newest":
          return (right.updatedAt || "").localeCompare(left.updatedAt || "");
        case "largestIncrease": {
          const leftChange = getPriceChange(left.currentPrice, left.previousPrice).percentChange;
          const rightChange = getPriceChange(right.currentPrice, right.previousPrice).percentChange;
          return rightChange - leftChange;
        }
        case "largestDecrease": {
          const leftChange = getPriceChange(left.currentPrice, left.previousPrice).percentChange;
          const rightChange = getPriceChange(right.currentPrice, right.previousPrice).percentChange;
          return leftChange - rightChange;
        }
        default:
          return (left.productName || "").localeCompare(right.productName || "");
      }
    });

    return items;
  }, [products, searchText, categoryFilter, tierFilter, vendorFilter, approvedFilter, preferredFilter, sortBy]);

  const summaryStats = useMemo(() => {
    const approvedCount = products.filter((product) => product.approved).length;
    const preferredCount = products.filter((product) => product.preferred).length;
    const currentValue = products.reduce((sum, product) => sum + toNumber(product.currentPrice), 0);
    const priceChangeCount = products.filter((product) => {
      const previous = toNumber(product.previousPrice);
      const current = toNumber(product.currentPrice);
      return previous > 0 && current !== previous;
    }).length;

    return {
      total: products.length,
      approved: approvedCount,
      preferred: preferredCount,
      currentValue,
      priceChanges: priceChangeCount,
    };
  }, [products]);

  const selectedMaterialSummary = useMemo(() => {
    const subtotal = selectedProductIds.reduce((sum, productId) => {
      const product = products.find((entry) => entry.id === productId);
      const quantity = toNumber(quantities[productId] || product?.quantity || 0);
      return sum + toNumber(product?.currentPrice || 0) * quantity;
    }, 0);

    const taxRate = toNumber(taxPercent) / 100;
    const taxAmount = subtotal * taxRate;
    const total = subtotal + taxAmount;

    return { subtotal, taxAmount, total };
  }, [products, selectedProductIds, quantities, taxPercent]);

  const productVaultIntelligence = useMemo(() => {
    return buildProductVaultIntelligence({ products, selectedProductIds, taxPercent, deal: { propertyAddress: "Current deal" } });
  }, [products, selectedProductIds, taxPercent]);

  const handleFieldChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const handleClearForm = () => {
    setSelectedProductId("");
    setFormValues(initialValues);
    setMessage({ type: "", text: "" });
  };

  const handleSelectProduct = (product) => {
    setSelectedProductId(product.id);
    setFormValues({
      category: product.category || "Bathroom",
      subcategory: product.subcategory || "",
      productName: product.productName || "",
      tier: product.tier || "Standard",
      vendor: product.vendor || "",
      sku: product.sku || "",
      currentPrice: product.currentPrice ?? "",
      previousPrice: product.previousPrice ?? "",
      unit: product.unit || "",
      quantity: product.quantity ?? "",
      productLink: product.productLink || "",
      imageLink: product.imageLink || "",
      notes: product.notes || "",
      approved: Boolean(product.approved),
      preferred: Boolean(product.preferred),
    });
    setMessage({ type: "", text: "" });
  };

  const persistProduct = async (productPayload, existingProduct = null) => {
    const payload = {
      ...productPayload,
      previousPrice: existingProduct?.previousPrice ?? productPayload.previousPrice,
      priceHistory: existingProduct?.priceHistory || [],
    };

    if (existingProduct) {
      const previousPrice = existingProduct.currentPrice;
      if (productPayload.currentPrice !== existingProduct.currentPrice) {
        payload.previousPrice = previousPrice;
        payload.priceHistory = [
          ...(existingProduct.priceHistory || []),
          { price: previousPrice, changedAt: new Date().toISOString() },
        ];
      }
    }

    if (existingProduct) {
      try {
        const response = await fetch(buildApiUrl(`/api/products/${existingProduct.id}`), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Unable to update product");
        return response.json();
      } catch (error) {
        console.error("Unable to update via API, using local fallback", error);
        return {
          ...payload,
          id: existingProduct.id,
          createdAt: existingProduct.createdAt,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    try {
      const response = await fetch(buildApiUrl("/api/products"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to create product");
      return response.json();
    } catch (error) {
      console.error("Unable to create via API, using local fallback", error);
      return {
        ...payload,
        id: createId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formValues.productName.trim()) {
      setMessage({ type: "error", text: "Product name is required." });
      return;
    }

    if (!formValues.category) {
      setMessage({ type: "error", text: "Category is required." });
      return;
    }

    if (!formValues.vendor.trim()) {
      setMessage({ type: "error", text: "Vendor is required." });
      return;
    }

    const priceValue = toNumber(formValues.currentPrice);
    if (formValues.currentPrice === "" || priceValue < 0) {
      setMessage({ type: "error", text: "Price is required and cannot be negative." });
      return;
    }

    const existingProduct = products.find((product) => product.id === selectedProductId);
    const normalizedProduct = normalizeProductPayload(formValues);

    try {
      const savedProduct = await persistProduct(normalizedProduct, existingProduct);
      const nextProducts = existingProduct
        ? products.map((product) => (product.id === existingProduct.id ? { ...product, ...savedProduct, id: existingProduct.id } : product))
        : [...products, savedProduct || { ...normalizedProduct, id: createId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];

      setProducts(nextProducts);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarProducts", JSON.stringify(nextProducts));
      }
      setSelectedProductId(existingProduct ? existingProduct.id : (savedProduct?.id || ""));
      setFormValues(initialValues);
      setMessage({ type: "success", text: existingProduct ? "Product updated successfully." : "Product added successfully." });
    } catch (error) {
      setMessage({ type: "error", text: "Unable to save the product." });
    }
  };

  const handleDeleteProduct = async (productId) => {
    const target = products.find((product) => product.id === productId);
    if (!target) return;

    try {
      const response = await fetch(buildApiUrl(`/api/products/${productId}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Unable to delete product");
      const nextProducts = products.filter((product) => product.id !== productId);
      setProducts(nextProducts);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarProducts", JSON.stringify(nextProducts));
      }
      setSelectedProductId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Product deleted successfully." });
    } catch (error) {
      console.error("Unable to delete product via API, using localStorage fallback", error);
      const nextProducts = products.filter((product) => product.id !== productId);
      setProducts(nextProducts);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("royalStarProducts", JSON.stringify(nextProducts));
      }
      setSelectedProductId("");
      setFormValues(initialValues);
      setMessage({ type: "success", text: "Product deleted successfully." });
    }
  };

  const handleToggleSelection = (productId) => {
    setSelectedProductIds((prev) => (prev.includes(productId) ? prev.filter((entry) => entry !== productId) : [...prev, productId]));
    setQuantities((prev) => ({ ...prev, [productId]: prev[productId] || 1 }));
  };

  const handleQuantityChange = (productId, value) => {
    setQuantities((prev) => ({ ...prev, [productId]: value }));
  };

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
          <button type="button" style={styles.backButton} onClick={onBack}>
            ◀ COMMAND CENTER
          </button>

          <div style={styles.headingBlock}>
            <h1 style={styles.company}>ROYAL STAR PROPERTIES, LLC</h1>
            <p style={styles.subtitle}>PRODUCT VAULT / RSOS MATERIAL MANAGEMENT</p>
          </div>

          <div style={styles.headerActions}>
            <button type="button" style={styles.secondaryButton} onClick={onOpenDealAnalyzer}>
              DEAL ANALYZER
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenFlipAnalyzer}>
              FLIP ANALYZER
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenBrrrrAnalyzer}>
              BRRRR ANALYZER
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntake}>
              ADD NEW DEAL
            </button>
            <button type="button" style={styles.primaryButton} onClick={onOpenDealIntelligence}>
              DEAL INTELLIGENCE
            </button>
          </div>
        </section>

        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>PRODUCT VAULT</h2>
              <p style={styles.cardSubtitle}>Track approved materials, vendors, pricing changes, and selection totals.</p>
            </div>
            <div style={styles.connectionBadge}>{connectionState}</div>
          </div>

          <div style={styles.assumptionBox}>
            Royal Star standards are guidance only and are not embedded in product prices.
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard label="Total Products" value={summaryStats.total} />
            <SummaryCard label="Approved Products" value={summaryStats.approved} />
            <SummaryCard label="Preferred Products" value={summaryStats.preferred} />
            <SummaryCard label="Total Current Value" value={formatCurrency(summaryStats.currentValue)} />
            <SummaryCard label="Products with Price Changes" value={summaryStats.priceChanges} />
          </div>

          <div style={styles.insightPanel}>
            <div style={styles.insightTitle}>INTELLIGENCE SNAPSHOT</div>
            <div style={styles.insightBody}>
              <strong>{productVaultIntelligence.summary.selectionHealth}</strong> selection posture for {productVaultIntelligence.summary.dealLabel}.
            </div>
            <div style={styles.insightStats}>
              <span>Approved: {productVaultIntelligence.summary.approvedCount}</span>
              <span>Preferred: {productVaultIntelligence.summary.preferredCount}</span>
              <span>Selected: {productVaultIntelligence.summary.selectedCount}</span>
            </div>
            <ul style={styles.insightList}>
              {productVaultIntelligence.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </div>

          <div style={styles.controlsRow}>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search product, vendor, SKU, or category"
              style={styles.input}
            />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={styles.select}>
              <option value="All">All Categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} style={styles.select}>
              <option value="All">All Tiers</option>
              {tiers.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </select>
            <select value={vendorFilter} onChange={(event) => setVendorFilter(event.target.value)} style={styles.select}>
              <option value="All">All Vendors</option>
              {vendorOptions.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
            <select value={approvedFilter} onChange={(event) => setApprovedFilter(event.target.value)} style={styles.select}>
              <option value="All">All Approval Status</option>
              <option value="Approved">Approved</option>
              <option value="Pending">Pending</option>
            </select>
            <select value={preferredFilter} onChange={(event) => setPreferredFilter(event.target.value)} style={styles.select}>
              <option value="All">All Preferred Status</option>
              <option value="Preferred">Preferred</option>
              <option value="Standard">Standard</option>
            </select>
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={styles.select}>
              <option value="productName">Sort by Product Name</option>
              <option value="lowestPrice">Sort by Lowest Price</option>
              <option value="highestPrice">Sort by Highest Price</option>
              <option value="newest">Sort by Newest</option>
              <option value="largestIncrease">Sort by Largest Increase</option>
              <option value="largestDecrease">Sort by Largest Decrease</option>
            </select>
          </div>

          <div style={styles.gridTwo}>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>PRODUCT FORM</h3>
              {message.text ? <div style={message.type === "success" ? styles.successMessage : styles.errorMessage}>{message.text}</div> : null}
              <div style={styles.formGrid}>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Product Name</span>
                  <input type="text" name="productName" value={formValues.productName} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Category</span>
                  <select name="category" value={formValues.category} onChange={handleFieldChange} style={styles.select}>
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Subcategory</span>
                  <input type="text" name="subcategory" value={formValues.subcategory} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Tier</span>
                  <select name="tier" value={formValues.tier} onChange={handleFieldChange} style={styles.select}>
                    {tiers.map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Vendor</span>
                  <input type="text" name="vendor" value={formValues.vendor} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>SKU</span>
                  <input type="text" name="sku" value={formValues.sku} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Current Price</span>
                  <input type="number" name="currentPrice" value={formValues.currentPrice} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Previous Price</span>
                  <input type="number" name="previousPrice" value={formValues.previousPrice} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Unit</span>
                  <input type="text" name="unit" value={formValues.unit} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Quantity</span>
                  <input type="number" name="quantity" value={formValues.quantity} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Product Link</span>
                  <input type="text" name="productLink" value={formValues.productLink} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Image Link</span>
                  <input type="text" name="imageLink" value={formValues.imageLink} onChange={handleFieldChange} style={styles.input} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Approved</span>
                  <input type="checkbox" name="approved" checked={formValues.approved} onChange={handleFieldChange} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Preferred</span>
                  <input type="checkbox" name="preferred" checked={formValues.preferred} onChange={handleFieldChange} />
                </label>
                <label style={styles.label}>
                  <span style={styles.fieldLabel}>Notes</span>
                  <textarea name="notes" value={formValues.notes} onChange={handleFieldChange} style={{ ...styles.input, minHeight: "90px" }} />
                </label>
              </div>

              <div style={styles.formActions}>
                <button type="button" style={styles.primaryButton} onClick={handleSubmit}>
                  {selectedProductId ? "UPDATE PRODUCT" : "ADD PRODUCT"}
                </button>
                <button type="button" style={styles.secondaryButton} onClick={handleClearForm}>
                  CLEAR FORM
                </button>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>SELECTED MATERIAL SUMMARY</h3>
              <label style={styles.label}>
                <span style={styles.fieldLabel}>Tax Percentage</span>
                <input type="number" value={taxPercent} onChange={(event) => setTaxPercent(event.target.value)} style={styles.input} />
              </label>
              <div style={styles.summaryGrid}>
                <SummaryCard label="Subtotal" value={formatCurrency(selectedMaterialSummary.subtotal)} />
                <SummaryCard label="Tax" value={formatCurrency(selectedMaterialSummary.taxAmount)} />
                <SummaryCard label="Total" value={formatCurrency(selectedMaterialSummary.total)} />
              </div>
              {selectedProductIds.length === 0 ? <div style={styles.emptyState}>Select products for a project subtotal.</div> : null}
              <div style={styles.selectionList}>
                {products.filter((product) => selectedProductIds.includes(product.id)).map((product) => (
                  <div key={product.id} style={styles.selectionRow}>
                    <span>{product.productName}</span>
                    <input
                      type="number"
                      min="0"
                      value={quantities[product.id] || 1}
                      onChange={(event) => handleQuantityChange(product.id, event.target.value)}
                      style={{ ...styles.input, width: "70px" }}
                    />
                    <span>{product.unit || "unit"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>PRODUCTS</h3>
            {filteredProducts.length === 0 ? (
              <div style={styles.emptyState}>No products exist yet. Add the first approved product to begin building the vault.</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Select</th>
                      <th style={styles.th}>Product</th>
                      <th style={styles.th}>Category</th>
                      <th style={styles.th}>Tier</th>
                      <th style={styles.th}>Vendor</th>
                      <th style={styles.th}>SKU</th>
                      <th style={styles.th}>Current</th>
                      <th style={styles.th}>Prev</th>
                      <th style={styles.th}>Change</th>
                      <th style={styles.th}>Link</th>
                      <th style={styles.th}>Edit</th>
                      <th style={styles.th}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => {
                      const change = getPriceChange(product.currentPrice, product.previousPrice);
                      return (
                        <tr key={product.id}>
                          <td style={styles.td}>
                            <input type="checkbox" checked={selectedProductIds.includes(product.id)} onChange={() => handleToggleSelection(product.id)} />
                          </td>
                          <td style={styles.td}>
                            <div style={styles.productNameCell}>{product.productName}</div>
                            <div style={styles.productMeta}>{product.approved ? "Approved" : "Pending"} • {product.preferred ? "Preferred" : "Standard"}</div>
                          </td>
                          <td style={styles.td}>{product.category}</td>
                          <td style={styles.td}>{product.tier}</td>
                          <td style={styles.td}>{product.vendor}</td>
                          <td style={styles.td}>{product.sku || "—"}</td>
                          <td style={styles.td}>{formatCurrency(product.currentPrice)}</td>
                          <td style={styles.td}>{formatCurrency(product.previousPrice)}</td>
                          <td style={styles.td}>{change.dollarChange >= 0 ? `+${formatCurrency(change.dollarChange)}` : formatCurrency(change.dollarChange)}</td>
                          <td style={styles.td}>{product.productLink ? <a href={product.productLink} target="_blank" rel="noreferrer" style={styles.link}>{product.productLink}</a> : "No Link"}</td>
                          <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleSelectProduct(product)}>Edit</button></td>
                          <td style={styles.td}><button type="button" style={styles.tableButton} onClick={() => handleDeleteProduct(product.id)}>Delete</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    overflow: "hidden",
    backgroundColor: BLACK,
    color: GOLD,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: 700,
  },
  sidebar: {
    flex: "0 0 178px",
    minHeight: "100vh",
    padding: "18px 0 10px",
    boxSizing: "border-box",
    backgroundColor: BLACK,
    display: "flex",
    flexDirection: "column",
    position: "relative",
  },
  logoArea: {
    height: "114px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 15px 10px",
    boxSizing: "border-box",
  },
  logo: {
    display: "block",
    width: "135px",
    height: "104px",
    objectFit: "contain",
    backgroundColor: "#ffffff",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
    paddingRight: "14px",
  },
  navButton: {
    position: "relative",
    width: "100%",
    minHeight: "36px",
    padding: "7px 10px",
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    textAlign: "left",
    fontSize: "10px",
    fontWeight: 500,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  navIcon: {
    width: "18px",
    textAlign: "center",
    fontSize: "12px",
  },
  navTab: {
    position: "absolute",
    right: "-13px",
    top: "8px",
    width: "13px",
    height: "20px",
    backgroundColor: GOLD,
    border: `1px solid ${BORDER}`,
    boxSizing: "border-box",
  },
  logout: {
    width: "100%",
    minHeight: "34px",
    padding: "7px 10px",
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    textAlign: "left",
    fontSize: "10px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    cursor: "pointer",
  },
  smallMark: {
    marginTop: "8px",
    paddingLeft: "12px",
    fontFamily: "Georgia, serif",
    fontSize: "25px",
    color: GOLD,
  },
  main: {
    flex: 1,
    minWidth: 0,
    padding: "20px 20px 18px",
    boxSizing: "border-box",
    backgroundColor: BLACK,
  },
  topBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "16px",
  },
  backButton: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  headingBlock: {
    flex: 1,
    textAlign: "center",
  },
  company: {
    margin: 0,
    fontSize: "22px",
    letterSpacing: "1px",
  },
  subtitle: {
    margin: "4px 0 0",
    fontSize: "12px",
    letterSpacing: "1.4px",
    color: "#f9e27b",
  },
  headerActions: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  primaryButton: {
    border: `1px solid ${BORDER}`,
    background: "linear-gradient(90deg, #f7d339 0%, #eab90c 100%)",
    color: "#17120a",
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    color: GOLD,
    padding: "10px 14px",
    fontWeight: 700,
    cursor: "pointer",
  },
  card: {
    border: `1px solid ${BORDER}`,
    background: "#0b0b0b",
    padding: "16px",
    boxSizing: "border-box",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    marginBottom: "10px",
  },
  cardTitle: {
    margin: 0,
    fontSize: "20px",
    color: GOLD,
  },
  cardSubtitle: {
    margin: "4px 0 0",
    fontSize: "12px",
    color: "#f9e27b",
  },
  connectionBadge: {
    border: `1px solid ${BORDER}`,
    padding: "8px 10px",
    fontSize: "12px",
    color: GOLD,
    background: "#111111",
  },
  assumptionBox: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    padding: "10px 12px",
    fontSize: "12px",
    color: "#f9e27b",
    marginBottom: "12px",
  },
  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
    marginBottom: "12px",
  },
  summaryCard: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    padding: "10px",
    boxSizing: "border-box",
  },
  summaryLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
    color: "#f9e27b",
    marginBottom: "6px",
  },
  summaryValue: {
    fontSize: "16px",
    color: GOLD,
    fontWeight: 700,
  },
  controlsRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "12px",
  },
  input: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    color: GOLD,
    padding: "8px 10px",
    fontSize: "12px",
    minWidth: "120px",
    boxSizing: "border-box",
  },
  select: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    color: GOLD,
    padding: "8px 10px",
    fontSize: "12px",
    minWidth: "140px",
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: "12px",
    marginBottom: "12px",
  },
  section: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    padding: "12px",
    boxSizing: "border-box",
  },
  sectionTitle: {
    margin: "0 0 10px",
    fontSize: "15px",
    color: GOLD,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(180px, 1fr))",
    gap: "10px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    fontSize: "12px",
    color: "#f9e27b",
  },
  fieldLabel: {
    fontSize: "11px",
    textTransform: "uppercase",
  },
  formActions: {
    display: "flex",
    gap: "10px",
    marginTop: "12px",
  },
  successMessage: {
    border: "1px solid #4caf50",
    color: "#4caf50",
    padding: "8px 10px",
    marginBottom: "10px",
    fontSize: "12px",
  },
  errorMessage: {
    border: "1px solid #ff6b6b",
    color: "#ff6b6b",
    padding: "8px 10px",
    marginBottom: "10px",
    fontSize: "12px",
  },
  emptyState: {
    border: `1px dashed ${BORDER}`,
    padding: "14px",
    color: "#f9e27b",
    fontSize: "12px",
    background: "#0c0c0c",
  },
  selectionList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    marginTop: "10px",
  },
  selectionRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    border: `1px solid ${BORDER}`,
    background: "#0c0c0c",
    fontSize: "12px",
  },
  tableWrap: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  th: {
    textAlign: "left",
    padding: "8px 6px",
    borderBottom: `1px solid ${BORDER}`,
    color: GOLD,
    textTransform: "uppercase",
  },
  td: {
    padding: "8px 6px",
    borderBottom: `1px solid #2a2400`,
    verticalAlign: "top",
  },
  productNameCell: {
    fontWeight: 700,
    color: GOLD,
  },
  productMeta: {
    fontSize: "11px",
    color: "#f9e27b",
    marginTop: "2px",
  },
  link: {
    color: GOLD,
    wordBreak: "break-all",
  },
  tableButton: {
    border: `1px solid ${BORDER}`,
    background: "#111111",
    color: GOLD,
    padding: "6px 8px",
    cursor: "pointer",
  },
};
