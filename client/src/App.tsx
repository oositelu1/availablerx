import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import UploadPage from "@/pages/upload-page";
import PartnersPage from "@/pages/partners-page";
import FileHistoryPage from "@/pages/file-history-page";
import FileDetailPage from "@/pages/file-detail-page";
import ProductItemsPage from "@/pages/product-items-page";
import SettingsPage from "@/pages/settings-page";
import AuthPage from "@/pages/auth-page";
import PurchaseOrdersPage from "@/pages/purchase-orders-page";
import PurchaseOrderDetailPage from "@/pages/purchase-order-detail-page";
import ValidationSessionPage from "@/pages/validation-session-page";
import SalesOrdersPage from "@/pages/sales-orders-page";
import SalesOrderDetailPage from "@/pages/sales-order-detail-page";
import InventoryPage from "@/pages/inventory-page";
import AddInventoryPage from "@/pages/add-inventory-page";
import DirectSalesOrderForm from "@/pages/direct-sales-order-form";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "next-themes";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/upload" component={UploadPage} />
      <ProtectedRoute path="/partners" component={PartnersPage} />
      <ProtectedRoute path="/files" component={FileHistoryPage} />
      <ProtectedRoute path="/files/:id" component={FileDetailPage} />
      <ProtectedRoute path="/product-items/file/:fileId" component={ProductItemsPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/purchase-orders" component={PurchaseOrdersPage} />
      <ProtectedRoute path="/purchase-orders/:id" component={PurchaseOrderDetailPage} />
      <ProtectedRoute path="/purchase-orders/:id/validate" component={ValidationSessionPage} />
      <ProtectedRoute path="/sales-orders" component={SalesOrdersPage} />
      <ProtectedRoute path="/create-sales-order" component={DirectSalesOrderForm} />
      <ProtectedRoute path="/sales-orders/:id" component={SalesOrderDetailPage} />
      <ProtectedRoute path="/inventory" component={InventoryPage} />
      <ProtectedRoute path="/inventory/add" component={AddInventoryPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        <Router />
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
