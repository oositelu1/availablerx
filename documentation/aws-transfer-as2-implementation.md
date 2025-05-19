# AWS Transfer for AS2 Implementation Guide

## Overview
This document describes the implementation of AWS Transfer for AS2 in the EPCIS compliance platform.

## Configuration

### Environment Variables
The following environment variables control the AWS Transfer for AS2 integration:

- `USE_AWS_TRANSFER`: Set to "true" to use AWS Transfer for AS2, "false" to use local OpenAS2
- `AWS_REGION`: AWS region where the Transfer server is deployed (e.g., "us-east-1")
- `AWS_TRANSFER_SERVER_ID`: ID of the AWS Transfer server (e.g., "s-7eb939c89a5c49e98")
- `AWS_S3_BUCKET`: S3 bucket used for file storage (e.g., "elasticbeanstalk-us-east-1-308357913539")

### AWS Resources
The following AWS resources have been created:

1. **AS2 Transfer Server**: A fully managed AS2 server that handles secure file transfers
2. **Local Profile**: Represents our organization's AS2 identity
3. **Partner Profiles**: Represents each trading partner's AS2 identity
4. **Agreements**: Defines the rules for receiving files from partners
5. **Connectors**: Defines the connections for sending files to partners

## Receiving Files from Partners

For partners sending files to our platform:
1. Partners send files to our AWS Transfer for AS2 endpoint
2. Files are delivered to the configured S3 bucket
3. Our application processes the files from the S3 bucket

## Sending Files to Partners

For sending files to partners:
1. Our application uploads the file to S3 in the outbound directory
2. The application calls the AWS Transfer API to initiate the transfer
3. AWS Transfer sends the file to the partner's AS2 endpoint
4. AWS Transfer handles MDNs and notifies our application of the status

## Implementing Partner Onboarding

To onboard a new partner:
1. Create a Partner Profile in AWS Transfer for AS2
2. Exchange certificates with the partner
3. Create an Agreement to receive files
4. Create a Connector to send files
5. Update the partner record in our database with the AS2 details

## API Usage

The AS2Service in our application has been updated to use AWS Transfer for AS2.
When `USE_AWS_TRANSFER` is set to "true", the service will:

1. Upload files to S3 instead of local filesystem
2. Use AWS Transfer API to send files
3. Monitor transfer status via AWS Transfer API

## Troubleshooting

Common issues:
- **Connection failures**: Check that the partner's AS2 endpoint is correctly configured
- **Certificate errors**: Verify that certificates are properly imported and not expired
- **File not delivered**: Check the S3 bucket for failed transfers
- **MDN issues**: Verify the MDN settings in the agreement or connector

## Reference

- [AWS Transfer for AS2 Documentation](https://docs.aws.amazon.com/transfer/latest/userguide/what-is-aws-transfer-for-as2.html)
- [AS2 Protocol Specification](https://datatracker.ietf.org/doc/html/rfc4130)