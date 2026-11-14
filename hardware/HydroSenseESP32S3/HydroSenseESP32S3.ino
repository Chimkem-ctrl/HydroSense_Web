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
#include <SPI.h>
#include <SD.h>
#include <time.h>

#define ONE_WIRE_BUS 4
#define PH_SENSOR_PIN 1
#define DO_RX_PIN 16
#define DO_TX_PIN 11
#define DO_SLAVE_ID 1
#define SIM_TX_PIN 17
#define SIM_RX_PIN 18
#define SD_CS_PIN 10
#define SD_MOSI_PIN 14
#define SD_SCK_PIN 12
#define SD_MISO_PIN 13
#define WIFI_SETUP_BUTTON_PIN 0

const char* HYDROSENSE_API_URL =
  "https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api/v1/ingest/readings";
const char* HARDWARE_API_KEY =
  "REPLACE_WITH_HARDWARE_API_KEY";
const char* SMS_CLAIM_URL =
  "https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api/v1/hardware/sms/claim";
const char* SMS_COMPLETE_URL =
  "https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api/v1/hardware/sms/complete";
const char* THRESHOLDS_URL =
  "https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api/v1/hardware/thresholds";
const char* SMS_ROOT_CA = R"EOF(
-----BEGIN CERTIFICATE-----
MIIDdTCCAl2gAwIBAgILBAAAAAABFUtaw5QwDQYJKoZIhvcNAQEFBQAwVzELMAkGA1UEBhMC
QkUxGTAXBgNVBAoTEEdsb2JhbFNpZ24gbnYtc2ExEDAOBgNVBAsTB1Jvb3QgQ0ExGzAZBgNV
BAMTEkdsb2JhbFNpZ24gUm9vdCBDQTAeFw05ODA5MDExMjAwMDBaFw0yODAxMjgxMjAwMDBa
MFcxCzAJBgNVBAYTAkJFMRkwFwYDVQQKExBHbG9iYWxTaWduIG52LXNhMRAwDgYDVQQLEwdS
b290IENBMRswGQYDVQQDExJHbG9iYWxTaWduIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUA
A4IBDwAwggEKAoIBAQDaDuaZjc6j40+Kfvvxi4Mla+pIH/EqsLmVEQS98GPR4mdmzxzdzxtI
K+6NiY6arymAZavpxy0Sy6scTHAHoT0KMM0VjU/43dSMUBUc71DuxC73/OlS8pF94G3VNTCO
XkNz8kHp1Wrjsok6Vjk4bwY8iGlbKk3Fp1S4bInMm/k8yuX9ifUSPJJ4ltbcdG6TRGHRjcdG
snUOhugZitVtbNV4FpWi6cgKOOvyJBNPc1STE4U6G7weNLWLBYy5d4ux2x8gkasJU26Qzns3
dLlwR5EiUWMWea6xrkEmCMgZK9FGqkjWZCrXgzT/LCrBbBlDSgeF59N89iFo7+ryUp9/k5DP
AgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRg
e2YaRQ2XyolQL30EzTSo//z9SzANBgkqhkiG9w0BAQUFAAOCAQEA1nPnfE920I2/7LqivjTF
KDK1fPxsnCwrvQmeU79rXqoRSLblCKOzyj1hTdNGCbM+w6DjY1Ub8rrvrTnhQ7k4o+YviiY7
76BQVvnGCv04zcQLcFGUl5gE38NflNUVyRRBnMRddWQVDf9VMOyGj/8N7yy5Y0b2qvzfvGn9
LhJIZJrglfCm7ymPAbEVtQwdpf5pLGkkeB6zpxxxYu7KyJesF12KwvhHhm4qxFYxldBniYUr
+WymXUadDKqC5JlR3XC321Y9YeRq4VzW9v493kHMB65jUr9TU/Qr6cf9tveCX4XSQRjbgbME
HMUfpIBvFSDJ3gyICh3WZlXi/EjJKSZp4A==
-----END CERTIFICATE-----
)EOF";

const float CAL_SLOPE = -5.689;
const float CAL_INTERCEPT = 21.08;
const int NUM_PH_SAMPLES = 20;

// Saved sensor calculation reference:
// DS18B20 temperature = raw 16-bit register / 16.0.
// pH voltage = (ADC moving average / 4095) * 3.3.
// pH = (-5.689 * pH voltage) + 21.08.
// DO saturation/concentration/probe temperature = two-register IEEE-754 float.

class ModbusDiagnosticStream : public Stream {
 public:
  explicit ModbusDiagnosticStream(HardwareSerial& serial) : serial_(serial) {}

  void startTransaction() {
    count_ = 0;
    truncated_ = false;
    transmitting_ = false;
  }

  int available() override { return serial_.available(); }
  int peek() override { return serial_.peek(); }
  void flush() override { serial_.flush(); }

  int read() override {
    int value = serial_.read();
    if (transmitting_ && value >= 0) {
      if (count_ < sizeof(received_)) {
        received_[count_++] = static_cast<uint8_t>(value);
      } else {
        truncated_ = true;
      }
    }
    return value;
  }

  size_t write(uint8_t value) override {
    transmitting_ = true;
    return serial_.write(value);
  }

  void printReceived() const {
    Serial.print("DO received bytes:");
    if (count_ == 0) Serial.print(" none");
    for (size_t i = 0; i < count_; ++i) Serial.printf(" %02X", received_[i]);
    if (truncated_) Serial.print(" ...");
    Serial.println();
  }

 private:
  HardwareSerial& serial_;
  uint8_t received_[32];
  size_t count_ = 0;
  bool truncated_ = false;
  bool transmitting_ = false;
};

OneWire* oneWire = nullptr;
DallasTemperature* sensors = nullptr;
ModbusMaster* modbusDO = nullptr;
HardwareSerial SerialDO(1);
HardwareSerial SerialSIM(2);
ModbusDiagnosticStream doStream(SerialDO);
Preferences preferences;
WebServer provisionServer(80);
DNSServer dnsServer;

String savedWifiSsid;
String savedWifiPassword;
String savedDeviceId;
bool provisioningMode = false;

float currentTemp = 0.0;
float currentPH = 0.0;
float currentDO_mgL = 0.0;
float currentDO_sat = 0.0;
float currentDO_temp = 0.0;
bool doValid = false;
bool tempValid = false;
bool sdReady = false;
bool thresholdsReady = false;
bool clockConfigured = false;
bool thresholdsRefreshed = false;
uint64_t nextSequence = 0;
unsigned long lastSample = 0;
unsigned long lastRegular = 0;
unsigned long lastSync = 0;
unsigned long lastThresholdRefresh = 0;
unsigned long lastSms = 0;
unsigned long lastMountAttempt = 0;
bool firstSample = true;
struct Threshold {
  bool hasMin;
  bool hasMax;
  float min;
  float max;
};
Threshold limits[3];

void readDS18B20();
void readPH();
void readDO();
float regsToFloat(uint16_t hi, uint16_t lo);
void processSms();
void initStorage();
void loadThresholds();
void refreshThresholds();
void sampleAndStore();
void replayOne();
uint64_t highestStoredSequence();
bool smsApiPost(const char* url, const String& body, String& response);
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
  initStorage();
  loadThresholds();

  oneWire = new OneWire(ONE_WIRE_BUS);
  sensors = new DallasTemperature(oneWire);
  sensors->begin();

  SerialDO.begin(4800, SERIAL_8N1, DO_RX_PIN, DO_TX_PIN);
  SerialSIM.begin(9600, SERIAL_8N1, SIM_RX_PIN, SIM_TX_PIN);
  modbusDO = new ModbusMaster();
  modbusDO->begin(DO_SLAVE_ID, doStream);
  Serial.printf("DO Modbus: RX GPIO %d, TX GPIO %d, address %d, 4800 baud 8N1\n",
                DO_RX_PIN, DO_TX_PIN, DO_SLAVE_ID);

  if (forceWiFiSetup) {
    Serial.println("Wi-Fi setup button detected. Starting setup hotspot.");
  } else {
    connectSavedWiFi();
  }
  if (forceWiFiSetup || savedDeviceId.isEmpty() || savedWifiSsid.isEmpty()) {
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

  unsigned long now = millis();
  if (!sdReady && now - lastMountAttempt >= 60000) initStorage();
  if (WiFi.status() == WL_CONNECTED && !clockConfigured) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    clockConfigured = true;
  }
  if (WiFi.status() == WL_CONNECTED && time(nullptr) >= 1700000000 &&
      (!thresholdsReady || !thresholdsRefreshed || now - lastThresholdRefresh >= 300000) &&
      now - lastThresholdRefresh >= 30000) {
    lastThresholdRefresh = now;
    refreshThresholds();
  }
  if (firstSample || now - lastSample >= 30000) {
    firstSample = false;
    lastSample = now;
    sampleAndStore();
  }
  if (sdReady && thresholdsReady && WiFi.status() == WL_CONNECTED &&
      time(nullptr) >= 1700000000 && now - lastSync >= 5000) {
    lastSync = now;
    replayOne();
  }
  if (WiFi.status() == WL_CONNECTED && now - lastSms >= 30000) {
    lastSms = now;
    processSms();
  }
  delay(10);
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
  WiFi.setAutoReconnect(true);
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
  if (!sensors) {
    tempValid = false;
    Serial.println("DS18B20 temperature sensor is not initialized");
    return;
  }
  sensors->requestTemperatures();
  currentTemp = sensors->getTempCByIndex(0);
  tempValid = isfinite(currentTemp) && currentTemp != DEVICE_DISCONNECTED_C;
  if (!tempValid) {
    Serial.println("DS18B20 temperature sensor disconnected or read failed");
  } else {
    Serial.printf("Water temperature: %.2f C\n", currentTemp);
  }
}

void readPH() {
  long rawSum = 0;
  for (int i = 0; i < NUM_PH_SAMPLES; i++) {
    rawSum += analogRead(PH_SENSOR_PIN);
    delay(2);
  }
  float voltage = ((float)rawSum / NUM_PH_SAMPLES / 4095.0) * 3.3;
  currentPH = (CAL_SLOPE * voltage) + CAL_INTERCEPT;
  Serial.printf("pH: %.2f | Sensor voltage: %.3f V\n", currentPH, voltage);
}

void readDO() {
  if (!modbusDO) {
    doValid = false;
    Serial.println("DO sensor is not initialized");
    return;
  }
  while (SerialDO.available() > 0) SerialDO.read();
  delay(50);
  doStream.startTransaction();
  uint8_t result = modbusDO->readHoldingRegisters(0x0000, 6);
  if (result == modbusDO->ku8MBSuccess) {
    currentDO_sat = regsToFloat(modbusDO->getResponseBuffer(0), modbusDO->getResponseBuffer(1)) * 100.0;
    currentDO_mgL = regsToFloat(modbusDO->getResponseBuffer(2), modbusDO->getResponseBuffer(3));
    currentDO_temp = regsToFloat(modbusDO->getResponseBuffer(4), modbusDO->getResponseBuffer(5));
    doValid = true;
    Serial.printf("Dissolved oxygen: %.2f mg/L | Saturation: %.2f%% | DO probe temp: %.2f C\n",
                  currentDO_mgL, currentDO_sat, currentDO_temp);
  } else {
    doValid = false;
    Serial.printf("DO sensor Modbus read failed: 0x%02X\n", result);
    doStream.printReceived();
  }
}

float regsToFloat(uint16_t hi, uint16_t lo) {
  uint32_t raw = ((uint32_t)hi << 16) | lo;
  float value;
  memcpy(&value, &raw, sizeof(value));
  return value;
}

String recordPath(char state, uint64_t sequence) {
  char path[40];
  snprintf(path, sizeof(path), "/readings/%c%016llx.json", state, sequence);
  return String(path);
}

bool parseThresholds(const String& json) {
  StaticJsonDocument<768> doc;
  if (deserializeJson(doc, json) || !doc["thresholds"].is<JsonArray>()) return false;
  Threshold parsed[3] = {};
  bool seen[3] = {};
  for (JsonObject item : doc["thresholds"].as<JsonArray>()) {
    const char* name = item["parameter"];
    if (!name) return false;
    int index = strcmp(name, "temperature") == 0 ? 0 : strcmp(name, "do") == 0 ? 1 :
                strcmp(name, "ph") == 0 ? 2 : -1;
    if (index < 0 || seen[index]) return false;
    seen[index] = true;
    if (!item["min_value"].isNull()) {
      if (!item["min_value"].is<float>()) return false;
      parsed[index].min = item["min_value"];
      parsed[index].hasMin = isfinite(parsed[index].min);
      if (!parsed[index].hasMin) return false;
    }
    if (!item["max_value"].isNull()) {
      if (!item["max_value"].is<float>()) return false;
      parsed[index].max = item["max_value"];
      parsed[index].hasMax = isfinite(parsed[index].max);
      if (!parsed[index].hasMax) return false;
    }
    if (parsed[index].hasMin && parsed[index].hasMax && parsed[index].min > parsed[index].max) return false;
  }
  if (!seen[0] || !seen[1] || !seen[2]) return false;
  memcpy(limits, parsed, sizeof(limits));
  thresholdsReady = true;
  return true;
}

void loadThresholds() {
  if (!preferences.begin("sdlog", true)) {
    Serial.println("Cannot read cached thresholds from flash.");
    return;
  }
  String cached = preferences.getString("thresholds", "");
  preferences.end();
  if (!cached.isEmpty() && parseThresholds(cached)) {
    Serial.println("Loaded cached alert thresholds.");
  } else {
    Serial.println("No valid cached thresholds; recordings will wait for threshold synchronization.");
  }
}

void refreshThresholds() {
  StaticJsonDocument<128> request;
  request["deviceId"] = savedDeviceId;
  String body, response;
  serializeJson(request, body);
  if (!smsApiPost(THRESHOLDS_URL, body, response)) return;
  if (!parseThresholds(response)) {
    Serial.println("Invalid threshold response; retaining previous thresholds.");
    return;
  }
  thresholdsRefreshed = true;
  if (!preferences.begin("sdlog", false)) {
    Serial.println("Cannot open threshold cache; thresholds are available only until restart.");
    return;
  }
  size_t written = preferences.putString("thresholds", response);
  preferences.end();
  if (written != response.length()) {
    Serial.println("Could not persist thresholds; offline alert checks may be unavailable after restart.");
  }
}

bool recoverTempRecord() {
  const char* temporary = "/readings/temp.json";
  if (!SD.exists(temporary)) return true;
  File file = SD.open(temporary, FILE_READ);
  if (!file) return false;
  StaticJsonDocument<768> record;
  DeserializationError error = deserializeJson(record, file);
  file.close();
  const char* seq = record["sequence"];
  if (error || !seq || strlen(seq) != 16 || !record["sourceId"].is<const char*>()) {
    Serial.println("Incomplete SD temporary record; preserve and inspect /readings/temp.json.");
    return false;
  }
  char* end = nullptr;
  uint64_t sequence = strtoull(seq, &end, 16);
  if (!end || *end != '\0') return false;
  String path = recordPath(record["recordedAt"].isNull() ? 'u' : 'p', sequence);
  if (SD.exists(path) || !SD.rename(temporary, path)) {
    Serial.println("Cannot recover SD temporary record; new writes paused.");
    return false;
  }
  Serial.println("Recovered interrupted SD record.");
  return true;
}

void initStorage() {
  lastMountAttempt = millis();
  SPI.begin(SD_SCK_PIN, SD_MISO_PIN, SD_MOSI_PIN, SD_CS_PIN);
  if (!SD.begin(SD_CS_PIN) || SD.cardType() == CARD_NONE) {
    sdReady = false;
    Serial.println("SD mount failed; readings cannot be stored. Check card, wiring and power.");
    return;
  }
  if ((!SD.exists("/readings") && !SD.mkdir("/readings")) || !recoverTempRecord()) {
    sdReady = false;
    Serial.println("SD storage initialization failed; readings cannot be stored.");
    return;
  }
  if (!preferences.begin("sdlog", false)) {
    sdReady = false;
    Serial.println("Cannot read SD record sequence from flash.");
    return;
  }
  nextSequence = preferences.getULong64("sequence", 0);
  preferences.end();
  uint64_t cardSequence = highestStoredSequence();
  if (cardSequence > nextSequence) nextSequence = cardSequence;
  sdReady = true;
  Serial.printf("SD card ready: %llu MB\n", SD.cardSize() / (1024 * 1024));
}

bool findOldestRecord(char state, String& path, unsigned long& count) {
  File directory = SD.open("/readings");
  if (!directory || !directory.isDirectory()) {
    Serial.println("Cannot read SD recordings directory.");
    return false;
  }
  uint64_t oldest = UINT64_MAX;
  count = 0;
  path = "";
  File entry = directory.openNextFile();
  while (entry) {
    String name = entry.name();
    int slash = name.lastIndexOf('/');
    if (slash >= 0) name = name.substring(slash + 1);
    if (!entry.isDirectory() && name.length() == 22 && name.endsWith(".json") &&
        (name[0] == 'p' || name[0] == 'u' || name[0] == 's')) {
      String number = name.substring(1, 17);
      char* end = nullptr;
      uint64_t sequence = strtoull(number.c_str(), &end, 16);
      if (end && *end == '\0') {
        if (name[0] == 'p') ++count;
        if ((state == '*' || name[0] == state) && sequence < oldest) {
          oldest = sequence;
          path = "/readings/" + name;
        }
      }
    }
    entry.close();
    entry = directory.openNextFile();
  }
  directory.close();
  return true;
}

uint64_t highestStoredSequence() {
  File directory = SD.open("/readings");
  if (!directory || !directory.isDirectory()) return 0;
  uint64_t highest = 0;
  File entry = directory.openNextFile();
  while (entry) {
    String name = entry.name();
    int slash = name.lastIndexOf('/');
    if (slash >= 0) name = name.substring(slash + 1);
    if (!entry.isDirectory() && name.length() == 22 && name.endsWith(".json") &&
        (name[0] == 'p' || name[0] == 'u' || name[0] == 's')) {
      String number = name.substring(1, 17);
      char* end = nullptr;
      uint64_t sequence = strtoull(number.c_str(), &end, 16);
      if (end && *end == '\0' && sequence > highest) highest = sequence;
    }
    entry.close();
    entry = directory.openNextFile();
  }
  directory.close();
  return highest;
}

bool reserveSdSpace() {
  while (SD.totalBytes() - SD.usedBytes() < 65536) {
    String oldest;
    unsigned long count;
    if (!findOldestRecord('*', oldest, count) || oldest.isEmpty()) {
      Serial.println("SD full and no HydroSense record can be removed.");
      return false;
    }
    Serial.printf("SD full: deleting oldest record %s, possibly unsent.\n", oldest.c_str());
    if (!SD.remove(oldest)) {
      Serial.println("Failed to delete oldest SD record.");
      return false;
    }
  }
  return true;
}

bool thresholdViolated(int index, float value) {
  return (limits[index].hasMin && value < limits[index].min) ||
         (limits[index].hasMax && value > limits[index].max);
}

bool postStoredRecord(const String& path, bool historical, unsigned long pending) {
  File file = SD.open(path, FILE_READ);
  if (!file) {
    Serial.printf("Cannot open SD record %s\n", path.c_str());
    return false;
  }
  StaticJsonDocument<768> record;
  DeserializationError error = deserializeJson(record, file);
  file.close();
  if (error || !record["deviceId"].is<const char*>() ||
      savedDeviceId != record["deviceId"].as<String>() || record["recordedAt"].isNull()) {
    Serial.printf("SD record invalid, untimed, or belongs to another device: %s\n", path.c_str());
    return false;
  }
  record.remove("sequence");
  record["historical"] = historical;
  record["pendingSyncCount"] = pending > 0 ? pending - 1 : 0;
  String body;
  serializeJson(record, body);
  WiFiClientSecure client;
  client.setCACert(SMS_ROOT_CA);
  HTTPClient http;
  if (!http.begin(client, HYDROSENSE_API_URL)) {
    Serial.println("Could not initialize reading API connection.");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Hardware-Api-Key", HARDWARE_API_KEY);
  int status = http.POST(body);
  if (status != 201) {
    Serial.printf("SD reading upload failed: HTTP/client status %d\n", status);
    http.end();
    return false;
  }
  http.end();
  String sentPath = path;
  sentPath[10] = 's';
  if (!SD.rename(path, sentPath)) {
    Serial.println("Reading accepted but SD acknowledgement failed; it will be retried idempotently.");
    return false;
  }
  Serial.printf("Reading uploaded and retained on SD: %s\n", sentPath.c_str());
  return true;
}

void replayOne() {
  String oldest;
  unsigned long count;
  if (findOldestRecord('p', oldest, count) && !oldest.isEmpty()) {
    postStoredRecord(oldest, true, count);
  }
}

void sampleAndStore() {
  readDS18B20();
  readPH();
  readDO();
  if (!doValid || !tempValid || !isfinite(currentDO_mgL) || !isfinite(currentDO_sat) ||
      !isfinite(currentDO_temp) || !isfinite(currentPH)) {
    Serial.println("Invalid sensor reading; no record or alert generated.");
    return;
  }
  unsigned long now = millis();
  bool regular = lastRegular == 0 || now - lastRegular >= 300000;
  bool alert = thresholdsReady && (thresholdViolated(0, currentTemp) ||
    thresholdViolated(1, currentDO_mgL) || thresholdViolated(2, currentPH));
  if (!regular && !alert) return;
  if (!sdReady || !reserveSdSpace()) {
    Serial.println("Reading not saved: SD storage unavailable.");
    return;
  }
  if (!preferences.begin("sdlog", false)) {
    Serial.println("Cannot open SD record sequence in flash; reading not saved.");
    return;
  }
  uint64_t sequence = nextSequence + 1;
  size_t stored = preferences.putULong64("sequence", sequence);
  preferences.end();
  if (stored != sizeof(sequence)) {
    Serial.println("Could not persist SD record sequence; reading not saved.");
    return;
  }
  nextSequence = sequence;
  if (SD.exists(recordPath('p', sequence)) || SD.exists(recordPath('s', sequence)) ||
      SD.exists(recordPath('u', sequence))) {
    Serial.println("SD record sequence collision; reading not saved.");
    return;
  }
  char seq[17], id[37], timestamp[21];
  snprintf(seq, sizeof(seq), "%016llx", sequence);
  uint32_t a = esp_random(), b = esp_random(), c = esp_random(), d = esp_random();
  snprintf(id, sizeof(id), "%08lx-%04lx-4%03lx-%04lx-%04lx%08lx",
    (unsigned long)a, (unsigned long)(b >> 16), (unsigned long)(b & 0x0fff),
    (unsigned long)((c >> 16 & 0x3fff) | 0x8000), (unsigned long)(c & 0xffff), (unsigned long)d);
  time_t observed = time(nullptr);
  bool timed = observed >= 1700000000;
  if (timed) {
    struct tm utc;
    gmtime_r(&observed, &utc);
    strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &utc);
  }
  StaticJsonDocument<768> record;
  record["sequence"] = seq;
  record["sourceId"] = id;
  record["deviceId"] = savedDeviceId;
  if (timed) record["recordedAt"] = timestamp;
  else record["recordedAt"] = nullptr;
  record["temperature"] = currentTemp;
  record["ph"] = currentPH;
  record["doMgL"] = currentDO_mgL;
  record["doSaturation"] = currentDO_sat;
  record["doProbeTemperature"] = currentDO_temp;
  record["wifiRssi"] = WiFi.RSSI();
  record["powerSource"] = "grid";
  const char* temporary = "/readings/temp.json";
  if (SD.exists(temporary)) {
    Serial.println("SD temporary record requires recovery; new record not saved.");
    sdReady = false;
    return;
  }
  File file = SD.open(temporary, FILE_WRITE);
  if (!file) {
    Serial.println("Cannot create SD record.");
    sdReady = false;
    return;
  }
  size_t expected = measureJson(record);
  size_t written = serializeJson(record, file);
  file.flush();
  bool writeError = file.getWriteError();
  file.close();
  String path = recordPath(timed ? 'p' : 'u', sequence);
  if (written != expected || writeError || !SD.rename(temporary, path)) {
    Serial.println("SD write incomplete; new records paused for recovery.");
    sdReady = false;
    return;
  }
  if (regular) lastRegular = now;
  Serial.printf("Saved %s reading to SD: %s\n", timed ? "timed" : "time unknown", path.c_str());
  if ((alert || regular) && thresholdsReady && timed &&
      WiFi.status() == WL_CONNECTED && time(nullptr) >= 1700000000) {
    String oldest;
    unsigned long count;
    if (findOldestRecord('p', oldest, count)) postStoredRecord(path, false, count);
  }
}

String readSimResponse(uint32_t timeout, bool waitForPrompt = false) {
  String response;
  uint32_t started = millis();
  while (millis() - started < timeout) {
    while (SerialSIM.available()) {
      char c = static_cast<char>(SerialSIM.read());
      if (response.length() < 512) response += c;
      if (waitForPrompt && c == '>') return response;
    }
    if (response.indexOf("\r\nOK\r\n") >= 0 ||
        response.indexOf("\r\nERROR\r\n") >= 0 ||
        response.indexOf("+CME ERROR:") >= 0 ||
        response.indexOf("+CMS ERROR:") >= 0) return response;
    delay(1);
  }
  return response;
}

String simCommand(const char* command, uint32_t timeout) {
  while (SerialSIM.available()) SerialSIM.read();
  SerialSIM.println(command);
  return readSimResponse(timeout);
}

bool simReady() {
  if (simCommand("AT", 1500).indexOf("\r\nOK\r\n") < 0 ||
      simCommand("AT+CPIN?", 2000).indexOf("+CPIN: READY") < 0) {
    Serial.println("SIM900 unavailable or SIM not ready; SMS remains pending.");
    return false;
  }
  String registration = simCommand("AT+CREG?", 2000);
  int regMode = -1;
  int regStatus = -1;
  int regIndex = registration.indexOf("+CREG:");
  if (regIndex >= 0) sscanf(registration.c_str() + regIndex, "+CREG: %d,%d", &regMode, &regStatus);
  if (regStatus != 1 && regStatus != 5) {
    Serial.println("SIM900 not registered on a mobile network; SMS remains pending.");
    return false;
  }
  if (simCommand("AT+CMGF=1", 2000).indexOf("\r\nOK\r\n") < 0) {
    Serial.println("SIM900 could not enable SMS text mode; SMS remains pending.");
    return false;
  }
  return true;
}

bool smsApiPost(const char* url, const String& body, String& response) {
  WiFiClientSecure client;
  client.setCACert(SMS_ROOT_CA);
  HTTPClient http;
  if (!http.begin(client, url)) {
    Serial.println("Could not initialize SMS API connection.");
    return false;
  }
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Hardware-Api-Key", HARDWARE_API_KEY);
  int status = http.POST(body);
  if (status != 200) {
    Serial.printf("SMS API request failed: HTTP/client status %d\n", status);
    http.end();
    return false;
  }
  response = http.getString();
  http.end();
  return true;
}

bool validSmsFields(const String& phone, const String& text) {
  if (phone.length() < 8 || phone.length() > 16 || phone[0] != '+' ||
      phone[1] < '1' || phone[1] > '9' || text.isEmpty() || text.length() > 150) return false;
  for (size_t i = 1; i < phone.length(); ++i) {
    if (phone[i] < '0' || phone[i] > '9') return false;
  }
  for (size_t i = 0; i < text.length(); ++i) {
    if (text[i] < 32 || text[i] > 126) return false;
  }
  return true;
}

bool sendSms(const String& phone, const String& text) {
  while (SerialSIM.available()) SerialSIM.read();
  SerialSIM.print("AT+CMGS=\"");
  SerialSIM.print(phone);
  SerialSIM.println("\"");
  if (readSimResponse(5000, true).indexOf('>') < 0) {
    SerialSIM.write(27);
    Serial.println("SIM900 did not provide an SMS prompt.");
    return false;
  }
  SerialSIM.print(text);
  SerialSIM.write(26);
  String response = readSimResponse(30000);
  if (response.indexOf("+CMGS:") < 0 || response.indexOf("\r\nOK\r\n") < 0) {
    Serial.println("SIM900 did not confirm SMS submission; no automatic retry.");
    return false;
  }
  Serial.println("SIM900 accepted SMS for sending.");
  return true;
}

void processSms() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (time(nullptr) < 1700000000) {
    Serial.println("Clock not synchronized; SMS API unavailable.");
    return;
  }
  if (!simReady()) return;

  StaticJsonDocument<128> request;
  request["deviceId"] = savedDeviceId;
  String body;
  serializeJson(request, body);
  String response;
  if (!smsApiPost(SMS_CLAIM_URL, body, response)) return;
  StaticJsonDocument<512> result;
  DeserializationError error = deserializeJson(result, response);
  if (error) {
    Serial.printf("Invalid SMS claim response: %s\n", error.c_str());
    return;
  }
  if (!result.containsKey("message")) {
    Serial.println("SMS claim response missing message field.");
    return;
  }
  if (result["message"].isNull()) return;
  String id = result["message"]["id"] | "";
  String phone = result["message"]["phone"] | "";
  String text = result["message"]["text"] | "";
  if (id.isEmpty()) {
    Serial.println("SMS claim response missing ID; message will not be retried.");
    return;
  }
  bool sent = false;
  if (validSmsFields(phone, text)) {
    sent = sendSms(phone, text);
  } else {
    Serial.println("Invalid SMS recipient or text; message will not be sent.");
  }
  StaticJsonDocument<192> completion;
  completion["deviceId"] = savedDeviceId;
  completion["id"] = id;
  completion["status"] = sent ? "sent" : "failed";
  body = "";
  serializeJson(completion, body);
  if (!smsApiPost(SMS_COMPLETE_URL, body, response)) {
    Serial.println("SMS completion was not recorded; message will not be retried.");
  }
}
