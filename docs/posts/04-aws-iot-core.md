---
layout: default
title: "Part 4: Moving to AWS IoT Core with Certificates"
---

# Part 4: Moving to AWS IoT Core with Certificates

Now that we have basic MQTT working with a public broker, it's time to move to production-grade infrastructure. AWS IoT Core provides secure, scalable MQTT with proper device authentication.

## Why AWS IoT Core?

- Each device has unique certificates
- All communication is encrypted
- Built-in integration with other AWS services
- Enterprise-grade security and scaling

## Setting up AWS IoT Core

### Step 1: Create a Thing

1. Go to AWS IoT Console → Manage → Things
2. Click "Create things" → "Create single thing"
3. Name: `robotinc-m5stick-001`
4. Click "Next" → "Auto-generate a new certificate"
5. **Important**: When asked for Platform and SDK, select:
   - **Platform**: Linux/macOS
   - **SDK**: C++ (or just skip this - we're using Arduino libraries)
6. Download all three files:
   - **Device certificate** (`.pem.crt`) - Your device's unique identity
   - **Private key** (`.pem.key`) - Proves your device owns the certificate
   - **Root CA certificate** - Validates that AWS IoT is legitimate
7. Click "Done"

**Certificate refresher:**
- Device certificate = Your passport (who you are)
- Private key = Your signature (proves it's really you)
- Root CA = Government authority (proves the passport is real)

### Step 2: Create a Policy

This policy defines what your device is allowed to do, permissions for your device's certificate.

1. Go to AWS IoT Console → Secure → Policies
2. Click "Create policy"
3. Name: `RobotincDevicePolicy`
4. Add these policy statements:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:Connect",
      "Resource": "arn:aws:iot:*:*:client/robotinc-*"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Subscribe",
      "Resource": "arn:aws:iot:*:*:topicfilter/robotinc/*"
    },
    {
      "Effect": "Allow",
      "Action": "iot:Publish",
      "Resource": "arn:aws:iot:*:*:topic/robotinc/*"
    }
  ]
}
```

### Step 3: Attach Policy to Certificate

1. Go to AWS IoT Console → Secure → Certificates
2. Click on your certificate
3. Actions → Attach policy → Select `RobotincDevicePolicy`
4. Actions → Attach thing → Select `robotinc-m5stick-001`

## Updated M5Stick Code

The complete AWS IoT code is available: [aws_iot_color_control.ino](../../m5stick/aws_iot_color_control.ino)

### Step 1: Get Your AWS IoT Endpoint

First, you need your AWS IoT endpoint URL. Get it using:

**AWS Console Method:**
1. Go to AWS IoT Console → Settings
2. Copy the "Device data endpoint" (looks like `xxxxx-ats.iot.eu-west-2.amazonaws.com`)

**AWS CLI Method:**
```bash
aws iot describe-endpoint --endpoint-type iot:Data-ATS
```

### Step 2: Replace Certificates in Arduino Code

**IMPORTANT**: You must replace the placeholder certificates with your actual certificates downloaded in Step 1.

Open the Arduino code at `m5stick/aws_iot_color_control.ino` and find these sections:

```cpp
// AWS IoT settings - REPLACE WITH YOUR ENDPOINT
const char* aws_endpoint = "your-endpoint-ats.iot.us-east-1.amazonaws.com";
const int aws_port = 8883;

// Certificates - REPLACE WITH YOUR ACTUAL CERTIFICATES
const char* root_ca = R"EOF(
-----BEGIN CERTIFICATE-----
[PASTE YOUR ROOT CA CERTIFICATE HERE]
-----END CERTIFICATE-----
)EOF";

const char* device_cert = R"EOF(
-----BEGIN CERTIFICATE-----
[PASTE YOUR DEVICE CERTIFICATE HERE]
-----END CERTIFICATE-----
)EOF";

const char* private_key = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
[PASTE YOUR PRIVATE KEY HERE]
-----END RSA PRIVATE KEY-----
)EOF";
```

**How to replace:**
1. **AWS Endpoint**: Replace `your-endpoint-ats.iot.us-east-1.amazonaws.com` with your actual endpoint
2. **Root CA**: Open your downloaded Root CA file, copy all content, paste between the ROOT CA markers
3. **Device Certificate**: Open your `.pem.crt` file, copy all content, paste between the DEVICE CERT markers
4. **Private Key**: Open your `.pem.key` file, copy all content, paste between the PRIVATE KEY markers

**Important**: Keep the `R"EOF(` and `)EOF"` markers - they tell Arduino this is a raw string.


## Certificate Management

**The Challenge**: Embedding certificates in Arduino code is messy. You end up with hundreds of lines of certificate text in your code.

For this demo, embedding certificates works but isn't production-ready.

## Testing with AWS IoT

1. Upload the updated code with your certificates
2. Go to AWS IoT Console → Test → MQTT test client
3. **Subscribe to**: `robotinc/device/status/robotinc-m5stick-001`
4. **Power on your M5Stick** - you should see the "online" status message
5. **Publish to**: `robotinc/device/command/robotinc-m5stick-001`
6. **Message**: `{"action":"color","value":"blue"}`

**Note**: You'll only see status messages when:
- The device first connects ("online" message)
- The device responds to color commands
- The device reconnects after losing connection

**Tip**: If you don't see the initial "online" message, reset your M5Stick while subscribed to the status topic.

### Debugging Connection Issues

**Arduino debugging for AWS IoT**: Use Serial Monitor (115200 baud) to see connection status. Common error codes:
- **-2**: TLS/certificate issue - check certificate format and validity
- **-4**: Connection timeout - check WiFi, endpoint URL, or firewall
- **-5**: Connection refused - check device policy permissions

You should see your device respond securely through AWS IoT Core!

## Monitoring with CloudWatch

One of the benefits of AWS IoT Core is built-in monitoring. Let's check what metrics we can see:

1. Go to **CloudWatch Console** → **Metrics** → **AWS/IoT**
2. Look for metrics like:
   - **Connect.Success** - Device connections
   - **PublishIn.Success** - Messages received by AWS IoT
   - **PublishOut.Success** - Messages sent to devices
   - **Subscribe.Success** - Topic subscriptions

3. You can also check **AWS IoT Console** → **Monitor** for device-specific metrics

**What you should see:**
- Connection events when your M5Stick powers on
- Publish events when you send color commands
- Publish events when your device responds with status

This gives you real-time visibility into your IoT device communication, something you wont get with the moquitto MQTT broker. We'll come back to observability in a later sections.

## Next Steps

Now that we have secure device communication, we can add our AI layer to process natural language commands.

[Part 5: Adding Bedrock Agents →](05-strands-agents.html)