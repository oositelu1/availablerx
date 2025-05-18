# Setting Up AWS Transfer for AS2

This guide provides instructions on setting up and configuring AWS Transfer for AS2 to work with our application.

## Overview

AWS Transfer for AS2 is a managed service for secure file transfers using the Applicability Statement 2 (AS2) protocol. It eliminates the need to operate your own AS2 server, handling encryption, decryption, and message disposition notifications (MDNs) automatically.

## Prerequisites

- An AWS account with appropriate permissions
- AWS IAM credentials configured
- Partner certificates for encryption and signing

## Step 1: Create an AWS Transfer for AS2 Server

1. Open the AWS Management Console and navigate to the AWS Transfer Family service
2. Click "Create server"
3. Select "AS2" as the protocol
4. Configure server settings:
   - Choose a public endpoint (unless you're using AWS PrivateLink)
   - Select or create a logging role
   - Choose CloudWatch logging options
5. Click "Create server"
6. Note the Server ID that is generated - you'll need this for configuration

## Step 2: Create an S3 Bucket for File Storage

1. Navigate to the S3 service in AWS Console
2. Create a new bucket to store incoming and outgoing AS2 messages
3. Set appropriate permissions to allow the Transfer service to access it
4. Create folders for organization (e.g., `incoming`, `outgoing`, `processed`)

## Step 3: Create an AS2 Connector

For each trading partner relationship, you need to create an AS2 connector:

1. In the AWS Transfer Family console, navigate to "Connectors"
2. Click "Create connector"
3. Configure basic settings:
   - Connector name: A descriptive name for this partner connection
   - AS2 Transport settings: URL endpoint of your trading partner's AS2 server
   - Encryption algorithm: AES128_CBC, AES192_CBC, AES256_CBC, or DES_EDE3_CBC
   - Signing algorithm: SHA1, SHA256, SHA384, or SHA512
   - MDN settings: Configure whether you want signed MDNs, synchronous or asynchronous

4. Configure partner profile:
   - Local profile (your organization):
     - AS2 ID: Your AS2 identifier
     - Certificate: Upload your certificate for signing outgoing messages
   - Partner profile:
     - AS2 ID: Partner's AS2 identifier
     - Certificate: Upload partner's certificate for encryption

5. Configure additional settings:
   - Message subject
   - Compression (optional)
   - CIK (optional, for EDI INT compliance)

6. Set up file handling:
   - S3 bucket location for incoming files
   - File name templates

7. Click "Create connector"

## Step 4: Configure Application Environment

Set the following environment variables in your application:

```
USE_AWS_TRANSFER=true
AWS_REGION=us-east-1  # Replace with your AWS region
AWS_TRANSFER_SERVER_ID=s-abc123xyz  # Your AWS Transfer server ID
AWS_S3_BUCKET=your-as2-bucket  # S3 bucket name
AWS_ACCESS_KEY_ID=your-access-key  # AWS credentials
AWS_SECRET_ACCESS_KEY=your-secret-key  # AWS credentials
```

## Step 5: Partner Configuration

When configuring partners in the application:

1. Select "AS2" as the transport method
2. Enter the partner's AS2 ID in the "AS2 To ID" field
3. Enter your AS2 ID in the "AS2 From ID" field
4. AS2 URL is not needed when using AWS Transfer (the service handles this)

## Testing and Troubleshooting

To test your AS2 configuration:

1. Send a test file through the application
2. Check AWS CloudWatch logs for the Transfer server
3. Verify file arrival in your S3 bucket
4. Confirm MDN receipt

Common issues:
- Certificate errors (check certificate format and expiration)
- Connectivity issues (verify partner endpoint is accessible)
- Permission errors (check IAM roles and policies)

## Security Considerations

- Regularly rotate certificates before expiration
- Use strong encryption and signing algorithms
- Monitor CloudWatch logs for any anomalies
- Set up CloudTrail to audit all Transfer for AS2 actions
- Use IAM roles with least privilege principle

## Cost Considerations

AWS Transfer for AS2 pricing is based on:
- Hourly charges for the AS2 server
- Per-GB charges for data processed
- S3 storage and request charges

Monitor your usage to avoid unexpected costs.