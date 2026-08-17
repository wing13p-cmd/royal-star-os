import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { buildApiUrl } from "./utils/apiClient";
import { resolveBackendStatus } from "./utils/backendHealthStatus";
import {
  getCanonicalNavigation,
  resolveSafeViewKey,
} from "./utils/navigationModel";
import {
  getActionTextFromEvent,
  isStandaloneDisplayMode,
  shouldBlockOfflineMutation,
  shouldShowInstallAction,
  shouldShowIosInstallInstructions,
} from "./utils/pwaRuntime.js";

const Dashboard = lazy(() => import("./components/Dashboard"));
const DealAnalyzer = lazy(() => import("./components/DealAnalyzer"));
const OfferGenerator = lazy(() => import("./components/OfferGenerator"));
const DealIntake = lazy(() => import("./components/DealIntake.jsx"));
const DealIntelligence = lazy(() => import("./components/DealIntelligence"));
const FlipAnalyzer = lazy(() => import("./components/FlipAnalyzer"));
const BrrrrAnalyzer = lazy(() => import("./components/BrrrrAnalyzer"));
const ProductVault = lazy(() => import("./components/ProductVault"));
const ContractorHub = lazy(() => import("./components/ContractorHub"));
const CompDatabase = lazy(() => import("./components/CompDatabase"));
const NeighborhoodDatabase = lazy(() => import("./components/NeighborhoodDatabase"));
const PortfolioDashboard = lazy(() => import("./components/PortfolioDashboard"));
const PropertyDatabase = lazy(() => import("./components/PropertyDatabase"));
const VendorDatabase = lazy(() => import("./components/VendorDatabase"));
const MaterialMatrix = lazy(() => import("./components/MaterialMatrix"));
const LenderDashboard = lazy(() => import("./components/LenderDashboard"));
const AppraiserPacketBuilder = lazy(() => import("./components/AppraiserPacketBuilder"));
const RehabProjectTracker = lazy(() => import("./components/RehabProjectTracker"));
const IntelligenceWorkspace = lazy(() => import("./components/IntelligenceWorkspace"));

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [, setSystemStatus] = useState("System Healthy");
  const [isBackendReachable, setIsBackendReachable] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isNetworkOffline, setIsNetworkOffline] = useState(
    typeof window !== "undefined" ? !window.navigator.onLine : false,
  );
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null);
  const [showIosInstallHint, setShowIosInstallHint] = useState(false);
  const [isStandalone, setIsStandalone] = useState(
    typeof window !== "undefined" ? isStandaloneDisplayMode(window) : false,
  );
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const popstateNavigationRef = useRef(false);
  const mobileDrawerRef = useRef(null);

  const canonicalNavigation = useMemo(() => getCanonicalNavigation(), []);
  const isOffline = isNetworkOffline || !isBackendReachable;

  const navigateToView = (viewKey) => {
    const nextView = resolveSafeViewKey(viewKey, "dashboard");
    setCurrentView(nextView);
  };

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    const checkBackend = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/health"));
        const payload = response.ok ? await response.json() : null;

        if (!cancelled) {
          setSystemStatus(resolveBackendStatus(payload, !response.ok));
          setIsBackendReachable(Boolean(response.ok && payload?.ok !== false));
        }
      } catch {
        if (!cancelled) {
          setSystemStatus(resolveBackendStatus(null, true));
          setIsBackendReachable(false);
        }
      }
    };

    checkBackend();
    intervalId = window.setInterval(checkBackend, 15000);

    return () => {
      cancelled = true;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, []);

  const handleOpenDealIntake = (deal = null) => {
    setSelectedDeal(deal);
    navigateToView("dealIntake");
  };

  const handleBackToDashboard = () => {
    setSelectedDeal(null);
    navigateToView("dashboard");
  };

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleOnline = () => setIsNetworkOffline(false);
    const handleOffline = () => setIsNetworkOffline(true);
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event);
    };
    const handleAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setShowIosInstallHint(false);
      setIsStandalone(true);
    };
    const handleDisplayModeChange = () => {
      setIsStandalone(isStandaloneDisplayMode(window));
    };
    const handleUpdateAvailable = () => {
      setUpdateAvailable(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("rsos-sw-update-available", handleUpdateAvailable);
    window.matchMedia("(display-mode: standalone)")?.addEventListener?.("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("rsos-sw-update-available", handleUpdateAvailable);
      window.matchMedia("(display-mode: standalone)")?.removeEventListener?.("change", handleDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    if (!isMobileNavOpen || typeof document === "undefined") return undefined;

    const focusable = mobileDrawerRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus?.();

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileNavOpen(false);
      }

      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.classList.add("rsos-mobile-nav-open");
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.classList.remove("rsos-mobile-nav-open");
    };
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const onPotentialMutation = (event) => {
      const actionText = getActionTextFromEvent(event);
      if (!shouldBlockOfflineMutation({
        isOnline: !isOffline,
        actionText,
      })) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      window.alert("RSOS is offline. Viewing cached interface only. Changes cannot be saved.");
    };

    document.addEventListener("click", onPotentialMutation, true);
    document.addEventListener("submit", onPotentialMutation, true);

    return () => {
      document.removeEventListener("click", onPotentialMutation, true);
      document.removeEventListener("submit", onPotentialMutation, true);
    };
  }, [isOffline]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const inputs = document.querySelectorAll("input");
    inputs.forEach((input) => {
      if (input.type === "number") input.setAttribute("inputmode", "decimal");
      if (input.type === "email") input.setAttribute("inputmode", "email");
      if (input.type === "tel") input.setAttribute("inputmode", "tel");
      if (input.type === "url") input.setAttribute("inputmode", "url");
    });
  }, [currentView]);

  const handleInstallClick = async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice.catch(() => undefined);
      setDeferredInstallPrompt(null);
      return;
    }

    if (shouldShowIosInstallInstructions({
      isStandalone,
      hasDeferredPrompt: Boolean(deferredInstallPrompt),
    })) {
      setShowIosInstallHint((previous) => !previous);
    }
  };

  const installActionVisible = shouldShowInstallAction({
    isStandalone,
    hasDeferredPrompt: Boolean(deferredInstallPrompt),
  });

  const showIosInstallInstructions = showIosInstallHint && shouldShowIosInstallInstructions({
    isStandalone,
    hasDeferredPrompt: Boolean(deferredInstallPrompt),
  });

  const handleRefreshForUpdate = () => {
    window.location.reload();
  };

  useEffect(() => {
    const onPopState = (event) => {
      const popView = event?.state?.view;
      popstateNavigationRef.current = true;
      setCurrentView(resolveSafeViewKey(popView, "dashboard"));
      setIsMobileNavOpen(false);
    };

    window.addEventListener("popstate", onPopState);
    if (!window.history.state?.view) {
      const queryView = new URLSearchParams(window.location.search).get("view");
      const initialView = resolveSafeViewKey(queryView, "dashboard");
      setCurrentView(initialView);
      window.history.replaceState({ view: initialView }, "");
    }

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    if (popstateNavigationRef.current) {
      popstateNavigationRef.current = false;
      return;
    }

    if (window.history.state?.view !== currentView) {
      window.history.pushState({ view: currentView }, "");
    }
  }, [currentView]);

  const navigateFromMobileDrawer = (viewKey) => {
    navigateToView(viewKey);
    setIsMobileNavOpen(false);
  };

  const appContent = (() => {
    if (currentView === "dealIntake") {
      return <DealIntake dealToEdit={selectedDeal} onBack={handleBackToDashboard} currentView={currentView} onNavigate={navigateToView} />;
    }

    if (currentView === "dealAnalyzer") {
      return (
        <DealAnalyzer
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealIntelligence={() => navigateToView("dealIntelligence")}
          onOpenOfferGenerator={() => navigateToView("offerGenerator")}
          onEditDeal={(deal) => handleOpenDealIntake(deal)}
          currentView={currentView}
          onNavigate={navigateToView}
        />
      );
    }

    if (currentView === "dealIntelligence") {
      return <DealIntelligence onBack={handleBackToDashboard} currentView={currentView} onNavigate={navigateToView} />;
    }

    if (currentView === "offerGenerator") {
      return <OfferGenerator onBackToDealAnalyzer={() => navigateToView("dealAnalyzer")} currentView={currentView} onNavigate={navigateToView} />;
    }

    if (["knowledgeBase", "enterpriseSearch", "forecastingCenter", "reportingCenter", "documentAutomation", "aiCommandCenter"].includes(currentView)) {
      return <IntelligenceWorkspace onBack={handleBackToDashboard} currentView={currentView} onNavigate={navigateToView} />;
    }

    if (currentView === "flipAnalyzer") {
      return (
        <FlipAnalyzer
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => navigateToView("dealAnalyzer")}
          onOpenDealIntelligence={() => navigateToView("dealIntelligence")}
          currentView={currentView}
          onNavigate={navigateToView}
        />
      );
    }

    if (currentView === "brrrrAnalyzer") {
      return (
        <BrrrrAnalyzer
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => navigateToView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => navigateToView("flipAnalyzer")}
          onOpenDealIntelligence={() => navigateToView("dealIntelligence")}
          currentView={currentView}
          onNavigate={navigateToView}
        />
      );
    }

    if (currentView === "productVault") {
      return (
        <ProductVault
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
        />
      );
    }

    if (currentView === "contractorHub") {
      return (
        <ContractorHub
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
        />
      );
    }

    if (currentView === "compDatabase") {
      return (
        <CompDatabase
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
        />
      );
    }

    if (currentView === "neighborhoodDatabase") {
      return (
        <NeighborhoodDatabase
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
        />
      );
    }

    if (currentView === "portfolioDashboard") {
      return (
        <PortfolioDashboard
          onBack={handleBackToDashboard}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
        />
      );
    }

    if (currentView === "propertyDatabase") {
      return (
        <PropertyDatabase
          onBack={handleBackToDashboard}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
          onOpenPortfolioDashboard={() => setCurrentView("portfolioDashboard")}
          onOpenPropertyDatabase={() => setCurrentView("propertyDatabase")}
        />
      );
    }

    if (currentView === "vendorDatabase") {
      return (
        <VendorDatabase
          onBack={handleBackToDashboard}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
          onOpenPortfolioDashboard={() => setCurrentView("portfolioDashboard")}
          onOpenPropertyDatabase={() => setCurrentView("propertyDatabase")}
          onOpenVendorDatabase={() => setCurrentView("vendorDatabase")}
        />
      );
    }

    if (currentView === "materialMatrix") {
      return (
        <MaterialMatrix
          onBack={handleBackToDashboard}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
          onOpenPortfolioDashboard={() => setCurrentView("portfolioDashboard")}
          onOpenPropertyDatabase={() => setCurrentView("propertyDatabase")}
          onOpenVendorDatabase={() => setCurrentView("vendorDatabase")}
        />
      );
    }

    if (currentView === "lenderDashboard") {
      return (
        <LenderDashboard
          onBack={handleBackToDashboard}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
          onOpenPortfolioDashboard={() => setCurrentView("portfolioDashboard")}
          onOpenPropertyDatabase={() => setCurrentView("propertyDatabase")}
          onOpenVendorDatabase={() => setCurrentView("vendorDatabase")}
          onOpenMaterialMatrix={() => setCurrentView("materialMatrix")}
        />
      );
    }

    if (currentView === "appraiserPacketBuilder") {
      return (
        <AppraiserPacketBuilder
          onBack={handleBackToDashboard}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
          onOpenPortfolioDashboard={() => setCurrentView("portfolioDashboard")}
          onOpenPropertyDatabase={() => setCurrentView("propertyDatabase")}
          onOpenVendorDatabase={() => setCurrentView("vendorDatabase")}
          onOpenMaterialMatrix={() => setCurrentView("materialMatrix")}
          onOpenLenderDashboard={() => setCurrentView("lenderDashboard")}
        />
      );
    }

    if (currentView === "rehabProjectTracker") {
      return (
        <RehabProjectTracker
          onBack={handleBackToDashboard}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
          onOpenProductVault={() => setCurrentView("productVault")}
          onOpenContractorHub={() => setCurrentView("contractorHub")}
          onOpenCompDatabase={() => setCurrentView("compDatabase")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
          onOpenPortfolioDashboard={() => setCurrentView("portfolioDashboard")}
          onOpenPropertyDatabase={() => setCurrentView("propertyDatabase")}
          onOpenVendorDatabase={() => setCurrentView("vendorDatabase")}
          onOpenMaterialMatrix={() => setCurrentView("materialMatrix")}
          onOpenLenderDashboard={() => setCurrentView("lenderDashboard")}
          onOpenAppraiserPacketBuilder={() => setCurrentView("appraiserPacketBuilder")}
        />
      );
    }

    return (
      <Dashboard
        onOpenDealIntake={handleOpenDealIntake}
        onOpenDealAnalyzer={() => navigateToView("dealAnalyzer")}
        onOpenFlipAnalyzer={() => navigateToView("flipAnalyzer")}
        onOpenBrrrrAnalyzer={() => navigateToView("brrrrAnalyzer")}
        onOpenProductVault={() => navigateToView("productVault")}
        onOpenContractorHub={() => navigateToView("contractorHub")}
        onOpenDealIntelligence={() => navigateToView("dealIntelligence")}
        onOpenKnowledgeBase={() => navigateToView("knowledgeBase")}
        onOpenCompDatabase={() => navigateToView("compDatabase")}
        onOpenNeighborhoodDatabase={() => navigateToView("neighborhoodDatabase")}
        onOpenPortfolioDashboard={() => navigateToView("portfolioDashboard")}
        onOpenPropertyDatabase={() => navigateToView("propertyDatabase")}
        onOpenVendorDatabase={() => navigateToView("vendorDatabase")}
        onOpenMaterialMatrix={() => navigateToView("materialMatrix")}
        onOpenLenderDashboard={() => navigateToView("lenderDashboard")}
        onOpenAppraiserPacketBuilder={() => navigateToView("appraiserPacketBuilder")}
        onOpenRehabProjectTracker={() => navigateToView("rehabProjectTracker")}
        currentView={currentView}
        onNavigate={navigateToView}
      />
    );
  })();

  return (
    <ErrorBoundary>
      <div className="rsos-app-shell" data-rsos-root>
        <div className="rsos-mobile-topbar" role="banner">
          <button
            type="button"
            className="rsos-mobile-menu-button"
            aria-label="Open navigation menu"
            aria-expanded={isMobileNavOpen}
            aria-controls="rsos-mobile-drawer"
            onClick={() => setIsMobileNavOpen(true)}
          >
            ☰
          </button>
          <strong className="rsos-mobile-topbar-title">RSOS</strong>
          {installActionVisible ? (
            <button type="button" className="rsos-mobile-install-button" onClick={handleInstallClick}>
              Install RSOS
            </button>
          ) : <span className="rsos-mobile-topbar-spacer" aria-hidden="true" />}
        </div>

        {isMobileNavOpen ? (
          <div className="rsos-mobile-drawer-overlay" onClick={() => setIsMobileNavOpen(false)} aria-hidden="true" />
        ) : null}

        <aside
          id="rsos-mobile-drawer"
          className={`rsos-mobile-drawer${isMobileNavOpen ? " is-open" : ""}`}
          aria-hidden={!isMobileNavOpen}
          ref={mobileDrawerRef}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="rsos-mobile-drawer-header">
            <strong>Royal Star Operating System</strong>
            <button type="button" onClick={() => setIsMobileNavOpen(false)} aria-label="Close navigation menu">✕</button>
          </div>
          <nav aria-label="Mobile RSOS navigation">
            {canonicalNavigation.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`rsos-mobile-nav-item${currentView === item.viewKey ? " is-active" : ""}`}
                onClick={() => navigateFromMobileDrawer(item.viewKey)}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          {installActionVisible ? (
            <button type="button" className="rsos-mobile-install-drawer-button" onClick={handleInstallClick}>
              Install RSOS
            </button>
          ) : null}
          {showIosInstallInstructions ? (
            <p className="rsos-ios-install-help">
              On iPhone/iPad: tap Share, then choose Add to Home Screen.
            </p>
          ) : null}
        </aside>

        {isOffline ? (
          <div className="rsos-offline-banner" role="status" aria-live="polite">
            RSOS is offline. Viewing cached interface only. Changes cannot be saved.
          </div>
        ) : null}

        {updateAvailable ? (
          <div className="rsos-update-banner" role="status" aria-live="polite">
            <span>A newer version of RSOS is available.</span>
            <button type="button" onClick={handleRefreshForUpdate}>Refresh to update</button>
          </div>
        ) : null}

        <Suspense fallback={<div className="rsos-loading-shell">Loading RSOS module...</div>}>
          {appContent}
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
