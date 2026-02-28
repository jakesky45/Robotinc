---
layout: default
title: Robotinc - Physical AI Demo
---

# Building Physical AI with AWS

> *"The next frontier of AI isn't just understanding the world, it's acting within it."*

Inspired by AWS's vision for Physical AI, this project combines IoT hardware, edge processing, and cloud AI to build a system where agents perceive, reason, and act in the real world.

**The Goal**: Introduce ourselves to AI that controls physical hardware through natural language. Keeping the hardware simple; an ESP32 board with an LED screen. What's more interesting is agents in the cloud that understand intent, make decisions, and trigger real-world actions.

We're building this using IoT Core and Greengrass and Strands Agents in AWS.

## How It Works

Tell an AI agent what you want, and it makes hardware do it.

![Flow Diagram](diagrams/flow-diagram.svg)

## What You'll Need

- **AWS Account**: With the bills payers permissions
- **M5Stick-C Plus**: Or equivalent ESP32 development board
- **AWS CLI**: Configured with credentials (sufficent to build)
- **Node.js 18+**: For AWS CDK
- **Docker or Podman**: For building container images
- **Basic Command Line**: some bash/terminal knowledge

## Blog Posts

- [Part 1: Setting Up the M5Stick Device](posts/01-m5stick-setup.html)
- [Part 2: MQTT Setup](posts/02-mqtt-setup.html)
- [Part 3: AWS IoT Setup](posts/03-aws-iot-setup.html)
- [Part 4: Moving to AWS IoT Core with Certificates](posts/04-aws-iot-core.html)
- [Part 5: Building with Strands Agents](posts/05-strands-agents.html)
- [Part 6: Edge Deployment with CDK and Greengrass](posts/06-edge-deployment.html)
- [Part 7: Observability & Troubleshooting (Bonus)](posts/07-observability.html)
- [Part 8: What We've Learned & Teardown](posts/08-wrap-up.html)

## Code

[GitHub Repository](https://github.com/jakesky45/Robotinc)
