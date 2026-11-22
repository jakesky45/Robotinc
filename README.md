# Robotinc - Physical AI with AWS

> *Building the bridge between digital intelligence and physical action*

[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://jakesky45.github.io/Robotinc/)
[![AWS](https://img.shields.io/badge/AWS-IoT%20%7C%20Bedrock%20%7C%20Greengrass-orange)](https://aws.amazon.com)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

A Physical AI system demonstrating how AI agents can control real-world hardware through natural language. Built with AWS IoT Core, Bedrock, Greengrass, and deployed at the edge.

## What It Does

Tell an AI agent what you want in plain English, and watch it control physical hardware:

```
You:   "Turn it ocean blue"
Agent: *thinks* → *converts color* → *sends command*
Device: *screen turns cyan*
Agent: "Changed device to cyan"
```

## Architecture

![Architecture Diagram](docs/diagrams/architecture.svg)


## Quick Start

### Prerequisites

- AWS Account with billing permissions
- M5Stick-C Plus (or equivalent ESP32 board)
- AWS CLI configured
- Node.js 18+
- Docker or Podman

### Deploy in 3 Steps

```bash
# 1. Bootstrap CDK (first time only)
cd infrastructure/cdk
npm install
cdk bootstrap

# 2. Deploy everything
export CDK_DOCKER=podman  # Optional: use Podman instead of Docker
cdk deploy

# 3. Connect and run
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name RobotincStack \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceIdOutput`].OutputValue' \
  --output text)

aws ssm start-session --target $INSTANCE_ID
agent  # Start the AI agent or agent-verbose for some vebose MQTT logging
 
```

## Documentation

Full tutorial series available at **[jakesky45.github.io/Robotinc](https://jakesky45.github.io/Robotinc/)**

- Part 1: Setting Up the M5Stick Device
- Part 2: MQTT Setup
- Part 3: AWS IoT Setup
- Part 4: Moving to AWS IoT Core with Certificates
- Part 5: Building with Strands Agents
- Part 6: Edge Deployment with CDK and Greengrass
- Part 7: Observability & Troubleshooting (Bonus)
- Part 8: What We've Learned & Teardown

## Tech Stack

- **AI/ML**: AWS Bedrock (Nova Lite), Strands Agents SDK
- **IoT**: AWS IoT Core, MQTT, X.509 certificates
- **Edge**: AWS IoT Greengrass V2, Docker containers
- **Infrastructure**: AWS CDK (TypeScript), EC2 (t4g.small ARM64)
- **Storage**: DynamoDB, ECR
- **Hardware**: M5Stick-C Plus (ESP32)ß

## Cost

~£10/month if left running:
- EC2 t4g.small: ~£8/month
- Bedrock Nova Lite: ~£0.0006 per 1K tokens
- IoT Core: First 1M messages free
- DynamoDB: On-demand pricing

**Always run `cdk destroy` when done to avoid charges!**

## Features

-  Natural language control of physical devices
-  Multi agent architecture with specialised tools
-  Edge deployment with automatic provisioning
-  Infrastructure as Code with AWS CDK
-  certificate based authentication
-  State logging and history tracking
-  Verbose debugging mode

## Project Structure

```
Robotinc/
├── infrastructure/cdk/      # AWS CDK infrastructure (TypeScript)
├── components/edge-agent/   # AI agent (Python + Strands)
├── devices/m5stick/         # M5Stick firmware (Arduino)
└── docs/                    # GitHub Pages documentation
```

## Cleanup

```bash
cd infrastructure/cdk
cdk destroy
```

## License

MIT License - see [LICENSE](LICENSE) file

---

