import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, User, Building, Calendar } from "lucide-react";

// Define the Transaction Statement props interface
interface TransactionStatementProps {
  statement: {
    text: string;
    signedBy: string;
    signerTitle?: string;
    signerCompany: string;
    signatureDate: string;
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
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction Statement (TS)</h2>
      <p className="text-muted-foreground">
        The Transaction Statement contains required DSCSA attestations about product authenticity, 
        authorized trading partners, and data integrity.
      </p>
      
      {/* Statement text card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            DSCSA Transaction Statement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-md">
            <pre className="whitespace-pre-wrap text-sm">
              {statement.text}
            </pre>
          </div>
          
          <Alert className="mt-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              This statement is required by the Drug Supply Chain Security Act (DSCSA) 
              and confirms compliance with regulatory requirements.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
      
      {/* Signature information card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Signature Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Signed By</h4>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{statement.signedBy}</span>
                </div>
                {statement.signerTitle && (
                  <div className="text-sm text-muted-foreground">
                    {statement.signerTitle}
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Company</h4>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{statement.signerCompany}</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Signature Date</h4>
              <Badge variant="outline" className="flex items-center gap-2 w-fit">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(statement.signatureDate)}</span>
              </Badge>
            </div>
            
            <div className="flex items-center gap-2 mt-4">
              <div className="h-4 w-4 rounded-full bg-green-500"></div>
              <span>Digital signature verified</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}