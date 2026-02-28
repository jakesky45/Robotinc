---
layout: default
title: "Part 8: Wrap Up"
---

# Part 8: What We've Learned & Teardown

## What We Built

Did we over-engineer a light switch? Absolutely. But along the way:

**Hardware**: Dusted off an M5Stick, discovered most USB-C cables are lies (power-only), and got an ESP32 to listen to MQTT commands.

**Security**: Moved from a public MQTT broker (hello, internet strangers) to AWS IoT Core with X.509 certificates. Because authentication matters, even for LED screens.

**AI Layer**: Built a multi-agent system with Bedrock Nova Lite and Strands. The agent understands "turn it ocean blue" and doesn't hallucinate RGB values, thanks to tools and the Python `color` library.

**Edge Deployment**: Automated everything with CDK. One `cdk deploy` creates VPC, EC2, Greengrass, DynamoDB, Lambda, IoT Rules, and pushes a Docker image. Infrastructure as code is satisfying when it works first time.

**The Result**: Natural language controls physical hardware. "Make it sunset orange" → agent thinks → MQTT publish → screen changes. Physical AI in action.

**Key Lessons:**

1. **Physical AI is different**: Tools prevent hallucination, state must be verified
2. **Edge + Cloud works**: Low latency at the edge, AI inference in the cloud
3. **Infrastructure as Code**: CDK makes deployments repeatable
4. **Hybrid approach**: Greengrass for connectivity, Docker for flexibility

You now have the foundation to build Physical AI applications that bridge digital and physical worlds.

## Teardown

To avoid ongoing charges:

```bash
cd infrastructure/cdk
cdk destroy

# Confirm when prompted
# Removes: EC2, VPC, DynamoDB, Lambda, ECR, IoT Thing, certificates
```

**Cost Reality**: ~£10/month if left running (t4g.small + Bedrock usage). Always destroy when done.

---

## Next Steps

Consider extending this project:

- **Multiple Devices**: Scale to control many M5Sticks
- **Custom Tools**: Add more agent capabilities (temperature, motion, etc.)
- **Monitoring**: CloudWatch dashboards and alarms
- **CI/CD**: Automate deployments with GitHub Actions
- **Multi-Region**: Deploy to multiple edge locations
- **Production Hardening**: Add error recovery, health checks, auto-scaling

## Resources

- [AWS IoT Core Documentation](https://docs.aws.amazon.com/iot/)
- [AWS IoT Greengrass Documentation](https://docs.aws.amazon.com/greengrass/)
- [Strands Agents Documentation](https://strandsagents.com/latest/documentation/docs/)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)

---
