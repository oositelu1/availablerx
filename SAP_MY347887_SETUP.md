# SAP Integration Setup for my347887 Tenant

## Your SAP Services

1. **Material Master**: `vmumaterial`
   - URL: https://my347887.sapbydesign.com/sap/byd/odata/cust/v1/vmumaterial/
   - Used for: Product verification and lookup

2. **Inbound Delivery**: `khinbounddelivery`
   - URL: https://my347887.sapbydesign.com/sap/byd/odata/cust/v1/khinbounddelivery/
   - Used for: Receiving inventory into SAP

## Quick Setup

1. **Add to your .env file**:
```env
SAP_BYD_BASE_URL=https://my347887.sapbydesign.com
SAP_BYD_TENANT_ID=my347887
SAP_BYD_USER=your-username
SAP_BYD_PASSWORD=your-password
SAP_INTEGRATION_ENABLED=true
SAP_INTEGRATION_MODE=test
```

2. **Test Connection**:
```bash
curl http://localhost:3000/api/sap-test/connection
```

3. **Test Product Lookup**:
```bash
curl http://localhost:3000/api/sap-test/product/00301430957010
```

## Integration Flow

When a product is scanned and validated:
1. System checks against EPCIS file
2. If 100% match → Create inbound delivery in SAP
3. Product is added to SAP inventory

## Important Notes

- The `kh` prefix in `khinbounddelivery` might indicate a custom namespace
- Field names in the inbound delivery might need adjustment based on your SAP configuration
- Test with your actual product GTINs that exist in SAP

## Troubleshooting

If you get errors about field names:
1. Access the metadata URL to see exact field names:
   https://my347887.sapbydesign.com/sap/byd/odata/cust/v1/khinbounddelivery/$metadata
   
2. Look for the entity type for InboundDelivery
3. Note the exact property names
4. We can adjust the field mappings accordingly

## Next Steps

1. Test the connection endpoint
2. Verify a product exists in SAP
3. Try a test push with a known product
4. Validate actual products through scanning