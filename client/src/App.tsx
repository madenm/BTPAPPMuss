import { lazy, Suspense } from "react";
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
import ClientFormPage from "@/pages/ClientFormPage";
import SignQuotePage from "@/pages/SignQuotePage";
import NotFound from "@/pages/not-found";
import { UserSettingsProvider } from "@/context/UserSettingsContext";

const TeamDashboard = lazy(() => import("@/pages/TeamDashboard"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const QuotesPage = lazy(() => import("@/pages/QuotesPage"));
const EstimationPage = lazy(() => import("@/pages/EstimationPage"));
const TarifsPage = lazy(() => import("@/pages/TarifsPage"));
const AIVisualizationPage = lazy(() => import("@/pages/AIVisualizationPage"));
const ProspectsPage = lazy(() => import("@/pages/ProspectsPage"));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"));
const PlanningPage = lazy(() => import("@/pages/PlanningPage"));
const ClientsPage = lazy(() => import("@/pages/ClientsPage"));
const InvoicesPage = lazy(() => import("@/pages/InvoicesPage"));
const CRMPipelinePage = lazy(() => import("@/pages/CRMPipelinePage"));
const TeamPage = lazy(() => import("@/pages/TeamPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const CreateUserPage = lazy(() => import("@/pages/CreateUserPage"));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[280px] text-gray-500 dark:text-gray-400">
    Chargement…
  </div>
);

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
  const pathname = location.includes('?') ? location.slice(0, location.indexOf('?')) : location;

  const getComponent = () => {
    // Routes publiques (sans auth)
    if (pathname.startsWith('/invite/')) {
      return <InvitePage />;
    }
    if (pathname.startsWith('/client-form/')) {
      return <ClientFormPage />;
    }
    if (pathname.startsWith('/sign-quote/')) {
      return <SignQuotePage />;
    }

    // Routes privées dynamiques
    if (pathname.startsWith('/dashboard/projects/') && pathname !== '/dashboard/projects') {
      return <ProtectedRoute><Suspense fallback={<PageFallback />}><ProjectDetailPage /></Suspense></ProtectedRoute>;
    }

    switch (pathname) {
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
      case "/team-dashboard/quotes":
      case "/team-dashboard/crm":
      case "/team-dashboard/invoices":
      case "/team-dashboard/team":
      case "/team-dashboard/clients":
      case "/team-dashboard/ai-visualization":
        return <ProtectedTeamRoute><Suspense fallback={<PageFallback />}><TeamDashboard /></Suspense></ProtectedTeamRoute>;
      case "/dashboard":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><Dashboard /></Suspense></ProtectedRoute>;
      case "/dashboard/estimation":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><EstimationPage /></Suspense></ProtectedRoute>;
      case "/dashboard/quotes":
      case "/dashboard/quotes/new":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><QuotesPage /></Suspense></ProtectedRoute>;
      case "/dashboard/tarifs":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><TarifsPage /></Suspense></ProtectedRoute>;
      case "/dashboard/ai-visualization":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><AIVisualizationPage /></Suspense></ProtectedRoute>;
      case "/dashboard/prospects":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><ProspectsPage /></Suspense></ProtectedRoute>;
      case "/dashboard/projects":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><ProjectsPage /></Suspense></ProtectedRoute>;
      case "/dashboard/clients":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><ClientsPage /></Suspense></ProtectedRoute>;
      case "/dashboard/invoices":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><InvoicesPage /></Suspense></ProtectedRoute>;
      case "/dashboard/planning":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><PlanningPage /></Suspense></ProtectedRoute>;
      case "/dashboard/crm":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><CRMPipelinePage /></Suspense></ProtectedRoute>;
      case "/dashboard/team":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><TeamPage /></Suspense></ProtectedRoute>;
      case "/dashboard/settings":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><SettingsPage /></Suspense></ProtectedRoute>;
      case "/dashboard/create-user":
        return <ProtectedRoute><Suspense fallback={<PageFallback />}><CreateUserPage /></Suspense></ProtectedRoute>;
      default:
        return <NotFound />;
    }
  };

  // Pages without sidebar (Home, Auth, Login, Loading, Invite, Client form) get full page animation
  const isFullPage = location === "/" || location === "/auth" || location === "/login" || location === "/loading" || location.startsWith("/invite/") || location.startsWith("/client-form/") || location.startsWith("/sign-quote/");

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
