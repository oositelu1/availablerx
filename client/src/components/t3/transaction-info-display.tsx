import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, PillIcon, PillContent } from "@/components/ui/pill";
import { Package, Calendar, Barcode, Info, Building, ArrowRightLeft } from "lucide-react";

// Define the Transaction Information props interface
interface TransactionInfoProps {
  transactionInfo: {
    transactionId: string;
    gtin: string;
    ndc?: string;
    productName: string;
    lotNumber: string;
    expirationDate: string;
    quantity: number;
    dosageForm?: string;
    strength?: string;
    senderGln?: string;
    receiverGln?: string;
    senderName?: string;
    receiverName?: string;
  };
}

export function TransactionInfoDisplay({ transactionInfo }: TransactionInfoProps) {
  if (!transactionInfo) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">No Transaction Information Available</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Format expiration date
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction Information (TI)</h2>
      <p className="text-muted-foreground">
        Transaction Information contains the product identifiers and shipment details as required by DSCSA.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Product Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="h-5 w-5" />
              Product Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Product Name</h4>
              <p className="text-base font-semibold">{transactionInfo.productName}</p>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:gap-8">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">NDC</h4>
                <Pill>
                  <PillIcon>
                    <Barcode className="h-4 w-4" />
                  </PillIcon>
                  <PillContent>{transactionInfo.ndc || "N/A"}</PillContent>
                </Pill>
              </div>
              
              <div className="mt-3 sm:mt-0">
                <h4 className="text-sm font-medium text-muted-foreground mb-2">GTIN</h4>
                <Pill>
                  <PillIcon>
                    <Barcode className="h-4 w-4" />
                  </PillIcon>
                  <PillContent>{transactionInfo.gtin}</PillContent>
                </Pill>
              </div>
            </div>
            
            {(transactionInfo.dosageForm || transactionInfo.strength) && (
              <div className="flex flex-col sm:flex-row sm:gap-8 mt-3">
                {transactionInfo.dosageForm && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Dosage Form</h4>
                    <p>{transactionInfo.dosageForm}</p>
                  </div>
                )}
                
                {transactionInfo.strength && (
                  <div className="mt-3 sm:mt-0">
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Strength</h4>
                    <p>{transactionInfo.strength}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Lot Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5" />
              Lot Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Lot Number</h4>
              <Pill>
                <PillContent>{transactionInfo.lotNumber}</PillContent>
              </Pill>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Expiration Date</h4>
              <Pill>
                <PillIcon>
                  <Calendar className="h-4 w-4" />
                </PillIcon>
                <PillContent>{formatDate(transactionInfo.expirationDate)}</PillContent>
              </Pill>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Quantity</h4>
              <p className="text-base font-semibold">{transactionInfo.quantity}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Transaction Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transaction Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Transaction ID</h4>
              <Pill>
                <PillContent>{transactionInfo.transactionId}</PillContent>
              </Pill>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Origin</h4>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{transactionInfo.senderName || "Not specified"}</span>
                </div>
                {transactionInfo.senderGln && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    GLN: {transactionInfo.senderGln}
                  </div>
                )}
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Destination</h4>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span>{transactionInfo.receiverName || "Not specified"}</span>
                </div>
                {transactionInfo.receiverGln && (
                  <div className="mt-1 text-sm text-muted-foreground">
                    GLN: {transactionInfo.receiverGln}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}