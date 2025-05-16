// Simple test script to diagnose sales order creation issues
const fetch = require('node-fetch');

// Read cookie from cookies.txt
const fs = require('fs');
const cookieContent = fs.readFileSync('./cookies.txt', 'utf8');
const cookieMatch = cookieContent.match(/connect\.sid=([^;]+)/);
const cookie = cookieMatch ? cookieMatch[1] : '';

async function testSalesOrderCreation() {
  try {
    // Get user info to verify authentication
    console.log('Testing authentication...');
    const userResponse = await fetch('http://localhost:5000/api/user', {
      headers: {
        Cookie: `connect.sid=${cookie}`
      }
    });
    
    if (!userResponse.ok) {
      console.error('Authentication failed:', await userResponse.text());
      return;
    }
    
    const userData = await userResponse.json();
    console.log('Authenticated as user:', userData);
    
    // Create a test sales order
    console.log('\nTrying to create a sales order...');
    const salesOrderData = {
      soNumber: `TEST-${Date.now()}`,
      customerId: 1,
      orderDate: new Date().toISOString().split('T')[0],
      status: 'draft',
      createdBy: userData.id
    };
    
    console.log('Sending data:', salesOrderData);
    
    const salesOrderResponse = await fetch('http://localhost:5000/api/sales-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `connect.sid=${cookie}`
      },
      body: JSON.stringify(salesOrderData)
    });
    
    const responseText = await salesOrderResponse.text();
    
    if (!salesOrderResponse.ok) {
      console.error('Failed to create sales order:', responseText);
    } else {
      console.log('Sales order created successfully:', responseText);
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

testSalesOrderCreation();