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

We create a Greengrass component that runs the agent as a Docker container. CDK deploys the [component recipe](https://github.com/jakesky45/Robotinc/blob/main/infrastructure/cdk/lib/robotinc-stack.ts#L40-L76) automatically - you can view it in the AWS IoT Console under Components or via CLI:

```bash
aws greengrassv2 get-component --arn arn:aws:greengrass:REGION:ACCOUNT:components:com.robotinc.EdgeAgent
```

For quick testing, we also provide a standalone `agent` command (SSH in, run `agent`). Simpler to debug and iterate during development.

The Greengrass component enables OTA updates and centralised management for deployments.

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
- Docker for agent container

**Storage**
- DynamoDB for device state
- ECR for Docker images
- S3 for deployment artifacts

**IoT**
- IoT Thing for M5Stick device
- IoT Rule to log device state to DynamoDB
- Lambda function to process state updates

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

// Build and push Docker image for ARM64
const agentImage = new ecrAssets.DockerImageAsset(this, 'AgentImage', {
  directory: path.join(__dirname, '../../../components/edge-agent'),
  platform: ecrAssets.Platform.LINUX_ARM64
});

// Create helper scripts on instance
greengrassInstance.userData.addCommands(
  `echo 'docker run -it --rm --network host -e AWS_REGION=${this.region} ${agentImage.imageUri}' > /usr/local/bin/agent`,
  'chmod +x /usr/local/bin/agent'
);
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

**Running the Agent**

The agent runs as a Docker container on EC2. CDK creates a helper script:

```bash
agent          # Start the agent
```

Behind the scenes:
```bash
# What 'agent' actually runs:
docker run -it --rm --network host \
  -e AWS_REGION=eu-west-2 \
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

For debugging, run the agent with verbose logging:

```bash
docker run -it --rm --network host \
  -e AWS_REGION=eu-west-2 \
  <image-uri> python agent.py -v

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
