import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const dealsFile = path.join(dataDir, "deals.json");
const productsFile = path.join(dataDir, "products.json");
const contractorsFile = path.join(dataDir, "contractors.json");
const port = Number(process.env.PORT || 3001);

function createId(prefix = "deal") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function getStringValue(source, fallback = "") {
  const value = source ?? fallback;
  return typeof value === "string" ? value : "";
}

function getNumberValue(source) {
  if (source === "" || source === null || source === undefined) return "";
  const parsed = Number(source);
  return Number.isFinite(parsed) ? parsed : "";
}

function normalizeDealPayload(payload = {}) {
  return {
    propertyAddress: getStringValue(payload.propertyAddress ?? payload.address),
    city: getStringValue(payload.city),
    state: getStringValue(payload.state),
    zipCode: getStringValue(payload.zipCode ?? payload.zip),
    propertyType: getStringValue(payload.propertyType),
    bedrooms: getNumberValue(payload.bedrooms),
    bathrooms: getNumberValue(payload.bathrooms),
    squareFeet: getNumberValue(payload.squareFeet),
    yearBuilt: getNumberValue(payload.yearBuilt),
    askingPrice: getNumberValue(payload.askingPrice),
    purchasePrice: getNumberValue(payload.purchasePrice),
    rehabBudget: getNumberValue(payload.rehabBudget),
    estimatedArv: getNumberValue(payload.estimatedArv ?? payload.arv),
    estimatedRent: getNumberValue(payload.estimatedRent),
    taxes: getNumberValue(payload.taxes),
    insurance: getNumberValue(payload.insurance),
    financingCosts: getNumberValue(payload.financingCosts),
    closingCosts: getNumberValue(payload.closingCosts),
    holdingMonths: getNumberValue(payload.holdingMonths),
    leadSource: getStringValue(payload.leadSource),
    strategy: getStringValue(payload.strategy ?? payload.exitStrategy),
    notes: getStringValue(payload.notes),
    status: getStringValue(payload.status, "active"),
    source: getStringValue(payload.source, "web"),
  };
}

function validateDeal(deal) {
  const errors = [];
  if (!deal.propertyAddress) errors.push("propertyAddress is required");
  if (!deal.city) errors.push("city is required");
  if (!deal.state) errors.push("state is required");
  if (!deal.zipCode) errors.push("zipCode is required");
  if (deal.purchasePrice !== "" && deal.purchasePrice < 0) errors.push("purchasePrice cannot be negative");
  if (deal.rehabBudget !== "" && deal.rehabBudget < 0) errors.push("rehabBudget cannot be negative");
  if (deal.estimatedArv !== "" && deal.estimatedArv < 0) errors.push("estimatedArv cannot be negative");
  return errors;
}

async function ensureDataFile(filePath, fallbackData) {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(filePath);
  } catch {
    await writeJsonFile(filePath, fallbackData);
  }
}

async function writeJsonFile(filePath, payload) {
  const tempFilePath = path.join(dataDir, `${path.basename(filePath)}.${Date.now()}.tmp`);
  const content = `${JSON.stringify(payload, null, 2)}\n`;
  try {
    await fs.writeFile(tempFilePath, content, "utf8");
    await fs.rm(filePath, { force: true });
    await fs.rename(tempFilePath, filePath);
  } catch (error) {
    await fs.rm(tempFilePath, { force: true }).catch(() => {});
    throw error;
  }
}

async function readJsonArray(filePath, fallback) {
  await ensureDataFile(filePath, fallback);
  const content = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed)) throw new Error("Data is invalid");
  return parsed;
}

async function writeJsonArray(filePath, payload) {
  await writeJsonFile(filePath, payload);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(payload));
}

function sendEmpty(res, status = 204) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end();
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "OPTIONS") {
    sendEmpty(res);
    return;
  }

  if (pathname === "/api/health") {
    sendJson(res, 200, { status: "ok", service: "rsos-backend" });
    return;
  }

  if (pathname === "/api/deals") {
    if (req.method === "GET") {
      const deals = await readJsonArray(dealsFile, []);
      sendJson(res, 200, deals);
      return;
    }
    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const normalizedDeal = normalizeDealPayload(payload);
      const errors = validateDeal(normalizedDeal);
      if (errors.length > 0) {
        sendJson(res, 400, { error: "Validation failed", errors });
        return;
      }
      const deals = await readJsonArray(dealsFile, []);
      const now = new Date().toISOString();
      const newDeal = { ...normalizedDeal, id: createId(), createdAt: now, updatedAt: now, status: normalizedDeal.status || "active", source: normalizedDeal.source || "web" };
      deals.push(newDeal);
      await writeJsonArray(dealsFile, deals);
      sendJson(res, 201, newDeal);
      return;
    }
  }

  if (pathname === "/api/products") {
    if (req.method === "GET") {
      const products = await readJsonArray(productsFile, []);
      sendJson(res, 200, products);
      return;
    }
    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const products = await readJsonArray(productsFile, []);
      const normalizedProduct = { ...payload, id: createId("product"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      products.push(normalizedProduct);
      await writeJsonArray(productsFile, products);
      sendJson(res, 201, normalizedProduct);
      return;
    }
  }

  if (pathname === "/api/contractors") {
    if (req.method === "GET") {
      const contractors = await readJsonArray(contractorsFile, []);
      sendJson(res, 200, contractors);
      return;
    }
    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const contractors = await readJsonArray(contractorsFile, []);
      const normalizedContractor = { ...payload, id: createId("contractor"), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      contractors.push(normalizedContractor);
      await writeJsonArray(contractorsFile, contractors);
      sendJson(res, 201, normalizedContractor);
      return;
    }
  }

  const dealsMatch = pathname.match(/^\/api\/deals\/([^/]+)$/);
  if (dealsMatch) {
    const id = dealsMatch[1];
    if (req.method === "GET") {
      const deals = await readJsonArray(dealsFile, []);
      const deal = deals.find((entry) => entry.id === id);
      if (!deal) {
        sendJson(res, 404, { error: "Deal not found" });
        return;
      }
      sendJson(res, 200, deal);
      return;
    }
    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const deals = await readJsonArray(dealsFile, []);
      const targetIndex = deals.findIndex((entry) => entry.id === id);
      if (targetIndex === -1) {
        sendJson(res, 404, { error: "Deal not found" });
        return;
      }
      const normalizedDeal = normalizeDealPayload(payload);
      const errors = validateDeal(normalizedDeal);
      if (errors.length > 0) {
        sendJson(res, 400, { error: "Validation failed", errors });
        return;
      }
      const existingDeal = deals[targetIndex];
      const updatedDeal = { ...existingDeal, ...normalizedDeal, id: existingDeal.id, createdAt: existingDeal.createdAt, updatedAt: new Date().toISOString(), status: normalizedDeal.status || existingDeal.status || "active", source: normalizedDeal.source || existingDeal.source || "web" };
      deals[targetIndex] = updatedDeal;
      await writeJsonArray(dealsFile, deals);
      sendJson(res, 200, updatedDeal);
      return;
    }
    if (req.method === "DELETE") {
      const deals = await readJsonArray(dealsFile, []);
      const targetIndex = deals.findIndex((entry) => entry.id === id);
      if (targetIndex === -1) {
        sendJson(res, 404, { error: "Deal not found" });
        return;
      }
      deals.splice(targetIndex, 1);
      await writeJsonArray(dealsFile, deals);
      sendJson(res, 200, { success: true, deletedId: id });
      return;
    }
  }

  const productsMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productsMatch) {
    const id = productsMatch[1];
    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const products = await readJsonArray(productsFile, []);
      const targetIndex = products.findIndex((entry) => entry.id === id);
      if (targetIndex === -1) {
        sendJson(res, 404, { error: "Product not found" });
        return;
      }
      const updatedProduct = { ...products[targetIndex], ...payload, id: req.params?.id || id, updatedAt: new Date().toISOString() };
      products[targetIndex] = updatedProduct;
      await writeJsonArray(productsFile, products);
      sendJson(res, 200, updatedProduct);
      return;
    }
    if (req.method === "DELETE") {
      const products = await readJsonArray(productsFile, []);
      const targetIndex = products.findIndex((entry) => entry.id === id);
      if (targetIndex === -1) {
        sendJson(res, 404, { error: "Product not found" });
        return;
      }
      products.splice(targetIndex, 1);
      await writeJsonArray(productsFile, products);
      sendJson(res, 200, { success: true, deletedId: id });
      return;
    }
  }

  const contractorsMatch = pathname.match(/^\/api\/contractors\/([^/]+)$/);
  if (contractorsMatch) {
    const id = contractorsMatch[1];
    if (req.method === "PUT") {
      const payload = await readJsonBody(req);
      const contractors = await readJsonArray(contractorsFile, []);
      const targetIndex = contractors.findIndex((entry) => entry.id === id);
      if (targetIndex === -1) {
        sendJson(res, 404, { error: "Contractor not found" });
        return;
      }
      const updatedContractor = { ...contractors[targetIndex], ...payload, id, updatedAt: new Date().toISOString() };
      contractors[targetIndex] = updatedContractor;
      await writeJsonArray(contractorsFile, contractors);
      sendJson(res, 200, updatedContractor);
      return;
    }
    if (req.method === "DELETE") {
      const contractors = await readJsonArray(contractorsFile, []);
      const targetIndex = contractors.findIndex((entry) => entry.id === id);
      if (targetIndex === -1) {
        sendJson(res, 404, { error: "Contractor not found" });
        return;
      }
      contractors.splice(targetIndex, 1);
      await writeJsonArray(contractorsFile, contractors);
      sendJson(res, 200, { success: true, deletedId: id });
      return;
    }
  }

  sendJson(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    await handleRequest(req, res);
  } catch (error) {
    console.error("[RSOS] Request failed:", error.message);
    sendJson(res, 500, { error: "Internal server error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[RSOS] Backend listening on http://0.0.0.0:${port}`);
});
