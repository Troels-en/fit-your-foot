import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useSearchParams } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "./pages/Home.tsx";
import Catalog from "./pages/Catalog.tsx";
import ShoeDetail from "./pages/ShoeDetail.tsx";
import Scan from "./pages/Scan.tsx";
import Profile from "./pages/Profile.tsx";
import About from "./pages/About.tsx";
import Auth from "./pages/Auth.tsx";
import AuthEmailBestaetigen from "./pages/AuthEmailBestaetigen.tsx";
import Warteliste from "./pages/Warteliste.tsx";
import NotFound from "./pages/NotFound.tsx";
import RetailerProduct from "./pages/RetailerProduct.tsx";
import MobileScan from "./pages/MobileScan.tsx";
import PitchDeck from "@/components/PitchDeck";
import InternalGate from "./components/InternalGate.tsx";
import ScrollToHashOrTop from "./components/ScrollToHashOrTop.tsx";
import Kontakt from "./pages/Kontakt.tsx";
import AuthGate from "./components/AuthGate.tsx";
import PhotogrammetryTest from "./pages/PhotogrammetryTest.tsx";

const queryClient = new QueryClient();

// Retailer-Demo (Keller-Branding) ist nur via Direkt-Link mit ?demo=keller erreichbar
// und zusätzlich hinter dem geteilten Demo-Passwort. NICHT durch AuthGate (B2B-Demo).
function GatedRetailerProduct() {
  const [params] = useSearchParams();
  if (params.get("demo") !== "keller") return <NotFound />;
  return <InternalGate><RetailerProduct /></InternalGate>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <ScrollToHashOrTop />
        <Routes>
          {/* Public — Auth/Onboarding */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/email-bestaetigen" element={<AuthEmailBestaetigen />} />
          <Route path="/warteliste" element={<Warteliste />} />

          {/* Public — Erreichbar ohne Account */}
          <Route path="/kontakt" element={<Kontakt />} />

          {/* Public — B2B/Internal (eigene Auth-Mechanik) */}
          <Route path="/pitch" element={<InternalGate><PitchDeck /></InternalGate>} />
          <Route path="/produkt/:slug" element={<GatedRetailerProduct />} />

          {/* Public — QR-Mobile-Scan-Flow (kommt vom QR, kein Account nötig) */}
          <Route path="/scan/:sessionId" element={<MobileScan />} />
          {/* Public — Photogrammetry-Spike-Test-Page, nur für Dev/Test */}
          <Route path="/scan/photogrammetry-test" element={<PhotogrammetryTest />} />

          {/* Behind AuthGate — alle Fitly-User-Pages */}
          <Route path="/" element={<AuthGate><Home /></AuthGate>} />
          <Route path="/shoes" element={<AuthGate><Catalog /></AuthGate>} />
          <Route path="/shoes/:slug" element={<AuthGate><ShoeDetail /></AuthGate>} />
          <Route path="/scan" element={<AuthGate><Scan /></AuthGate>} />
          <Route path="/profile" element={<AuthGate><Profile /></AuthGate>} />
          <Route path="/about" element={<AuthGate><About /></AuthGate>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
