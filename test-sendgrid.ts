import { sendEmail } from './server/email-service';

async function testSendGridIntegration() {
  console.log('======================================');
  console.log('SENDGRID EMAIL INTEGRATION TEST');
  console.log('======================================\n');
  
  // Check for SendGrid API key
  console.log('Checking for SendGrid API key...');
  const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
  
  if (hasSendGridKey) {
    console.log('✓ SendGrid API key found');
    console.log(`API Key: ${process.env.SENDGRID_API_KEY.substring(0, 5)}...${process.env.SENDGRID_API_KEY.substring(process.env.SENDGRID_API_KEY.length - 5)}`);
  } else {
    console.log('✗ SendGrid API key not found!');
    console.log('Please ensure SENDGRID_API_KEY is properly set in your environment variables.');
    return;
  }
  
  // Check for optional email configuration
  console.log('\nChecking for optional email configuration...');
  console.log(`- SENDER_EMAIL: ${process.env.SENDER_EMAIL || '(using default)'}`);
  console.log(`- SENDER_NAME: ${process.env.SENDER_NAME || '(using default)'}`);
  console.log(`- REPLY_TO_EMAIL: ${process.env.REPLY_TO_EMAIL || '(not set)'}`);
  console.log(`- EMAIL_ENABLED: ${process.env.EMAIL_ENABLED !== 'false' ? 'true' : 'false'}`);
  
  console.log('\nAttempting to send a test email...');
  
  try {
    // Send a test email
    const result = await sendEmail({
      to: 'test@example.com', // Replace with a real email for actual testing
      subject: 'EPCIS Portal - SendGrid Integration Test',
      text: 'This is a test email from the EPCIS Portal application to verify SendGrid integration.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
          <h1 style="color: #4a6ee0;">EPCIS Portal</h1>
          <p>This is a test email from the EPCIS Portal application to verify SendGrid integration.</p>
          <p>If you're seeing this, it means the email service is properly configured!</p>
          <div style="margin-top: 20px; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">
            <p><strong>Test Details:</strong></p>
            <p>Date/Time: ${new Date().toLocaleString()}</p>
            <p>Application: EPCIS Portal</p>
          </div>
        </div>
      `
    });
    
    if (result) {
      console.log('✓ Test email successfully processed!');
      console.log('Note: This only means the request to SendGrid was successful, not necessarily that the email was delivered.');
    } else {
      console.log('✗ Failed to send test email!');
    }
  } catch (error: any) {
    console.error('✗ Error encountered during email test:', error);
    
    // Print more detailed error information
    if (error.response && error.response.body && error.response.body.errors) {
      console.log('\nDetailed SendGrid error information:');
      console.log(JSON.stringify(error.response.body.errors, null, 2));
    }
  }
  
  console.log('\n======================================');
  console.log('TEST COMPLETED');
  console.log('======================================');
}

// Run the test
testSendGridIntegration().catch(console.error);