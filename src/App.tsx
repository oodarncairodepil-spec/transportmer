import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Fleet from "@/pages/Fleet";
import Drivers from "@/pages/Drivers";
import RoutesPage from "@/pages/Routes";
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
      <BrowserRouter>
        <Routes>
          <Route path="*" element={
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
                <Route path="*" element={<NotFound />} />
              </Routes>
            </DashboardLayout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
