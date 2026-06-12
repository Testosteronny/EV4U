import { useEffect } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { CockpitProvider } from "./context/CockpitContext";
import { ListingsProvider } from "./context/ListingsContext";
import TopBar from "./components/TopBar";
import CompareTray from "./components/CompareTray";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Inserate from "./pages/Inserate";
import InseratDetail from "./pages/InseratDetail";
import RechenwerkPage from "./pages/RechenwerkPage";
import Vergleich from "./pages/Vergleich";
import Verkaufen from "./pages/Verkaufen";
import Konto from "./pages/Konto";

/* ============================================================================
   EV4U — Der Schweizer E-Auto-Marktplatz (Privat & Garage)
   ----------------------------------------------------------------------------
   Routes:
     /              storefront (hero + ZIP fix, doors, fresh listings, booking)
     /inserate      catalogue with URL-addressable filters
     /inserat/:id   listing dossier + embedded Rechenwerk
     /rechenwerk    standalone engine (acquisition → funnels to listings)
     /vergleich     listing-level comparison (?ids=a,b,c shareable)
     /verkaufen     supply side: post an ad
   CockpitProvider persists tariff/listing/sim inputs across all of them.
   ============================================================================ */

/** Scroll to top on route change; hash links (e.g. /#beratung) are handled
 *  by the target page. */
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}

export default function App() {
  return (
    <ListingsProvider>
      <CockpitProvider>
        <BrowserRouter>
          <ScrollToTop />
          <div className="grain relative flex min-h-screen flex-col overflow-x-clip bg-nacht text-ink">
            <TopBar />
            <main className="flex-1 pt-16">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/inserate" element={<Inserate />} />
                <Route path="/inserat/:id" element={<InseratDetail />} />
                <Route path="/rechenwerk" element={<RechenwerkPage />} />
                <Route path="/vergleich" element={<Vergleich />} />
                <Route path="/verkaufen" element={<Verkaufen />} />
                <Route path="/konto" element={<Konto />} />
                <Route path="*" element={<Home />} />
              </Routes>
            </main>
            <CompareTray />
            <Footer />
          </div>
        </BrowserRouter>
      </CockpitProvider>
    </ListingsProvider>
  );
}
