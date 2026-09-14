import { lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
} from "react-router-dom";
import Login from "./pages/Login";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

// Code-splitting : pages lourdes chargées à la demande (Login reste eager
// pour la première peinture).
const Dashboard = lazy(() => import("./pages/Dashboard"));
const GuildDashboard = lazy(() => import("./pages/GuildDashboard"));
const Doc = lazy(() => import("./pages/Doc"));

// Fallback plein écran cohérent avec le thème (spinner accent sur fond sombre).
function PageFallback() {
  return (
    <div
      role="status"
      aria-busy="true"
      className="min-h-screen w-full flex flex-col items-center justify-center gap-4 bg-[#0a0a0f]"
    >
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-white/10"
        style={{ borderTopColor: "#7c5cff" }}
        aria-hidden="true"
      />
      <span className="sr-only">Chargement...</span>
    </div>
  );
}

function AppShell({ children }) {
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 overflow-x-hidden antialiased">
      <div className="relative isolate animate-fadeIn">{children}</div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold tracking-tight text-white">
        Page introuvable
      </h1>
      <p className="text-sm text-zinc-500">
        La page demandée n'existe pas ou a été déplacée.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex items-center justify-center px-4 h-10 rounded-lg text-sm font-medium text-white transition-transform hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7c5cff] focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950"
        style={{ backgroundColor: "#7c5cff" }}
      >
        Retour à l'accueil
      </Link>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AppShell>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/:guildId" element={<GuildDashboard />} />
              <Route path="/doc" element={<Doc />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
