import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

// Layout & Components
import { AppLayout } from "./components/layout";
import NotFound from "@/pages/not-found";

// Pages
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Clients from "./pages/clients";
import ClientDetail from "./pages/client-detail";
import Engagements from "./pages/engagements";
import EngagementWorkspace from "./pages/engagement-workspace";
import KnowledgeVault from "./pages/vault";
import AiSettings from "./pages/ai-settings";
import TaxRules from "./pages/tax-rules";
import AuditLogs from "./pages/audit-logs";
import UsersPage from "./pages/users";
import ProfilePage from "./pages/profile";

// Configure API client: use relative /api (proxied by Vite to API server)
setBaseUrl("");
setAuthTokenGetter(() => localStorage.getItem("tax_engine_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: any }) {
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes wrapped in AppLayout */}
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={Clients} />} />
      <Route path="/clients/:id" component={() => <ProtectedRoute component={ClientDetail} />} />
      <Route path="/engagements" component={() => <ProtectedRoute component={Engagements} />} />
      <Route path="/engagements/:id" component={() => <ProtectedRoute component={EngagementWorkspace} />} />
      <Route path="/rules" component={() => <ProtectedRoute component={TaxRules} />} />
      <Route path="/audit" component={() => <ProtectedRoute component={AuditLogs} />} />
      <Route path="/users" component={() => <ProtectedRoute component={UsersPage} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={ProfilePage} />} />
      <Route path="/vault" component={() => <ProtectedRoute component={KnowledgeVault} />} />
      <Route path="/ai-settings" component={() => <ProtectedRoute component={AiSettings} />} />
      
      {/* Missing implementation placeholders falling back to not found nicely */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
