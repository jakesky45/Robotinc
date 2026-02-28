---
layout: default
title: "Part 5: Building with Strands Agents"
---

# Part 5: Building with Strands Agents

We have secure device communication, but we're still sending JSON. Let's add the AI layer.

**Model Choice: Amazon Nova Lite**

Bedrock has many options:
- **Nova Micro**: Fast, cheap, not the sharpest tool in the box
- **Nova Lite**: Fast, cheap, smart enough
- **Nova Pro**: Overkill for "turn it blue"
- **Claude**: Excellent all rounder but arguably more pricey for continuous operation

Nova Lite is the "just right" for device control.

## Strands Agents SDK

[Strands](https://strandsagents.com/latest/documentation/docs/) is hitting the headlines, an open source SDK for building AI agents. AWS teams use it in production (Q Developer, Glue).

Why Strands:
- Code-first
- Works with any Bedrock model
- Deploy anywhere (local, Lambda, EC2, Greengrass)

## The Goal

Stop sending `{"action":"color","r":255,"g":0,"b":0}`. Start saying:
- "Turn it ocean blue"
- "Make it sunset orange" 
- "Show me the history"

Agent handles intent, RGB conversion, and MQTT.

## Architecture

![Architecture](../diagrams/architecture.svg)

Flow:
1. Natural language → Bedrock
2. Colour extraction → specialised sub-agent
3. RGB conversion → Python `color` library
4. MQTT publish → AWS IoT Core
5. State queries → DynamoDB via IOT rules

**State Logging via IoT Rules**

IoT Rules are serverless event handlers. Our setup:
- Rule: `SELECT * FROM 'robotinc/device/status/#'`
- Action: Invoke Lambda
- Lambda: Write to DynamoDB

Why DynamoDB? Agent can query "What colour is the device?" without tracking state itself. Devices publish, Lambda logs, agent queries. Clean separation.

## Multi-Agent Pattern

**Main Agent** routes requests to tools:
- Colour commands → `color_control`
- Status requests → `device_status`
- History queries → `device_history`
- Help → `help_info`

**Why Tools Stop Hallucination**

Without tools, LLMs make stuff up:
- "The device is red" (it doesn't know)
- "I'll set RGB(100, 150, 200)" (invented values)
- "Success!" (command failed)

With tools:
- Device commands go through real MQTT publish
- Status comes from DynamoDB queries
- Colour conversion uses Python's `color` library
- Errors are real errors

The agent can only do what its tools allow.

**Colour Extraction Sub-Agent**

Specialised agent extracts CSS/X11 colour names:
- "colour of the sea" → "cyan"
- "sunset orange" → "orange"
- "forest green" → "forestgreen"

Keeps the main agent focused on routing.

## Agent Implementation

The complete agent code is in `components/edge-agent/agent.py`. Here are the key implementation patterns:

### Prompt Engineering with XML

XML-structured prompts:

```xml
<routing_rules>
  <color_control>
    <triggers>"turn", "make", "change", "set"</triggers>
    <tool>color_control</tool>
  </color_control>
</routing_rules>

<critical_rule>
You MUST return ONLY the exact tool output.
</critical_rule>
```

XML works because LLMs parse structure better than prose. Plus it's easy to version control.

### Guardrails

Physical AI needs constraints:

**Tool-Based**: Agent can only execute defined tools. No direct hardware access.

**Output Validation**: 
```
<critical_rule>
You MUST return ONLY the exact tool output. 
Do NOT add commentary.
</critical_rule>
```
Prevents inventing results.

**Error Handling**: Tools return real errors. Failed MQTT publishes are reported accurately.

**State Verification**: Device status from DynamoDB, not agent memory. Colour conversion uses deterministic library.

## Strands vs Bedrock Agents Console

**Strands**: Code-first, version control, deploy anywhere

**Bedrock Console**: Visual builder, quick prototyping, no code

We chose Strands for developer experience and flexibility.

## Next: Edge Deployment

We're done with local development. Time to deploy to the edge with CDK, Greengrass, and containers.

[Part 6: Edge Deployment with CDK and Greengrass →](06-edge-deployment.html)
