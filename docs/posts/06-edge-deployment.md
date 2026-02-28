---
layout: default
title: "Part 6: Edge Deployment with CDK"
---

# Part 6: Edge Deployment with CDK and Greengrass

We've built an AI agent that controls our M5Stick. Now let's deploy it to the edge.

## Why Edge?

- Lower latency (sub-second)
- Works with intermittent connectivity
- Less data to cloud = lower costs
- Processing stays local
- Each edge location runs independently

## Architecture

![edge architecture](../diagrams/edge-architecture.svg)

## AWS IoT Greengrass

Greengrass extends AWS to edge devices for local compute, ML inference (if you having sufficent compute resources), and secure communication.

**Key Concepts:**

**Nucleus**: Core runtime that manages everything on the device.

**Components** (the "what"): Software that runs on the device. Each component has:
- Recipe: Configuration (what to run, how to run it)
- Artifacts: The actual code (Docker images, binaries, scripts)
- Can be custom or AWS-provided (stream manager, Docker support)

**Deployments** (the "how"): Mechanism to push components to devices. Defines which component versions run on which devices. Enables OTA updates to one device or thousands.

**Our Approach:**

We install Greengrass Nucleus for device provisioning and IoT connectivity, then run the agent as **standalone Docker** (not a Greengrass component).

For this demo, we run Docker directly (SSH in, run `agent`). Simpler to debug and iterate.

For production with many devices, you'd package the agent as a Greengrass component and use deployments for OTA updates. We include `greengrass-recipe.yaml` as a starting point if you want to try this.

## CDK Setup

AWS CDK (love it or hate it) defines infrastructure as TypeScript code.

```bash
cd infrastructure/cdk
npm install

# Configure AWS
aws configure sso  # or aws configure

# Bootstrap CDK (first time only)
# Creates S3 bucket and ECR repo for CDK assets
cdk bootstrap

# Optional: Use Podman instead of Docker
export CDK_DOCKER=podman
```

**Bootstrap Note**: First time per account/region. Creates S3 bucket, ECR repo, and IAM roles.

## The Stack

`lib/robotinc-stack.ts` creates:

**Networking**
- VPC with private subnets and NAT Gateway
- VPC Endpoints for Bedrock, IoT Core, DynamoDB, ECR, SSM (no internet gateway needed)

**Compute**
- EC2 t4g.small ARM64 (cost-optimised)
- Greengrass Core (auto-installed via SSM)
- Docker for agent container

**Storage**
- DynamoDB for device state
- ECR for Docker images
- S3 for deployment artifacts

**Automation**
- SSM Document: Greengrass setup script
- SSM Association: Triggers setup on instance
- Lambda: Processes device state updates

**Key Code:**

```typescript
// t4g.small ARM64 - cost optimized
const greengrassInstance = new ec2.Instance(this, 'GreengrassInstance', {
  vpc,
  instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
  machineImage: ec2.MachineImage.latestAmazonLinux2023({ 
    cpuType: ec2.AmazonLinuxCpuType.ARM_64 
  }),
  role: greengrassRole,
  vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
  requireImdsv2: true
});

// Build and push Docker image
const agentImage = new ecrAssets.DockerImageAsset(this, 'AgentImage', {
  directory: path.join(__dirname, '../../../components/edge-agent'),
  platform: ecrAssets.Platform.LINUX_ARM64
});
```

## Deploy

```bash
cd infrastructure/cdk
cdk deploy

# Output:
# RobotincStack.AgentImageUri = 659587496222.dkr.ecr...
# RobotincStack.InstanceIdOutput = i-0520...
```

One command:
1. Builds Docker image for ARM64
2. Pushes to ECR
3. Creates VPC and networking
4. Launches EC2 instance
5. Installs Greengrass via SSM
6. Creates DynamoDB table
7. Sets up Lambda and IoT rules

## Operating at the Edge

**Automated Greengrass Setup**

SSM document provisions Greengrass:

```bash
yum install -y docker git java-17-amazon-corretto-headless
usermod -a -G docker ec2-user
usermod -a -G docker ssm-user

java -jar Greengrass.jar \
  --aws-region ${region} \
  --thing-name robotinc-greengrass-core \
  --provision true \
  --setup-system-service true
```

Creates IoT Thing, device certificates, and systemd service.

**Running the Agent**

We run the agent as standalone Docker, not as a Greengrass component.

SSM document creates shell aliases:

```bash
agent          # Normal mode
agent-verbose  # Detailed logging
```

Behind the scenes:
```bash
# What 'agent' actually runs:
docker run -it --rm --network host \
  -e AWS_REGION=eu-west-2 \
  -e OLLAMA_HOST=http://localhost:11434 \
  <image-uri>
```

**Accessing the Instance**

```bash
# Get instance ID
INSTANCE_ID=$(aws cloudformation describe-stacks \
  --stack-name RobotincStack \
  --query 'Stacks[0].Outputs[?OutputKey==`InstanceIdOutput`].OutputValue' \
  --output text)

# Connect via SSM (no SSH keys!)
aws ssm start-session --target $INSTANCE_ID

# Check Greengrass
sudo systemctl status greengrass

# Run agent
agent
```

**Agent in Action:**

```bash
agent

============================================================
  Robotinc IoT Edge Agent
  AI-Powered Device Control
============================================================

Commands: 'turn red', 'get status', 'show history', 'quit'

------------------------------------------------------------

You: turn it ocean blue
Agent: Changed device to cyan

You: show history
Agent: Recent history:
2024-01-15T10:30:00: RGB(0, 128, 128)
2024-01-15T10:25:00: RGB(255, 0, 0)
2024-01-15T10:20:00: RGB(0, 0, 255)

You: quit
Shutting down agent...
```

**Verbose Mode:**

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
---

[Part 7: Observability & Troubleshooting →](07-observability.html)

[Part 8: What We've Learned & Teardown →](08-wrap-up.html)
