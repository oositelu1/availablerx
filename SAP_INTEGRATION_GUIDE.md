# SAP Business ByDesign Integration Guide

## Quick Start with Test Credentials

### 1. Set Up Environment Variables

Create a `.env` file in the root directory and add your SAP test tenant credentials:

```bash
# SAP Test Tenant Configuration
SAP_BYD_BASE_URL=https://your-test-tenant.sapbydesign.com
SAP_BYD_TENANT_ID=your-test-tenant
SAP_BYD_USER=your-username
SAP_BYD_PASSWORD=your-password

# Enable integration in test mode
SAP_INTEGRATION_ENABLED=true
SAP_INTEGRATION_MODE=test
SAP_BYD_DEFAULT_WAREHOUSE=MAIN
```

### 2. Test the Connection

Start your server and test the connection:

```bash
# Test if credentials work
GET http://localhost:3000/api/sap-test/connection

# Expected response:
{
  "connected": true,
  "configured": true,
  "message": "Successfully connected to SAP ByDesign",
  "environment": {
    "baseUrl": "https://your-test-tenant.sapbydesign.com",
    "tenantId": "your-test-tenant",
    "username": "Set",
    "authMethod": "Basic Auth"
  }
}
```

### 3. Test Product Lookup

Check if your test products exist in SAP:

```bash
# Test with a GTIN
GET http://localhost:3000/api/sap-test/product/00301430957010

# Response will show if product exists in SAP
```

### 4. Test Push Sample Product

Try pushing a test product to SAP:

```bash
POST http://localhost:3000/api/sap-test/push-sample
Content-Type: application/json

{
  "gtin": "00301430957010",
  "serialNumber": "TEST-001",
  "lotNumber": "TEST-LOT",
  "expirationDate": "2025-12-31",
  "productName": "Test Product",
  "manufacturer": "Test Manufacturer"
}
```

### 5. Test with Actual Validation

1. Upload an EPCIS file
2. Go to Manual Barcode Entry
3. Select the file
4. Enter/scan a barcode that matches 100%
5. Check the response for `sapIntegration` status

## Integration Flow

```
Scan Product → Validate Against EPCIS → 100% Match? → Push to SAP
                                              ↓
                                         Partial Match → No SAP Push
```

## Troubleshooting

### Connection Failed
- Check URL format (https://tenant.sapbydesign.com)
- Verify credentials
- Ensure user has API access permissions

### Product Not Found in SAP
- Product must exist in SAP Material Master
- Check GTIN is correctly formatted
- Use `force: true` in push-sample to test anyway

### Push Failed
- Check SAP user permissions for Goods Movement
- Verify all required fields are provided
- Check SAP integration logs

## Test Scenarios

1. **Valid Product Test**
   - Use known GTIN from your SAP test data
   - Should successfully push to inventory

2. **Invalid Product Test**
   - Use random GTIN
   - Should fail with "Product not found"

3. **Partial Match Test**
   - Modify one field (e.g., lot number)
   - Should validate but NOT push to SAP

4. **Connection Failure Test**
   - Use wrong password
   - Should validate but show SAP connection failed

## Production Checklist

Before going to production:
- [ ] Switch to production tenant URL
- [ ] Use production credentials
- [ ] Set `SAP_INTEGRATION_MODE=production`
- [ ] Test with real product GTINs
- [ ] Verify warehouse locations
- [ ] Set up error monitoring
- [ ] Document rollback procedure

## API Response Structure

When validation includes SAP integration:

```json
{
  "validated": true,
  "product": { ... },
  "match": "100%",
  "sapIntegration": {
    "enabled": true,
    "status": "SUCCESS",
    "message": "Product successfully added to SAP inventory",
    "objectId": "12345"
  }
}
```

Status values:
- `SUCCESS` - Pushed to SAP
- `FAILED` - Error occurred
- `SKIPPED` - Connection test failed
- `not_attempted` - Not 100% match or disabled