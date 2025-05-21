import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { 
  AlertCircle,
  Info,
  CheckSquare,
  FileText
} from "lucide-react";

export function DSCSAInfoSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">DSCSA Compliance Information</h2>
      
      <Card>
        <CardHeader className="bg-primary/5 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            Drug Supply Chain Security Act Reference
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="p-4 bg-muted/30 rounded-md border">
              <h3 className="font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                DSCSA Requirements
              </h3>
              <p className="text-sm">
                Under DSCSA, trading partners are required to provide the subsequent purchaser with product 
                tracing information, including Transaction Information (TI), Transaction History (TH), 
                and Transaction Statement (TS).
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Transaction Information (TI)</h3>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  <li>Name of product</li>
                  <li>Strength and dosage form</li>
                  <li>National Drug Code (NDC)</li>
                  <li>Container size and number of containers</li>
                  <li>Lot number of product</li>
                  <li>Date of transaction</li>
                  <li>Date of shipment (if different)</li>
                  <li>Business name and address of the person from whom ownership is being transferred</li>
                  <li>Business name and address of the person to whom ownership is being transferred</li>
                </ul>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Transaction History and Statement (TH & TS)</h3>
                <ul className="text-sm space-y-1 list-disc pl-5">
                  <li>Transaction History: A statement in paper or electronic form including the transaction information for each prior transaction going back to the manufacturer</li>
                  <li>Transaction Statement: A statement that the entity transferring ownership in a transaction had systems and processes in place to comply with verification requirements</li>
                  <li>Confirmation that the entity did not knowingly ship a suspect or illegitimate product</li>
                  <li>Confirmation that entity is authorized as required under DSCSA</li>
                  <li>Confirmation that entity received the transaction information and transaction statement from the prior owner</li>
                </ul>
              </div>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-md border border-blue-100 mt-4">
              <h3 className="font-medium mb-2 flex items-center gap-2 text-blue-700">
                <CheckSquare className="h-4 w-4" />
                Record Retention Requirements
              </h3>
              <p className="text-sm text-blue-700">
                This documentation must be maintained for a minimum of 6 years after the date of the transaction, 
                in paper or electronic format, as required by FDA regulations. Failure to maintain proper 
                records may result in regulatory action.
              </p>
            </div>
            
            <div className="mt-4 text-sm text-muted-foreground">
              <p className="italic flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Reference: Drug Supply Chain Security Act (DSCSA), Title II of the Drug Quality and Security Act (Public Law 113-54)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}