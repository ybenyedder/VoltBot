import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import GuildDashboard from "./pages/GuildDashboard";
import Doc from "./pages/Doc";
import ErrorBoundary from "./components/ErrorBoundary";
import "./App.css";

function AppShell({ children }) {
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 overflow-x-hidden antialiased">
      <div className="relative isolate animate-fadeIn">{children}</div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AppShell>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/:guildId" element={<GuildDashboard />} />
            <Route path="/doc" element={<Doc />} />
          </Routes>
        </AppShell>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
