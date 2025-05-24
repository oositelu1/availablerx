import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { ProtectedRoute } from "./lib/protected-route";

// Critical pages loaded immediately
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";

// Lazy load all other pages
const UploadPage = lazy(() => import("@/pages/upload-page"));
const PartnersPage = lazy(() => import("@/pages/partners-page"));
const PartnerDetailPage = lazy(() => import("@/pages/partner-detail-page"));
const FileHistoryPage = lazy(() => import("@/pages/file-history-page"));
const FileDetailPage = lazy(() => import("@/pages/file-detail-page"));
const ProductItemsPage = lazy(() => import("@/pages/product-items-page"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));
const PurchaseOrdersPage = lazy(() => import("@/pages/purchase-orders-page"));
const PurchaseOrderDetailPage = lazy(() => import("@/pages/purchase-order-detail-page"));
const ValidationSessionPage = lazy(() => import("@/pages/validation-session-page"));
const SalesOrdersPage = lazy(() => import("@/pages/sales-orders-page"));
const SalesOrderDetailPage = lazy(() => import("@/pages/sales-order-detail-page"));
const InventoryPage = lazy(() => import("@/pages/inventory-page"));
const AddInventoryPage = lazy(() => import("@/pages/add-inventory-page"));
const DirectSalesOrderForm = lazy(() => import("@/pages/direct-sales-order-form"));
const ScannerTestPage = lazy(() => import("@/pages/scanner-test-page"));
const QrTest = lazy(() => import("@/pages/qr-test"));

// Heavy inventory pages
const InventoryDashboard = lazy(() => import("@/pages/inventory/index"));
const ScanProductInPage = lazy(() => import("@/pages/inventory/scan-in"));
const ScanProductOutPage = lazy(() => import("@/pages/inventory/scan-out"));
const InventoryLedgerPage = lazy(() => import("@/pages/inventory/ledger"));

// Heavy T3 document pages
const T3ListPage = lazy(() => import("@/pages/t3-list-page"));
const T3Page = lazy(() => import("@/pages/t3-page"));
const T3CreatePage = lazy(() => import("@/pages/t3-create-page"));
const T3LedgerPage = lazy(() => import("@/pages/t3-ledger-page"));
const EnhancedT3Page = lazy(() => import("@/pages/enhanced-t3-page"));
const MultiPageT3View = lazy(() => import("@/pages/multi-page-t3-view"));

// Invoice pages
const InvoiceUploadPage = lazy(() => import("@/pages/invoice-upload-page"));
const InvoicePreviewPage = lazy(() => import("@/pages/invoice-preview-page"));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
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
        <ProtectedRoute path="/validation-session/:id" component={ValidationSessionPage} />
        <ProtectedRoute path="/inventory" component={InventoryDashboard} />
        <ProtectedRoute path="/inventory/add" component={AddInventoryPage} />
        <ProtectedRoute path="/inventory/scan-in" component={ScanProductInPage} />
        <ProtectedRoute path="/inventory/scan-out" component={ScanProductOutPage} />
        <ProtectedRoute path="/inventory/ledger" component={InventoryLedgerPage} />
        <ProtectedRoute path="/sales-orders" component={SalesOrdersPage} />
        <ProtectedRoute path="/sales-orders/new" component={DirectSalesOrderForm} />
        <ProtectedRoute path="/sales-orders/:id" component={SalesOrderDetailPage} />
        <ProtectedRoute path="/test/scanner" component={ScannerTestPage} />
        <ProtectedRoute path="/test/qr" component={QrTest} />
        <ProtectedRoute path="/t3" component={T3ListPage} />
        <ProtectedRoute path="/t3/create" component={T3CreatePage} />
        <ProtectedRoute path="/t3/ledger" component={T3LedgerPage} />
        <ProtectedRoute path="/t3/:id" component={T3Page} />
        <ProtectedRoute path="/t3/:id/enhanced" component={EnhancedT3Page} />
        <ProtectedRoute path="/t3/:id/multipage" component={MultiPageT3View} />
        <ProtectedRoute path="/invoices/upload" component={InvoiceUploadPage} />
        <ProtectedRoute path="/invoices/:id/preview" component={InvoicePreviewPage} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" storageKey="document-tracker-theme">
      <TooltipProvider>
        <Router />
      </TooltipProvider>
    </ThemeProvider>
  );
}