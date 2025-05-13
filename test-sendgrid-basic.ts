import { MailService } from '@sendgrid/mail';

async function testSendGridDirectly() {
  console.log('Testing SendGrid directly...');
  
  const sendgrid = new MailService();
  sendgrid.setApiKey(process.env.SENDGRID_API_KEY!);
  
  try {
    const msg = {
      to: 'test@example.com',
      from: 'test@example.com', // This should be a verified sender in your SendGrid account
      subject: 'Testing SendGrid Integration',
      text: 'This is a test email',
      html: '<p>This is a test email</p>',
    };
    
    console.log('Attempting to send email with the following configuration:');
    console.log(JSON.stringify(msg, null, 2));
    
    await sendgrid.send(msg);
    console.log('Email sent successfully!');
  } catch (error: any) {
    console.error('Error sending email:', error.toString());
    
    if (error.response) {
      console.error('Error response body:');
      console.log(JSON.stringify(error.response.body, null, 2));
    }
  }
}

testSendGridDirectly();