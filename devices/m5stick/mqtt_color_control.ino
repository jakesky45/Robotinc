#include <M5StickCPlus.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// MQTT settings - using public broker for simplicity
const char* mqtt_server = "test.mosquitto.org";
const char* device_id = "robotinc-m5stick-001";
String command_topic = "robotinc/device/command/" + String(device_id);
String status_topic = "robotinc/device/status/" + String(device_id);

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  M5.begin();
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(TFT_BLACK);
  M5.Lcd.setTextColor(TFT_WHITE);
  M5.Lcd.println("Starting...");
  
  connectWiFi();
  client.setServer(mqtt_server, 1883);
  client.setCallback(onMqttMessage);
  connectMQTT();
}

void loop() {
  M5.update();
  
  if (!client.connected()) {
    connectMQTT();
  }
  client.loop();
  
  delay(100);
}

void connectWiFi() {
  WiFi.begin(ssid, password);
  M5.Lcd.print("Connecting WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    M5.Lcd.print(".");
  }
  
  M5.Lcd.println("\nWiFi Connected!");
}

void connectMQTT() {
  while (!client.connected()) {
    M5.Lcd.println("Connecting MQTT...");
    
    if (client.connect(device_id)) {
      M5.Lcd.println("MQTT Connected!");
      client.subscribe(command_topic.c_str());
      
      // Send "I'm alive" message
      client.publish(status_topic.c_str(), "{\"status\":\"online\"}");
    } else {
      delay(2000);
    }
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Parse JSON command
  StaticJsonDocument<200> doc;
  deserializeJson(doc, payload, length);
  
  String action = doc["action"];
  String value = doc["value"];
  
  if (action == "color") {
    changeColor(value);
    
    // Send confirmation
    String response = "{\"status\":\"Device screen set to " + value + "\"}";
    client.publish(status_topic.c_str(), response.c_str());
  }
}

void changeColor(String color) {
  uint16_t colorCode = TFT_BLACK;
  
  if (color == "blue") colorCode = TFT_BLUE;
  else if (color == "red") colorCode = TFT_RED;
  else if (color == "green") colorCode = TFT_GREEN;
  else if (color == "yellow") colorCode = TFT_YELLOW;
  
  M5.Lcd.fillScreen(colorCode);
  M5.Lcd.setTextColor(TFT_WHITE);
  M5.Lcd.setCursor(10, 10);
  M5.Lcd.println("Color: " + color);
}