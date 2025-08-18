import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenantContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { navItems } from "./nav-items";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import UserManagement from "./pages/UserManagement";
import TournamentEmbed from "./pages/TournamentEmbed";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
          <Routes>
            <Route path="/auth" element={
              <AppLayout showUserMenu={false}>
                <Auth />
              </AppLayout>
            } />
            <Route path="/tournaments/:id/embed" element={
              <AppLayout showUserMenu={false}>
                <TournamentEmbed />
              </AppLayout>
            } />
            <Route path="/user-management" element={
              <ProtectedRoute>
                <AppLayout>
                  <UserManagement />
                </AppLayout>
              </ProtectedRoute>
            } />
            {navItems.map(({ to, page }) => (
              <Route key={to} path={to} element={
                <ProtectedRoute>
                  <AppLayout>
                    {page}
                  </AppLayout>
                </ProtectedRoute>
              } />
            ))}
            <Route path="*" element={
              <AppLayout showUserMenu={false}>
                <NotFound />
              </AppLayout>
            } />
          </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
