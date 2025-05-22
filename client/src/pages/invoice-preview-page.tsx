import { Layout } from "@/components/layout/layout";
import { StructuredInvoiceView } from "@/components/invoice/structured-invoice-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Check, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function InvoicePreviewPage() {
  return (
    <Layout title="Invoice Preview">
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Invoice Preview</h1>
          <div className="flex gap-2">
            <Link href="/invoices">
              <Button variant="outline">Back to Invoices</Button>
            </Link>
          </div>
        </div>
        
        <div className="mb-6">
          <Card>
            <CardHeader className="bg-muted/30">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Invoice #626000800
                  </CardTitle>
                  <CardDescription>
                    Uploaded on May 22, 2025
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1">
                    <Check className="h-4 w-4" />
                    Mark as Processed
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="mb-4 flex items-center gap-2 text-green-600 bg-green-50 border border-green-200 rounded-md p-2">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Successfully matched with PO #43121</span>
              </div>
              
              <StructuredInvoiceView showSampleData={true} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}