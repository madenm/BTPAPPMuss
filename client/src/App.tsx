import { useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalBackground } from "@/components/GlobalBackground";
import { ChantiersProvider } from "@/context/ChantiersContext";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ProtectedTeamRoute } from "@/components/ProtectedTeamRoute";
import { AnimatePresence, motion } from "framer-motion";
import Home from "@/pages/Home";
import AuthPage from "@/pages/AuthPage";
import LoginPage from "@/pages/LoginPage";
import LoadingRedirectPage from "@/pages/LoadingRedirectPage";
import InvitePage from "@/pages/InvitePage";
import TeamDashboard from "@/pages/TeamDashboard";
import Dashboard from "@/pages/Dashboard";
import QuotesPage from "@/pages/QuotesPage";
import AIVisualizationPage from "@/pages/AIVisualizationPage";
import ProspectsPage from "@/pages/ProspectsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import PlanningPage from "@/pages/PlanningPage";
import EstimationPage from "@/pages/EstimationPage";
import ClientsPage from "@/pages/ClientsPage";
import CRMPipelinePage from "@/pages/CRMPipelinePage";
import TeamPage from "@/pages/TeamPage";
import SettingsPage from "@/pages/SettingsPage";
import InvoicesPage from "@/pages/InvoicesPage";
import NotFound from "@/pages/not-found";
import { UserSettingsProvider } from "@/context/UserSettingsContext";

const pageVariants = {
  initial: {
    opacity: 0,
    y: 20,
    scale: 0.98
  },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -20,
    scale: 0.98,
    transition: {
      duration: 0.3,
      ease: [0.22, 1, 0.36, 1]
    }
  }
};

function Router() {
  const [location] = useLocation();

  const getComponent = () => {
    // Vérifier si c'est une route d'invitation
    if (location.startsWith('/invite/')) {
      return <InvitePage />;
    }

    switch (location) {
      case "/":
        return <Home />;
      case "/auth":
        return <AuthPage />;
      case "/login":
        return <LoginPage />;
      case "/loading":
        return <LoadingRedirectPage />;
      case "/team-dashboard":
      case "/team-dashboard/projects":
      case "/team-dashboard/planning":
        return <ProtectedTeamRoute><TeamDashboard /></ProtectedTeamRoute>;
      case "/dashboard":
        return <ProtectedRoute><Dashboard /></ProtectedRoute>;
      case "/dashboard/estimation":
        return <ProtectedRoute><EstimationPage /></ProtectedRoute>;
      case "/dashboard/quotes":
        return <ProtectedRoute><QuotesPage /></ProtectedRoute>;
      case "/dashboard/ai-visualization":
        return <ProtectedRoute><AIVisualizationPage /></ProtectedRoute>;
      case "/dashboard/prospects":
        return <ProtectedRoute><ProspectsPage /></ProtectedRoute>;
      case "/dashboard/projects":
        return <ProtectedRoute><ProjectsPage /></ProtectedRoute>;
      case "/dashboard/clients":
        return <ProtectedRoute><ClientsPage /></ProtectedRoute>;
      case "/dashboard/invoices":
        return <ProtectedRoute><InvoicesPage /></ProtectedRoute>;
      case "/dashboard/planning":
        return <ProtectedRoute><PlanningPage /></ProtectedRoute>;
      case "/dashboard/crm":
        return <ProtectedRoute><CRMPipelinePage /></ProtectedRoute>;
      case "/dashboard/team":
        return <ProtectedRoute><TeamPage /></ProtectedRoute>;
      case "/dashboard/settings":
        return <ProtectedRoute><SettingsPage /></ProtectedRoute>;
      default:
        return <NotFound />;
    }
  };

  // Pages without sidebar (Home, Auth, Login, Loading, Invite) get full page animation
  const isFullPage = location === "/" || location === "/auth" || location === "/login" || location === "/loading" || location.startsWith("/invite/");

  if (isFullPage) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={location}
          initial="initial"
          animate="animate"
          exit="exit"
          variants={pageVariants}
          className="w-full h-full"
        >
          {getComponent()}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Pages with sidebar - animation handled in PageWrapper or Dashboard
  return <>{getComponent()}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ChantiersProvider>
          <UserSettingsProvider>
            <TooltipProvider>
              <GlobalBackground />
              <Toaster />
              <Router />
            </TooltipProvider>
          </UserSettingsProvider>
        </ChantiersProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
