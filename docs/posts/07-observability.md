---
layout: default
title: "Part 7: Observability & Troubleshooting (Bonus)"
---

# Part 7: Observability & Troubleshooting

Now that your Physical AI system is running, you need visibility into what's happening. This bonus section covers debugging and monitoring your edge deployment.

## Agent Verbose Mode

A simple way to debug is to add a verbose output to your code, but this is dependent on instrumenting your code. We have added some MQTT output to our code:

```bash
agent-verbose

[VERBOSE MODE ENABLED]

You: turn it blue
[AGENT] Processing color command
Topic: robotinc/device/command/robotinc-m5stick-001
Payload: {"action":"color","r":0,"g":0,"b":255}
Response: 200
Agent: Changed device to blue
```

This shows:
- MQTT topics and payloads
- DynamoDB queries
- HTTP response codes
- Colour conversion details

## Bedrock Metrics (Automatic)

Bedrock automatically logs to CloudWatch, no instrumentation needed:

1. **CloudWatch Console** → **Metrics** → **AWS/Bedrock**
2. View:
   - **Invocations**: Number of model calls
   - **InputTokens**: Tokens sent to the model
   - **OutputTokens**: Tokens generated
   - **InvocationLatency**: Response time

## Bedrock Traces (Optional)

For detailed request/response traces, enable model invocation logging:

```bash
# Enable logging to CloudWatch
aws bedrock put-model-invocation-logging-configuration \
  --logging-config '{"cloudWatchConfig":{"logGroupName":"/aws/bedrock/modelinvocations","roleArn":"arn:aws:iam::ACCOUNT:role/BedrockLoggingRole"}}'
```

Then view traces in CloudWatch Logs:
- Full request/response payloads
- Token counts
- Latency breakdown
- Model parameters

**Note**: This logs ALL Bedrock calls in your account, which can get expensive. Use it for debugging only.

## IoT Core Monitoring

Test MQTT messages in real-time:

1. **AWS IoT Console** → **Test** → **MQTT test client**
2. Subscribe to `robotinc/#`
3. See all device commands and status messages

## Greengrass Status

Check Greengrass health:

```bash
# Check if Greengrass is running
sudo systemctl status greengrass

# View Greengrass logs
sudo journalctl -u greengrass -f

# Check Greengrass version
sudo /greengrass/v2/bin/greengrass-cli --version
```

## Common Issues

### Agent Won't Start

```bash
# Check Docker is running
docker ps

# Check ECR authentication
aws ecr get-login-password --region eu-west-2

# Pull image manually
docker pull <image-uri>
```

### Device Not Responding

```bash
# Check IoT connectivity
aws iot describe-endpoint --endpoint-type iot:Data-ATS

# Test MQTT publish
aws iot-data publish \
  --topic robotinc/device/command/robotinc-m5stick-001 \
  --payload '{"action":"color","r":255,"g":0,"b":0}' \
  --cli-binary-format raw-in-base64-out
```

### DynamoDB Not Logging

```bash
# Check Lambda function logs
aws logs tail /aws/lambda/RobotincStack-DeviceStateProcessor --follow

# Check IoT Rule
aws iot get-topic-rule --rule-name RobotincDeviceStateRule
```

## Cost Monitoring

Track your spending:

```bash
# View current month costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE
```

Key cost drivers:
- **EC2 t4g.small**: ~£10/month
- **Bedrock Nova Lite**: ~$0.0006 per 1K tokens
- **IoT Core**: First 1M messages free
- **DynamoDB**: On-demand pricing

## Next Steps

- Set up CloudWatch alarms for high costs
- Create dashboards for system health
- Add custom metrics from your agent
- Implement distributed tracing with X-Rayß
---

[← Back to Part 6](06-edge-deployment.html)
