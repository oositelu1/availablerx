import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import UploadPage from "@/pages/upload-page";
import PartnersPage from "@/pages/partners-page";
import PartnerDetailPage from "@/pages/partner-detail-page";
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
import ScannerTestPage from "@/pages/scanner-test-page";
import QrTest from "@/pages/qr-test";
import InventoryDashboard from "@/pages/inventory/index";
import ScanProductInPage from "@/pages/inventory/scan-in";
import ScanProductOutPage from "@/pages/inventory/scan-out";
import InventoryLedgerPage from "@/pages/inventory/ledger";
import T3ListPage from "@/pages/t3-list-page";
import T3Page from "@/pages/t3-page";
import T3CreatePage from "@/pages/t3-create-page";
import T3LedgerPage from "@/pages/t3-ledger-page";
import EnhancedT3Page from "@/pages/enhanced-t3-page";
import MultiPageT3View from "@/pages/multi-page-t3-view";
import InvoiceUploadPage from "@/pages/invoice-upload-page";
import InvoicePreviewPage from "@/pages/invoice-preview-page";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "next-themes";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/upload" component={UploadPage} />
      <ProtectedRoute path="/partners" component={PartnersPage} />
      <ProtectedRoute path="/partners/:id" component={PartnerDetailPage} />
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
      
      {/* Original inventory pages */}
      <ProtectedRoute path="/inventory-original" component={InventoryPage} />
      <ProtectedRoute path="/inventory-original/add" component={AddInventoryPage} />
      
      {/* New streamlined inventory workflows */}
      <ProtectedRoute path="/inventory" component={InventoryDashboard} />
      <ProtectedRoute path="/inventory/scan-in" component={ScanProductInPage} />
      <ProtectedRoute path="/inventory/scan-out" component={ScanProductOutPage} />
      <ProtectedRoute path="/inventory/ledger" component={InventoryLedgerPage} />
      
      {/* T3 Document Pages */}
      <ProtectedRoute path="/t3" component={T3ListPage} />
      <ProtectedRoute path="/t3/create" component={T3CreatePage} />
      <ProtectedRoute path="/t3/ledger" component={T3LedgerPage} />
      <ProtectedRoute path="/t3/enhanced/:bundleId" component={EnhancedT3Page} />
      <ProtectedRoute path="/t3/multi-page/:bundleId" component={MultiPageT3View} />
      <ProtectedRoute path="/t3/:bundleId" component={T3Page} />
      
      {/* Invoice Management */}
      <ProtectedRoute path="/invoices/upload" component={InvoiceUploadPage} />
      <ProtectedRoute path="/invoices/preview" component={InvoicePreviewPage} />
      
      <Route path="/qr-test" component={QrTest} />
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
