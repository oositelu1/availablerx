import { sendEmail } from './server/email-service';

async function testSendGridWithNewEmail() {
  console.log('======================================');
  console.log('SENDGRID EMAIL INTEGRATION TEST WITH NEW SENDER EMAIL');
  console.log('======================================\n');
  
  // Check for SendGrid API key and sender email
  console.log('Checking configuration...');
  const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
  const hasSenderEmail = !!process.env.SENDER_EMAIL;
  
  if (hasSendGridKey) {
    console.log('✓ SendGrid API key found');
  } else {
    console.log('✗ SendGrid API key not found!');
    return;
  }
  
  if (hasSenderEmail) {
    console.log(`✓ Sender email configured: ${process.env.SENDER_EMAIL}`);
  } else {
    console.log('✗ Sender email not configured!');
    return;
  }
  
  console.log('\nAttempting to send a test email...');
  
  try {
    // Send a test email
    const result = await sendEmail({
      to: 'test@example.com', // Replace with a real email for actual testing
      subject: 'EPCIS Portal - SendGrid Test with New Sender Email',
      text: 'This is a test email from the EPCIS Portal application to verify SendGrid integration with the new sender email.',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 5px;">
          <h1 style="color: #4a6ee0;">EPCIS Portal</h1>
          <p>This is a test email from the EPCIS Portal application to verify SendGrid integration with the new sender email.</p>
          <p>If you're seeing this, it means the email service is properly configured!</p>
          <div style="margin-top: 20px; padding: 10px; background-color: #f9f9f9; border-radius: 5px;">
            <p><strong>Test Details:</strong></p>
            <p>Date/Time: ${new Date().toLocaleString()}</p>
            <p>Sender Email: ${process.env.SENDER_EMAIL}</p>
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
testSendGridWithNewEmail().catch(console.error);