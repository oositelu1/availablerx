import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, User, Calendar, Shield } from "lucide-react";

// Define the Transaction Statement props interface
interface TransactionStatementProps {
  statement: {
    id?: number;
    certification?: string;
    statements?: string[];
    signature?: {
      signedBy: string;
      title: string;
      signatureDate: string | Date;
    };
    signedBy?: string;
    signerTitle?: string;
    signerCompany?: string;
    signatureDate?: string | Date;
  };
}

export function TransactionStatementDisplay({ statement }: TransactionStatementProps) {
  if (!statement) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">No Transaction Statement Available</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Format date for display
  const formatDate = (dateInput?: string | Date) => {
    if (!dateInput) return "Not specified";
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleDateString();
  };

  // Get signature details from either format
  const signedBy = statement.signature?.signedBy || statement.signedBy || "Not specified";
  const signerTitle = statement.signature?.title || statement.signerTitle || "Not specified";
  const signerCompany = statement.signerCompany || "Not specified";
  const signatureDate = statement.signature?.signatureDate || statement.signatureDate;

  // Get statements array or create from certification string
  const statementsList = statement.statements || 
    (statement.certification ? [statement.certification] : []);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction Statement (TS)</h2>
      <p className="text-muted-foreground">
        The Transaction Statement contains the required DSCSA certifications that must accompany each transaction.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="h-5 w-5" />
            DSCSA Certifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 bg-primary/5 rounded-md border">
            {statementsList.length > 0 ? (
              <ul className="space-y-3">
                {statementsList.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{item}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">No statement certifications provided.</p>
            )}
          </div>
          
          <div className="pt-4 border-t">
            <h3 className="text-lg font-medium mb-4">Signature</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Signed By
                </p>
                <p className="font-semibold">{signedBy}</p>
                <p className="text-sm text-muted-foreground">{signerTitle}</p>
                {signerCompany && (
                  <p className="text-sm text-muted-foreground">{signerCompany}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Signature Date
                </p>
                <p>{formatDate(signatureDate)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <div className="bg-muted p-4 rounded-md">
        <p className="text-sm font-medium">Legal Note:</p>
        <p className="text-sm text-muted-foreground mt-1">
          The Transaction Statement is a legal attestation required by the Drug Supply Chain Security Act (DSCSA). 
          By providing this statement, the transferring party certifies compliance with DSCSA requirements.
        </p>
      </div>
    </div>
  );
}