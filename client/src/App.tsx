import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { PageLoader } from "@/components/loading-spinner";
import NotFound from "@/pages/not-found";
import Welcome from "@/pages/welcome";
import Login from "@/pages/login";
import Register from "@/pages/register";
import MapPage from "@/pages/map-page";
import DriverDashboard from "@/pages/driver-dashboard";
import Reservations from "@/pages/reservations";
import ReportIssue from "@/pages/report-issue";
import Profile from "@/pages/profile";

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Redirect to="/map" />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <PageLoader />;
  }

  if (user) {
    return <Redirect to={user.role === "driver" ? "/driver" : "/map"} />;
  }

  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <PublicRoute>
          <Welcome />
        </PublicRoute>
      </Route>
      
      <Route path="/login">
        <PublicRoute>
          <Login />
        </PublicRoute>
      </Route>
      
      <Route path="/register">
        <PublicRoute>
          <Register />
        </PublicRoute>
      </Route>
      
      <Route path="/map">
        <ProtectedRoute>
          <MapPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/driver">
        <ProtectedRoute allowedRoles={["driver"]}>
          <DriverDashboard />
        </ProtectedRoute>
      </Route>
      
      <Route path="/reservations">
        <ProtectedRoute allowedRoles={["citizen"]}>
          <Reservations />
        </ProtectedRoute>
      </Route>
      
      <Route path="/report">
        <ProtectedRoute>
          <ReportIssue />
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute>
          <Profile />
        </ProtectedRoute>
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
