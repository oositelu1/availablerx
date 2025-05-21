import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Timeline, TimelineItem, TimelineIcon, TimelineConnector, TimelineContent, TimelineTitle, TimelineTime, TimelineDescription } from "@/components/ui/timeline-components";
import { ArrowLeftRight, Calendar, Building } from "lucide-react";

// Define the Transaction History props interface
interface TransactionHistoryProps {
  history: {
    id?: number;
    transactions: Array<{
      transactionId: string;
      transactionDate: string | Date;
      seller: string;
      buyer: string;
      senderGln?: string;
      receiverGln?: string;
    }>;
  };
}

export function TransactionHistoryDisplay({ history }: TransactionHistoryProps) {
  if (!history || !history.transactions || history.transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground">No Transaction History Available</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Format date for display
  const formatDate = (dateInput: string | Date) => {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return date.toLocaleString();
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Transaction History (TH)</h2>
      <p className="text-muted-foreground">
        Transaction History provides the chain of ownership from manufacturer to current owner as required by DSCSA.
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
            {history.transactions.map((transaction, index) => (
              <TimelineItem key={index}>
                <TimelineIcon active={index === history.transactions.length - 1}>
                  <Building className="h-4 w-4" />
                </TimelineIcon>
                <TimelineConnector />
                <TimelineContent>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <TimelineTitle>{transaction.transactionId}</TimelineTitle>
                    <TimelineTime>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(transaction.transactionDate)}
                      </span>
                    </TimelineTime>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div>
                      <p className="text-sm font-medium">From:</p>
                      <TimelineDescription>{transaction.seller}</TimelineDescription>
                      {transaction.senderGln && (
                        <p className="text-xs text-muted-foreground mt-1">
                          GLN: {transaction.senderGln}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">To:</p>
                      <TimelineDescription>{transaction.buyer}</TimelineDescription>
                      {transaction.receiverGln && (
                        <p className="text-xs text-muted-foreground mt-1">
                          GLN: {transaction.receiverGln}
                        </p>
                      )}
                    </div>
                  </div>
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        </CardContent>
      </Card>
      
      <div className="bg-muted p-4 rounded-md">
        <p className="text-sm font-medium">DSCSA Compliance Note:</p>
        <p className="text-sm text-muted-foreground mt-1">
          The Drug Supply Chain Security Act (DSCSA) requires that each person who is engaged in the wholesale distribution of a product provide the subsequent owner with transaction history. This ensures complete traceability of the product through the supply chain.
        </p>
      </div>
    </div>
  );
}