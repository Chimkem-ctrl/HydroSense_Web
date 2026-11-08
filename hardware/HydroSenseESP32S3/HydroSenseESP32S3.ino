#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <ModbusMaster.h>

#define ONE_WIRE_BUS 4
#define PH_SENSOR_PIN 1
#define RS485_RX_PIN 8
#define RS485_TX_PIN 18
#define SENSOR_SLAVE_ID 1
#define DO_RX_PIN 16
#define DO_TX_PIN 11
#define DO_SLAVE_ID 1
#define WIFI_SETUP_BUTTON_PIN 0

const char* HYDROSENSE_API_URL =
  "https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api/v1/ingest/readings";
const char* HARDWARE_API_KEY =
  "hydrosense_hardware_2026_fixed_7f3d2a91";

const float CAL_SLOPE = -5.689;
const float CAL_INTERCEPT = 21.08;
const int NUM_PH_SAMPLES = 20;

// Saved sensor calculation reference:
// DS18B20 temperature = raw 16-bit register / 16.0.
// pH voltage = (ADC moving average / 4095) * 3.3.
// pH = (-5.689 * pH voltage) + 21.08.
// EC probe temperature = signed 16-bit register / 10.0.
// DO saturation/concentration/probe temperature = two-register IEEE-754 float.

OneWire* oneWire = nullptr;
DallasTemperature* sensors = nullptr;
ModbusMaster* modbusNode = nullptr;
ModbusMaster* modbusDO = nullptr;
HardwareSerial SerialModbus(2);
HardwareSerial SerialDO(1);
Preferences preferences;
WebServer provisionServer(80);
DNSServer dnsServer;

String savedWifiSsid;
String savedWifiPassword;
String savedDeviceId;
bool provisioningMode = false;

float currentTemp = 0.0;
float currentPH = 0.0;
float currentEC = 0.0;
float currentECTemperature = 0.0;
float currentSalinity = 0.0;
float currentTDS = 0.0;
float currentDO_mgL = 0.0;
float currentDO_sat = 0.0;
float currentDO_temp = 0.0;
bool doValid = false;

void readDS18B20();
void readPH();
void readRS485Modbus();
void readDO();
void printModbusError(uint8_t res);
float regsToFloat(uint16_t hi, uint16_t lo);
void sendReading();
void connectSavedWiFi();
void loadDeviceId();
void startWiFiProvisioning();
void handleProvisioningRoot();
void handleProvisioningSave();
void handleProvisioningReset();
void handleProvisioningOptions();

void setup() {
  Serial.begin(115200);
  delay(1000);
  unsigned long serialWaitStart = millis();
  while (!Serial && millis() - serialWaitStart < 3000) {
    delay(10);
  }
  Serial.println();
  Serial.println("HydroSense ESP32-S3 firmware started");
  Serial.printf("USB CDC status: %s\n", Serial ? "connected" : "not detected");
  pinMode(WIFI_SETUP_BUTTON_PIN, INPUT_PULLUP);
  bool forceWiFiSetup = digitalRead(WIFI_SETUP_BUTTON_PIN) == LOW;
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  loadDeviceId();

  oneWire = new OneWire(ONE_WIRE_BUS);
  sensors = new DallasTemperature(oneWire);
  sensors->begin();

  SerialModbus.begin(4800, SERIAL_8N1, RS485_RX_PIN, RS485_TX_PIN);
  modbusNode = new ModbusMaster();
  modbusNode->begin(SENSOR_SLAVE_ID, SerialModbus);

  SerialDO.begin(4800, SERIAL_8N1, DO_RX_PIN, DO_TX_PIN);
  modbusDO = new ModbusMaster();
  modbusDO->begin(DO_SLAVE_ID, SerialDO);

  if (forceWiFiSetup) {
    Serial.println("Wi-Fi setup button detected. Starting setup hotspot.");
  } else {
    connectSavedWiFi();
  }
  if (forceWiFiSetup || savedDeviceId.isEmpty() || WiFi.status() != WL_CONNECTED) {
    startWiFiProvisioning();
  }
}

void loop() {
  if (provisioningMode) {
    dnsServer.processNextRequest();
    provisionServer.handleClient();
    delay(10);
    return;
  }

  readDS18B20();
  readPH();
  readRS485Modbus();
  readDO();
  sendReading();
  delay(3000);
}

void connectSavedWiFi() {
  preferences.begin("hydrosense", false);
  savedWifiSsid = preferences.getString("wifi_ssid", "");
  savedWifiPassword = preferences.getString("wifi_password", "");
  preferences.end();

  if (savedWifiSsid.isEmpty()) {
    Serial.println("No saved Wi-Fi credentials. Starting setup hotspot.");
    return;
  }

  WiFi.mode(WIFI_STA);
  WiFi.begin(savedWifiSsid.c_str(), savedWifiPassword.c_str());
  Serial.print("Connecting to saved Wi-Fi");
  unsigned long started = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - started < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println(WiFi.status() == WL_CONNECTED ? "Wi-Fi connected" : "Saved Wi-Fi connection failed");
}

void loadDeviceId() {
  preferences.begin("hydrosense", true);
  savedDeviceId = preferences.getString("device_id", "");
  preferences.end();
  savedDeviceId.trim();
}

void startWiFiProvisioning() {
  provisioningMode = true;
  WiFi.disconnect();
  WiFi.mode(WIFI_AP);

  uint64_t mac = ESP.getEfuseMac();
  char suffix[5];
  snprintf(suffix, sizeof(suffix), "%04X", static_cast<uint16_t>(mac & 0xFFFF));
  String apName = String("HydroSense-Setup-") + suffix;
  WiFi.softAP(apName.c_str(), "hydrosense");

  dnsServer.start(53, "*", WiFi.softAPIP());
  provisionServer.on("/", HTTP_GET, handleProvisioningRoot);
  provisionServer.on("/save", HTTP_POST, handleProvisioningSave);
  provisionServer.on("/reset", HTTP_POST, handleProvisioningReset);
  provisionServer.on("/save", HTTP_OPTIONS, handleProvisioningOptions);
  provisionServer.on("/generate_204", HTTP_GET, handleProvisioningRoot);
  provisionServer.on("/hotspot-detect.html", HTTP_GET, handleProvisioningRoot);
  provisionServer.onNotFound(handleProvisioningRoot);
  provisionServer.begin();

  Serial.println("Wi-Fi setup hotspot started");
  Serial.printf("Network: %s\n", apName.c_str());
  Serial.println("Password: hydrosense");
  Serial.printf("Setup page: http://%s\n", WiFi.softAPIP().toString().c_str());
}

void handleProvisioningRoot() {
  provisionServer.send(200, "text/html",
    "<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">"
    "<title>HydroSense Wi-Fi Setup</title></head><body style=\"font-family:Arial;max-width:420px;margin:40px auto;padding:0 20px\">"
    "<h2>HydroSense Wi-Fi Setup</h2>"
    "<form method=\"POST\" action=\"/save\">"
    "<label>Tank device ID</label><br><input name=\"device_id\" value=\"" + savedDeviceId + "\" placeholder=\"HS-001\" required style=\"width:100%;padding:10px;margin:8px 0 16px\">"
    "<label>Wi-Fi network</label><br><input name=\"ssid\" required style=\"width:100%;padding:10px;margin:8px 0 16px\">"
    "<label>Wi-Fi password</label><br><input name=\"password\" type=\"password\" required style=\"width:100%;padding:10px;margin:8px 0 16px\">"
    "<button type=\"submit\" style=\"width:100%;padding:12px;background:#1677a8;color:white;border:0\">Connect ESP32</button>"
    "</form><form method=\"POST\" action=\"/reset\" style=\"margin-top:12px\"><button type=\"submit\">Clear saved Wi-Fi</button></form>"
    "</body></html>");
}

void handleProvisioningSave() {
  String ssid = provisionServer.arg("ssid");
  String password = provisionServer.arg("password");
  String deviceId = provisionServer.arg("device_id");
  ssid.trim();
  deviceId.trim();
  provisionServer.sendHeader("Access-Control-Allow-Origin", "*");
  provisionServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");

  if (ssid.isEmpty()) {
    provisionServer.send(400, "text/plain", "Wi-Fi network is required.");
    return;
  }
  if (deviceId.isEmpty()) {
    provisionServer.send(400, "text/plain", "Tank device ID is required.");
    return;
  }

  preferences.begin("hydrosense", false);
  preferences.putString("wifi_ssid", ssid);
  preferences.putString("wifi_password", password);
  preferences.putString("device_id", deviceId);
  preferences.end();

  provisionServer.send(200, "text/html",
    "<h2>Wi-Fi saved</h2><p>The ESP32 will restart and connect automatically.</p>");
  Serial.printf("Saved Wi-Fi network: %s\n", ssid.c_str());
  Serial.printf("Saved tank device ID: %s\n", deviceId.c_str());
  delay(1000);
  ESP.restart();
}

void handleProvisioningOptions() {
  provisionServer.sendHeader("Access-Control-Allow-Origin", "*");
  provisionServer.sendHeader("Access-Control-Allow-Headers", "Content-Type");
  provisionServer.sendHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  provisionServer.send(204);
}

void handleProvisioningReset() {
  preferences.begin("hydrosense", false);
  preferences.clear();
  preferences.end();
  provisionServer.send(200, "text/html",
    "<h2>Saved Wi-Fi cleared</h2><p>The ESP32 will restart.</p>");
  delay(1000);
  ESP.restart();
}

void readDS18B20() {
  if (!sensors) return;
  sensors->requestTemperatures();
  currentTemp = sensors->getTempCByIndex(0);
}

void readPH() {
  long rawSum = 0;
  for (int i = 0; i < NUM_PH_SAMPLES; i++) {
    rawSum += analogRead(PH_SENSOR_PIN);
    delay(2);
  }
  float voltage = ((float)rawSum / NUM_PH_SAMPLES / 4095.0) * 3.3;
  currentPH = (CAL_SLOPE * voltage) + CAL_INTERCEPT;
}

void readRS485Modbus() {
  if (!modbusNode) return;
  while (SerialModbus.available() > 0) SerialModbus.read();
  delay(50);
  uint8_t result = modbusNode->readHoldingRegisters(0x0000, 4);
  if (result == modbusNode->ku8MBSuccess) {
    currentEC = modbusNode->getResponseBuffer(0);
    currentECTemperature = (int16_t)modbusNode->getResponseBuffer(1) / 10.0;
    currentSalinity = modbusNode->getResponseBuffer(2);
    currentTDS = modbusNode->getResponseBuffer(3);
  }
}

void readDO() {
  if (!modbusDO) return;
  while (SerialDO.available() > 0) SerialDO.read();
  delay(50);
  uint8_t result = modbusDO->readHoldingRegisters(0x0000, 6);
  if (result == modbusDO->ku8MBSuccess) {
    currentDO_sat = regsToFloat(modbusDO->getResponseBuffer(0), modbusDO->getResponseBuffer(1)) * 100.0;
    currentDO_mgL = regsToFloat(modbusDO->getResponseBuffer(2), modbusDO->getResponseBuffer(3));
    currentDO_temp = regsToFloat(modbusDO->getResponseBuffer(4), modbusDO->getResponseBuffer(5));
    doValid = true;
  } else {
    doValid = false;
  }
}

float regsToFloat(uint16_t hi, uint16_t lo) {
  uint32_t raw = ((uint32_t)hi << 16) | lo;
  float value;
  memcpy(&value, &raw, sizeof(value));
  return value;
}

void sendReading() {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, HYDROSENSE_API_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Hardware-Api-Key", HARDWARE_API_KEY);

  StaticJsonDocument<384> payload;
  payload["deviceId"] = savedDeviceId;
  payload["temperature"] = currentTemp;
  payload["ph"] = currentPH;
  payload["doMgL"] = doValid ? currentDO_mgL : 0.0;
  payload["ec"] = currentEC;
  payload["salinity"] = currentSalinity;
  payload["tds"] = currentTDS;
  payload["doSaturation"] = currentDO_sat;
  payload["doProbeTemperature"] = currentDO_temp;
  payload["wifiRssi"] = WiFi.RSSI();
  payload["powerSource"] = "grid";
  payload["pendingSyncCount"] = 0;

  String body;
  serializeJson(payload, body);
  int status = http.POST(body);
  if (status > 0) {
    Serial.printf("HydroSense upload HTTP %d: %s\n", status, http.getString().c_str());
  } else {
    Serial.printf("HydroSense upload failed: %s\n", http.errorToString(status).c_str());
  }
  http.end();
}
