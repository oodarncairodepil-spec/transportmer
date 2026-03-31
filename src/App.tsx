import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import { AuthProvider } from "@/components/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import RequireAdmin from "@/components/RequireAdmin";
import Dashboard from "@/pages/Dashboard";
import Fleet from "@/pages/Fleet";
import Drivers from "@/pages/Drivers";
import RoutesPage from "@/pages/Routes";
import Login from "@/pages/Login";
import ForceChangePassword from "@/pages/ForceChangePassword";
import ResetPassword from "@/pages/ResetPassword";
import AdminStaff from "@/pages/AdminStaff";
import WorkOrders from "@/pages/WorkOrders";
import Maintenance from "@/pages/Maintenance";
import Scheduling from "@/pages/Scheduling";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/force-change-password"
              element={
                <RequireAuth allowPasswordChange>
                  <ForceChangePassword />
                </RequireAuth>
              }
            />
            <Route
              path="*"
              element={
                <RequireAuth>
                  <DashboardLayout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/fleet" element={<Fleet />} />
                      <Route path="/drivers" element={<Drivers />} />
                      <Route path="/routes" element={<RoutesPage />} />
                      <Route path="/work-orders" element={<WorkOrders />} />
                      <Route path="/maintenance" element={<Maintenance />} />
                      <Route path="/scheduling" element={<Scheduling />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route
                        path="/admin/staff"
                        element={
                          <RequireAdmin>
                            <AdminStaff />
                          </RequireAdmin>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </DashboardLayout>
                </RequireAuth>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
