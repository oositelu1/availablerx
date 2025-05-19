# AS2 File Monitoring Setup Guide

This guide will walk you through setting up the automated S3 bucket monitoring for AS2 file processing in your EPCIS Compliance platform.

## Prerequisites

1. An AWS Account with S3 and Transfer for AS2 services enabled
2. An AWS Transfer for AS2 server configured with:
   - Partner agreements established
   - S3 bucket destination for incoming files
   - Certificates for encryption/signing

## Environment Setup

The following environment variables need to be added to your application server:

```
AWS_REGION=us-east-2  # Replace with your AWS region
AWS_S3_BUCKET=your-as2-bucket-name  # Replace with your S3 bucket name
S3_MONITOR_INTERVAL=5  # Check interval in minutes (optional, default is 5)
```

You also need to configure AWS credentials using one of these methods:

1. IAM Role (recommended for production)
2. Environment variables:
   ```
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   ```

## How the S3 Monitoring Works

1. **Automatic Startup**: When the application server starts, it checks for AWS credentials and starts the S3 monitoring service if properly configured.

2. **Regular Polling**: The service checks the specified S3 bucket's `as2-incoming/` folder at regular intervals (default: 5 minutes).

3. **File Processing**:
   - When a new file is detected, it's downloaded to a temporary location
   - The file is analyzed to determine which partner it's from (using GLN matching)
   - The file is validated and stored in the database
   - Product items and events from the file are extracted and stored

4. **Partner Access**:
   - A pre-signed URL is automatically generated for the partner associated with the file
   - The partner receives an email notification with the secure download link
   - The pre-signed URL expires after 7 days by default

## Admin Controls

The platform includes API endpoints for monitoring and controlling the AS2 file processing:

* **GET /api/as2/monitor/status** - Check the current status of the monitoring service
* **POST /api/as2/monitor/start** - Start the monitoring service
* **POST /api/as2/monitor/stop** - Stop the monitoring service
* **POST /api/as2/monitor/check-now** - Trigger an immediate check (useful for testing)

Only administrators have access to these controls.

## Testing the Setup

To test that everything is working correctly:

1. Configure the environment variables
2. Restart the application server
3. Check the server logs for: "S3 Monitor Service initialized" and "Starting S3 Monitor Service"
4. Use the admin API endpoint to trigger a manual check
5. Send a test AS2 message to your AS2 endpoint
6. Verify that the file appears in your application's files list
7. Confirm that a pre-signed URL was generated for the partner

## Troubleshooting

If files aren't being processed automatically:

1. Verify AWS credentials are correct
2. Check that the S3 bucket name and region are properly configured
3. Confirm that files are being delivered to the expected `as2-incoming/` folder
4. Check server logs for any errors during the S3 bucket checking process
5. Ensure partners have GLNs configured so they can be properly matched with incoming files