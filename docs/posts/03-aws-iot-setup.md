---
layout: default
title: "Part 3: Making M5Stick Talk MQTT"
---

# Part 3: Making M5Stick Talk MQTT

Now we need to upgrade our M5Stick from just showing a blue screen to actually listening for MQTT commands and responding to them. Transforming our simple blue screen into a device that:

- Connects to WiFi
- Subscribes to MQTT topic `robotinc/device/command`
- Changes screen colour based on received commands
- Publishes confirmation messages back

## MQTT Broker: test.mosquitto.org

We're using `test.mosquitto.org` - a free public MQTT broker provided by the Eclipse Foundation. Think of it as the "hello world" of MQTT:

- **Free**: No signup, no configuration needed
- **Public**: Anyone can use it (not secure, but perfect for testing)
- **Reliable**: Been running for years, used by thousands of IoT developers
- **Simple**: Just point your device at it and start sending messages

It's like a village notice board - you can post messages and read what others have posted. Perfect for learning MQTT basics before moving to production.

## M5Stick Code

The complete code is nothing ground breaking, it's available here: `devices/m5stick/mqtt_color_control.ino`

Key configuration you'll need to update:

```cpp
// WiFi credentials
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT settings - using public broker for simplicity
const char* mqtt_server = "test.mosquitto.org";
const char* device_id = "robotinc-m5stick-001";
const char* command_topic = "robotinc/device/command";
const char* status_topic = "robotinc/device/status";
```

## Required Libraries

Install these in Arduino IDE:
1. **PubSubClient** (for MQTT)
2. **ArduinoJson** (for parsing commands)

## Testing

Upload the code and test with any MQTT client or online tool:

**To send commands:**
- **Topic**: `robotinc/device/command`  
- **Message**: `{"action":"color","value":"blue"}`

**To see responses:**
- **Subscribe to**: `robotinc/device/status`
- **You'll see**: `{"status":"Device screen set to blue"}`

```
  if (color == "blue") colorCode = TFT_BLUE;
  else if (color == "red") colorCode = TFT_RED;
  else if (color == "green") colorCode = TFT_GREEN;
  else if (color == "yellow") colorCode = TFT_YELLOW;
```

## Next Steps

Now that basic MQTT works with a public broker, we need to move to production-grade infrastructure with AWS IoT Core and proper security.

## Lessons Learned
- You have so many libraries available in public libraries to inspire your projects
- AWS IOT core does have its own MQTT client, but this requires secure connections
- Spending time on colour vs colour isn't time well spent

[Part 4: Moving to AWS IoT Core with Certificates →](04-aws-iot-core.html)
