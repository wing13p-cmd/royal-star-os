import { useEffect, useState } from "react";
import "./App.css";
import Dashboard from "./components/Dashboard";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { buildApiUrl } from "./utils/apiClient";
import { version } from "./version";
import { resolveBackendStatus } from "./utils/backendHealthStatus";
import DealAnalyzer from "./components/DealAnalyzer";
import DealIntake from "./components/DealIntake";
import DealIntelligence from "./components/DealIntelligence";
import FlipAnalyzer from "./components/FlipAnalyzer";
import BrrrrAnalyzer from "./components/BrrrrAnalyzer";
import ProductVault from "./components/ProductVault";
import ContractorHub from "./components/ContractorHub";
import CompDatabase from "./components/CompDatabase";
import NeighborhoodDatabase from "./components/NeighborhoodDatabase";
import PortfolioDashboard from "./components/PortfolioDashboard";
import PropertyDatabase from "./components/PropertyDatabase";
import VendorDatabase from "./components/VendorDatabase";
import MaterialMatrix from "./components/MaterialMatrix";
import LenderDashboard from "./components/LenderDashboard";
import AppraiserPacketBuilder from "./components/AppraiserPacketBuilder";
import RehabProjectTracker from "./components/RehabProjectTracker";

export default function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [systemStatus, setSystemStatus] = useState("System Healthy");

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;

    const checkBackend = async () => {
      try {
        const response = await fetch(buildApiUrl("/api/health"));
        const payload = response.ok ? await response.json() : null;

        if (!cancelled) {
          setSystemStatus(resolveBackendStatus(payload, !response.ok));
        }
      } catch {
        if (!cancelled) {
          setSystemStatus(resolveBackendStatus(null, true));
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
    setCurrentView("dealIntake");
  };

  const handleBackToDashboard = () => {
    setSelectedDeal(null);
    setCurrentView("dashboard");
  };

  const appContent = (() => {
    if (currentView === "dealIntake") {
      return <DealIntake dealToEdit={selectedDeal} onBack={handleBackToDashboard} />;
    }

    if (currentView === "dealAnalyzer") {
      return (
        <DealAnalyzer
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
          onEditDeal={(deal) => handleOpenDealIntake(deal)}
        />
      );
    }

    if (currentView === "dealIntelligence") {
      return <DealIntelligence onBack={handleBackToDashboard} />;
    }

    if (currentView === "flipAnalyzer") {
      return (
        <FlipAnalyzer
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
        />
      );
    }

    if (currentView === "brrrrAnalyzer") {
      return (
        <BrrrrAnalyzer
          onBack={handleBackToDashboard}
          onOpenDealIntake={() => handleOpenDealIntake(null)}
          onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
          onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
          onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
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
        onOpenDealAnalyzer={() => setCurrentView("dealAnalyzer")}
        onOpenFlipAnalyzer={() => setCurrentView("flipAnalyzer")}
        onOpenBrrrrAnalyzer={() => setCurrentView("brrrrAnalyzer")}
        onOpenProductVault={() => setCurrentView("productVault")}
        onOpenContractorHub={() => setCurrentView("contractorHub")}
        onOpenDealIntelligence={() => setCurrentView("dealIntelligence")}
        onOpenCompDatabase={() => setCurrentView("compDatabase")}
        onOpenNeighborhoodDatabase={() => setCurrentView("neighborhoodDatabase")}
        onOpenPortfolioDashboard={() => setCurrentView("portfolioDashboard")}
        onOpenPropertyDatabase={() => setCurrentView("propertyDatabase")}
        onOpenVendorDatabase={() => setCurrentView("vendorDatabase")}
        onOpenMaterialMatrix={() => setCurrentView("materialMatrix")}
        onOpenLenderDashboard={() => setCurrentView("lenderDashboard")}
        onOpenAppraiserPacketBuilder={() => setCurrentView("appraiserPacketBuilder")}
        onOpenRehabProjectTracker={() => setCurrentView("rehabProjectTracker")}
      />
    );
  })();

  return <ErrorBoundary>{appContent}</ErrorBoundary>;
}