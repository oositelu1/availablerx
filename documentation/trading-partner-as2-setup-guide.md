# Trading Partner AS2 Setup Guide

## Overview
This document provides the necessary information for setting up an AS2 connection to send EPCIS files to our compliance platform.

## AvailableRx AS2 Connection Information

### AS2 Endpoint Details
| Parameter | Value |
|-----------|-------|
| AS2 Endpoint URL | https://s-7eb939c89a5c49e98.server.transfer.us-east-1.amazonaws.com/ |
| AS2 ID | AvailableRx-AS2 |
| Subject | EPCIS AS2 Message |

### Security Settings
| Parameter | Value |
|-----------|-------|
| Encryption | Required |
| Encryption Algorithm | AES-256 (Preferred) |
| Signing | Required |
| Signing Algorithm | SHA-256 (Preferred) |
| Compression | Optional |

### MDN Configuration
| Parameter | Value |
|-----------|-------|
| MDN Type | Synchronous |
| MDN Signing | Requested |

## Certificate Information
Our public certificate for encrypting messages and verifying signatures is provided below. This certificate should be imported into your AS2 software to encrypt messages sent to us and verify signatures on messages received from us.

```
-----BEGIN CERTIFICATE-----
MIIDtTCCAp2gAwIBAgIUIO5Ic5WJUn+ptzl8wEbWm/Dn0+wwDQYJKoZIhvcNAQEL
BQAwajELMAkGA1UEBhMCVVMxDjAMBgNVBAgMBVRleGFzMQ8wDQYDVQQHDAZEYWxs
YXMxFDASBgNVBAoMC0F2YWlsYWJsZVJ4MQ4wDAYDVQQLDAVFUENJUzEUMBIGA1UE
AwwLQXZhaWxhYmxlUngwHhcNMjUwNTE5MDEzNzAwWhcNMjYwNTE5MDEzNzAwWjBq
MQswCQYDVQQGEwJVUzEOMAwGA1UECAwFVGV4YXMxDzANBgNVBAcMBkRhbGxhczEU
MBIGA1UECgwLQXZhaWxhYmxlUngxDjAMBgNVBAsMBUVQQ0lTMRQwEgYDVQQDDAtB
dmFpbGFibGVSeDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBALgDTdx1
e9/BqFTbacadyoEvqyOHAkZKPTbF+D2IUi55c/gx6uJJ65QCqKra0iB8YpMr5k46
s7CIkJA4Jg5U4j38zfGBshnGz5INvn1F6+z8ugO6+f4yU5r6ooU/AejPLTyWytxB
kS7+K8FQBj/Rjrnq4T7YG4Ee6hXqebReA3D9i80NPf9sq8NyIg9X+dLy6Gx+p66n
GdKDpgLGXkwLVs2BbDj+mvVbRJzTQZAOfKJN2CYRv1s3UHKIMhza0OOTCTIU2P0F
cYU+ZXCMPobfQJBj4Flg6JrRdyxCbSSRJODalyLtsIp+6KWL9bkYx5CTckPbjYhb
dZ1YZZ1EOO0Sn5MCAwEAAaNTMFEwHQYDVR0OBBYEFIlvWq9ZF0t28FIOrdROt40y
rYhVMB8GA1UdIwQYMBaAFIlvWq9ZF0t28FIOrdROt40yrYhVMA8GA1UdEwEB/wQF
MAMBAf8wDQYJKoZIhvcNAQELBQADggEBAJOtiAuM5bmqTmaixuPByHmXUY6LTDHL
uVyU17MzJFM4fLu1wO3Fmd5hV0QgIOSIBTT/VLlVaXAM6fgbgRHv+tcSVU4Qk2++
0JpBVOVlYYdFJ1w4O588lb6bjfYSzuTSreanfpVCjcKHua3X3H4HcghVElF7/N0k
tO014Oi597focAJpvlceW7Pv2C3ccKUO07qU37Bq5+1tU/YwMD5a/jLFgLJxAF3X
wobO2CmgT/LI8bRixkhRoyPwLNgMjjsCjfi828dlWLWDpN47WDgmwy+P7nqouojt
VNU+zCDJMFcTaeOOov/zJsQ2S9C1733SIYUFFXGIcQggg64Hz3gZ+9w=
-----END CERTIFICATE-----
```

A copy of this certificate is also available in PEM format at: `documentation/availablerx-as2-public-certificate.pem`

**Important**: Never share or request private keys, only public certificates should be exchanged. This certificate expires on May 19, 2026 and will need to be renewed before that date.

## File Format Requirements
- Files must be valid EPCIS 1.2 XML documents
- Maximum file size: 100MB
- Files should include a unique identifier in the filename (e.g., shipment_[UUID].epcis.xml)

## Testing Process
Before sending production files:
1. Contact our support team to schedule a testing window
2. Send a test file using the subject line "TEST - EPCIS AS2 Message"
3. Our team will verify receipt and processing of the test file
4. Once confirmed, you can begin sending production files

## Support Contact
For assistance with AS2 setup or troubleshooting:
- Email: support@availablerx.com
- Phone: (555) 123-4567

## Document History
| Version | Date | Changes |
|---------|------|---------|
| 1.0 | May 19, 2025 | Initial document |