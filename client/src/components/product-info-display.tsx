import React from 'react';
import { Badge } from "@/components/ui/badge";
import { gtinToNDC } from '@/lib/utils';

interface ProductInfoDisplayProps {
  productInfo: any;
  gtin?: string;
}

export function ProductInfoDisplay({ productInfo, gtin }: ProductInfoDisplayProps) {
  // Safely handle potentially missing properties
  const name = productInfo?.name || "Pharmaceutical Product";
  const manufacturer = productInfo?.manufacturer || "Manufacturer information not available";
  const lotNumber = typeof productInfo?.lotNumber === 'object' 
    ? productInfo?.lotNumber?._ 
    : productInfo?.lotNumber;
  
  const expirationDate = typeof productInfo?.expirationDate === 'object' 
    ? productInfo?.expirationDate?._ 
    : productInfo?.expirationDate;
  
  const formattedExpirationDate = expirationDate 
    ? new Date(expirationDate).toLocaleDateString() 
    : "Not available";
    
  const ndc = productInfo?.ndc || (gtin ? gtinToNDC(gtin) : "Not available");
  
  return (
    <div className="space-y-4">
      {/* Product Identity Card */}
      <div className="bg-white p-4 rounded-lg border border-primary/10">
        <div className="mb-4 border-b pb-3">
          <h3 className="text-lg font-semibold text-gray-800">
            {name}
          </h3>
          
          <p className="text-sm text-gray-600 mt-1">
            {manufacturer}
          </p>
          
          {productInfo?.dosageForm && productInfo?.strength && (
            <p className="text-sm text-gray-600 mt-1">
              {productInfo.dosageForm} - {productInfo.strength}
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {gtin && (
            <>
              <div className="text-sm font-medium text-neutral-700">GTIN:</div>
              <div className="text-sm font-mono">{gtin}</div>
            </>
          )}
          
          {ndc && (
            <>
              <div className="text-sm font-medium text-neutral-700">NDC:</div>
              <div className="text-sm font-mono">{ndc}</div>
            </>
          )}
          
          {productInfo?.netContent && (
            <>
              <div className="text-sm font-medium text-neutral-700">Quantity/Pack Size:</div>
              <div className="text-sm">{productInfo.netContent}</div>
            </>
          )}
        </div>
      </div>
      
      {/* Serialization Details Card */}
      <div className="bg-white p-4 rounded-lg border border-primary/10">
        <h4 className="text-sm font-semibold text-primary/80 mb-3">Serialization Details</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {lotNumber && (
            <>
              <div className="text-sm font-medium text-neutral-700">Lot/Batch:</div>
              <div className="text-sm font-mono">{lotNumber}</div>
            </>
          )}
          
          {expirationDate && (
            <>
              <div className="text-sm font-medium text-neutral-700">Expiration Date:</div>
              <div className="text-sm">{formattedExpirationDate}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}