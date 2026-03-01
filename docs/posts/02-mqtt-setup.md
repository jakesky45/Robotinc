---
layout: default
title: "Part 2: Why MQTT for IoT Communication"
---

# Part 2: Why MQTT for IoT Communication

Now that our M5Stick is working, we need a way for it to talk to our AI agents. MQTT is the de facto messaging protocol for IoT devices. Many messaging services use this as standard (I was using Solace previously without even knowing it). MQTT stands for Message Queuing Telemetry Transport.

## Why not just use HTTPS like everything else?

**HTTPS is great for web browsers, not so great for IoT:**
- Heavy overhead (TLS handshakes, HTTP headers)
- Request-response only (no real-time updates)
- Battery killer for small devices
- Overkill for simple messages events e.g. "turn blue"

**MQTT is built for IoT:**
- Lightweight (2-byte headers)
- Publish-subscribe (devices can listen for commands)
- Battery friendly (persistent connections)
- Perfect for simple messages

## MQTT Packet Structure

Here's what an MQTT message actually looks like:

![MQTT Packet Structure](../diagrams/mqtt-packet-diagram.svg)

I always remember the saying "Keep It Simple Stupid" - here we have just enough information to get the message where it needs to go, nothing more.

## Our Use Case

For our Physical AI demo:
- **Topic**: `robotinc/device/command`
- **Payload**: `{"action": "color", "value": "blue"}`
- **QoS**: 1 (at least once delivery)

Our M5Stick subscribes to a command topic, receives the colour change request, updates its screen and publishes back a confirmation.

## Next Steps

[Part 3: Connecting to AWS IoT Core →](03-aws-iot-setup.html)