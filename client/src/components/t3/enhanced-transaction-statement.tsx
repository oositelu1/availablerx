import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, CheckCircle, ShieldCheck } from "lucide-react";

interface CompanyInfo {
  name: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contactInfo?: {
    phone?: string;
    email?: string;
  };
}

interface EnhancedTransactionStatementProps {
  company: CompanyInfo;
  statement: string;
  transactionDate: string;
  signature?: string;
  additionalStatements?: string[];
}

export function EnhancedTransactionStatement({ 
  company, 
  statement, 
  transactionDate,
  signature,
  additionalStatements 
}: EnhancedTransactionStatementProps) {
  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction Statement</h2>
      
      <Card className="overflow-hidden">
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            DSCSA Compliance Statement
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-6">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{statement}</p>
              <p className="text-sm text-muted-foreground mt-1">
                Statement provided by {company.name} on {formatDate(transactionDate)}
              </p>
            </div>
          </div>

          {additionalStatements && additionalStatements.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-sm font-medium mb-4">Additional Compliance Statements</h3>
              <div className="space-y-4">
                {additionalStatements.map((additionalStatement, index) => (
                  <div key={`statement-${index}`} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{additionalStatement}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {signature && (
            <div className="mt-6 border-t pt-4">
              <div className="flex justify-between items-end">
                <div>
                  <h3 className="text-sm font-medium">Authorized Signature</h3>
                  <p className="mt-1">{signature}</p>
                </div>
                <div className="text-xs text-muted-foreground">
                  Document generated on {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="p-4 bg-primary/5 rounded-md border text-sm">
            <h3 className="font-medium flex items-center gap-2 mb-2">
              <FileText className="h-4 w-4" />
              About DSCSA Compliance
            </h3>
            <p className="mb-2">
              The Drug Supply Chain Security Act (DSCSA) requires trading partners to provide the subsequent purchaser with 
              product tracing information, including Transaction Information (TI), Transaction History (TH), and Transaction 
              Statement (TS).
            </p>
            <p>
              FDCA Sec. 581 (27) (A)-(G) outlines requirements for transaction statements, confirming that entities are 
              authorized under the law, received the product from an authorized party, received transaction information 
              and history, did not knowingly ship suspect or illegitimate product, had systems in place to comply with 
              verification requirements, and did not knowingly provide false transaction information.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}