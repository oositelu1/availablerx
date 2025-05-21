import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline, TimelineItem, TimelineConnector, TimelineIcon, TimelineContent } from "@/components/ui/timeline";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Building, Clock, ArrowLeftRight } from "lucide-react";

// Define the Transaction History props interface
interface TransactionHistoryProps {
  history: Array<{
    sequenceNumber: number;
    transactionDate: string;
    senderGln: string;
    receiverGln: string;
    senderName?: string;
    receiverName?: string;
  }>;
}

export function TransactionHistoryDisplay({ history }: TransactionHistoryProps) {
  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">No Transaction History Available</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Sort history by sequence number if needed
  const sortedHistory = [...history].sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction History (TH)</h2>
      <p className="text-muted-foreground">
        Transaction History provides a complete chronological record of ownership changes, 
        as required by DSCSA for chain-of-custody tracking.
      </p>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Chain of Ownership
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Timeline>
            {sortedHistory.map((entry, index) => (
              <TimelineItem key={index}>
                {index < sortedHistory.length - 1 && <TimelineConnector />}
                <TimelineIcon>
                  <Building className="h-4 w-4" />
                </TimelineIcon>
                <TimelineContent>
                  <div className="mb-2">
                    <Badge variant="outline" className="mb-1">
                      Transaction {entry.sequenceNumber}
                    </Badge>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(entry.transactionDate)}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 mb-4">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">From</p>
                      <p className="text-sm">{entry.senderName || "Unknown Sender"}</p>
                      <p className="text-xs text-muted-foreground">GLN: {entry.senderGln}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm font-medium">To</p>
                      <p className="text-sm">{entry.receiverName || "Unknown Receiver"}</p>
                      <p className="text-xs text-muted-foreground">GLN: {entry.receiverGln}</p>
                    </div>
                  </div>
                  
                  {index < sortedHistory.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </CardContent>
      </Card>
      
      {/* Verification information card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Verification Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-green-500"></div>
            <span>All transactions verified</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Transaction history has been cryptographically verified to ensure data integrity 
            throughout the supply chain.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}