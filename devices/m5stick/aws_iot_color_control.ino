#include <M5StickCPlus.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";

// AWS IoT settings
const char* aws_endpoint = "your-endpoint-ats.iot.us-east-1.amazonaws.com";
const int aws_port = 8883;
const char* device_id = "robotinc-m5stick-001";
String command_topic = "robotinc/device/command/" + String(device_id);
String status_topic = "robotinc/device/status/" + String(device_id);

// AWS IoT certificates (paste your actual certificates here)
const char* root_ca = R"EOF(
-----BEGIN CERTIFICATE-----
[Your Root CA Certificate]
-----END CERTIFICATE-----
)EOF";

const char* device_cert = R"EOF(
-----BEGIN CERTIFICATE-----
[Your Device Certificate]
-----END CERTIFICATE-----
)EOF";

const char* private_key = R"EOF(
-----BEGIN RSA PRIVATE KEY-----
[Your Private Key]
-----END RSA PRIVATE KEY-----
)EOF";

WiFiClientSecure secureClient;
PubSubClient client(secureClient);

void setup() {
  M5.begin();
  M5.Lcd.setRotation(3);
  M5.Lcd.fillScreen(TFT_BLACK);
  M5.Lcd.setTextColor(TFT_WHITE);
  M5.Lcd.println("Starting...");
  
  connectWiFi();
  setupAWS();
  connectAWS();
}

void loop() {
  M5.update();
  
  if (!client.connected()) {
    connectAWS();
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

void setupAWS() {
  secureClient.setCACert(root_ca);
  secureClient.setCertificate(device_cert);
  secureClient.setPrivateKey(private_key);
  
  client.setServer(aws_endpoint, aws_port);
  client.setCallback(onMqttMessage);
}

void connectAWS() {
  while (!client.connected()) {
    M5.Lcd.println("Connecting AWS IoT...");
    
    if (client.connect(device_id)) {
      M5.Lcd.println("AWS IoT Connected!");
      client.subscribe(command_topic.c_str());
      
      // Send "I'm alive" message
      client.publish(status_topic.c_str(), "{\"status\":\"online\"}");
    } else {
      M5.Lcd.println("Failed, retrying...");
      delay(5000);
    }
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  // Parse JSON command
  StaticJsonDocument<200> doc;
  deserializeJson(doc, payload, length);
  
  String action = doc["action"];
  
  if (action == "color") {
    // Check if RGB values are provided
    if (doc.containsKey("r") && doc.containsKey("g") && doc.containsKey("b")) {
      int r = doc["r"];
      int g = doc["g"];
      int b = doc["b"];
      changeColorRGB(r, g, b);
      
      // Send confirmation
      String response = "{\"status\":\"RGB(" + String(r) + "," + String(g) + "," + String(b) + ") set\"}";
      client.publish(status_topic.c_str(), response.c_str());
    } else {
      // Fallback to color name
      String value = doc["value"];
      changeColor(value);
      
      // Send confirmation
      String response = "{\"status\":\"Device screen set to " + value + "\"}";
      client.publish(status_topic.c_str(), response.c_str());
    }
  }
}

void changeColorRGB(int r, int g, int b) {
  // Convert RGB to 16-bit color (RGB565)
  uint16_t colorCode = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
  
  M5.Lcd.fillScreen(colorCode);
  M5.Lcd.setTextColor(TFT_WHITE);
  M5.Lcd.setCursor(10, 10);
  M5.Lcd.println("RGB: " + String(r) + "," + String(g) + "," + String(b));
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