import { config } from 'dotenv';
import { getSAPService } from './server/sap-integration-service.js';

// Load environment variables
config();

console.log('SAP Connection Test Script');
console.log('=========================\n');

// Check configuration
console.log('1. Checking SAP Configuration:');
console.log('   Base URL:', process.env.SAP_BYD_BASE_URL || 'NOT SET');
console.log('   Tenant ID:', process.env.SAP_BYD_TENANT_ID || 'NOT SET');
console.log('   Username:', process.env.SAP_BYD_USER ? 'SET' : 'NOT SET');
console.log('   Password:', process.env.SAP_BYD_PASSWORD ? 'SET' : 'NOT SET');
console.log('   Client ID:', process.env.SAP_BYD_CLIENT_ID ? 'SET (OAuth2)' : 'NOT SET');
console.log('   Client Secret:', process.env.SAP_BYD_CLIENT_SECRET ? 'SET (OAuth2)' : 'NOT SET');
console.log('   Auth Method:', process.env.SAP_BYD_CLIENT_ID ? 'OAuth2' : 'Basic Auth');
console.log('');

// Test connection
async function testSAPConnection() {
  try {
    if (!process.env.SAP_BYD_BASE_URL) {
      console.error('ERROR: SAP configuration not found!');
      console.error('Please set the following environment variables:');
      console.error('  - SAP_BYD_BASE_URL');
      console.error('  - SAP_BYD_TENANT_ID');
      console.error('  - SAP_BYD_USER');
      console.error('  - SAP_BYD_PASSWORD');
      console.error('  - SAP_BYD_CLIENT_ID (optional, for OAuth2)');
      console.error('  - SAP_BYD_CLIENT_SECRET (optional, for OAuth2)');
      process.exit(1);
    }

    console.log('2. Testing SAP Connection...');
    const sapService = getSAPService();
    const isConnected = await sapService.testConnection();
    
    if (isConnected) {
      console.log('✅ SUCCESS: Successfully connected to SAP ByDesign!');
      
      // Test product lookup
      console.log('\n3. Testing Product Lookup (sample GTIN: 00301430957010)...');
      try {
        const productExists = await sapService.verifyProductInSAP('00301430957010');
        if (productExists) {
          console.log('✅ Product found in SAP');
          const stockLevel = await sapService.getStockLevel('00301430957010');
          console.log(`   Current stock level: ${stockLevel} units`);
        } else {
          console.log('❌ Product not found in SAP');
        }
      } catch (err) {
        console.log('❌ Product lookup failed:', err.message);
      }
    } else {
      console.log('❌ FAILED: Could not connect to SAP ByDesign');
    }
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    console.error('   Full error:', error);
  }
}

// Run the test
testSAPConnection();