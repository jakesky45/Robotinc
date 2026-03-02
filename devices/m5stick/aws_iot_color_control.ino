#include <M5StickCPlus2.h>
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
  auto cfg = M5.config();
  StickCP2.begin(cfg);
  StickCP2.Display.setRotation(3);
  StickCP2.Display.fillScreen(TFT_BLACK);
  StickCP2.Display.setTextColor(TFT_WHITE);
  StickCP2.Display.println("Starting...");
  
  connectWiFi();
  setupAWS();
  connectAWS();
}

void loop() {
  StickCP2.update();
  if (!client.connected()) connectAWS();
  client.loop();
  delay(100);
}

void connectWiFi() {
  WiFi.begin(ssid, password);
  StickCP2.Display.print("WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    StickCP2.Display.print(".");
  }
  StickCP2.Display.println("\nConnected!");
}

void setupAWS() {
  secureClient.setCACert(root_ca);
  secureClient.setCertificate(device_cert);
  secureClient.setPrivateKey(private_key);
  client.setServer(aws_endpoint, aws_port);
  client.setCallback(onMqttMessage);
}

void connectAWS() {
  int attempts = 0;
  while (!client.connected() && attempts < 3) {
    StickCP2.Display.println("AWS IoT...");
    if (client.connect(device_id)) {
      StickCP2.Display.println("Connected!");
      client.subscribe(command_topic.c_str());
      client.publish(status_topic.c_str(), "{\"status\":\"online\"}");
    } else {
      StickCP2.Display.print("Fail:");
      StickCP2.Display.println(client.state());
      attempts++;
      delay(5000);
    }
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<200> doc;
  deserializeJson(doc, payload, length);
  
  if (doc["action"] == "color" && doc.containsKey("r")) {
    int r = doc["r"], g = doc["g"], b = doc["b"];
    uint16_t color = ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
    StickCP2.Display.fillScreen(color);
    StickCP2.Display.setTextColor(TFT_WHITE);
    StickCP2.Display.setCursor(10, 10);
    StickCP2.Display.print("RGB:");
    StickCP2.Display.print(r);
    StickCP2.Display.print(",");
    StickCP2.Display.print(g);
    StickCP2.Display.print(",");
    StickCP2.Display.println(b);
    
    String resp = "{\"status\":\"RGB(" + String(r) + "," + String(g) + "," + String(b) + ") set\"}";
    client.publish(status_topic.c_str(), resp.c_str());
  }
}
