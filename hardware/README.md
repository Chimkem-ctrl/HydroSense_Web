# HydroSense hardware connection

The ESP32-S3 sketch sends sensor readings to the Supabase Edge API.

## Hardware startup guide

### Requirements

- ESP32-S3 development board with 8 MB PSRAM and USB data support
- Arduino IDE 2.x or a compatible Arduino-compatible IDE
- USB data cable
- ESP32 board package installed with an ESP32-S3 board definition
- USB CDC serial support for the selected ESP32-S3 board configuration

### Arduino IDE setup

1. Install the ESP32 board package from Espressif Systems in the Board Manager.
2. Select the installed ESP32-S3 board and COM port.
3. Configure 8 MB PSRAM if the board exposes an PSRAM option.
4. Install the libraries listed below.
5. Set the USB CDC/JTAG setting required by the board, typically to enable USB CDC on boot.
6. Open `HydroSenseESP32S3/HydroSenseESP32S3.ino`.

### Required libraries

- OneWire
- DallasTemperature
- ModbusMaster
- ArduinoJson
- SD and SPI (included with the ESP32 Arduino board package)

### SD card and offline readings

The SPI SD module uses CS GPIO 10, SCK GPIO 12, MISO GPIO 13 and MOSI GPIO 14.
GPIO 11 remains the DO UART TX. Verify that all four SD pins are exposed and
not reserved for flash, PSRAM, or another peripheral on the exact ESP32-S3
module. Use a FAT-formatted card and check the SD module's supply and logic
voltage requirements; do not assume every module is 5 V compatible. Switch
power off before changing connections.

The firmware checks sensors about every 30 seconds, stores valid regular
readings every five minutes, and also stores out-of-threshold checks. An alert
reading is attempted immediately when online. Thresholds are fetched from the
backend and cached in flash; before the first successful fetch, readings are
stored but held from upload. Thresholds can be up to five minutes old during
normal operation and remain stale throughout an outage.

If Wi-Fi is unavailable at startup, a provisioned device keeps recording and
reconnects instead of entering the setup hotspot. An external backup supply
must power the ESP32, sensors, and SD module during an electrical outage.
Once online, timestamped records are replayed as historical data, without
creating new alerts or SMS for old conditions; current alert checks are sent
separately. Each reading has an ID so retrying an accepted upload does not
insert it twice. Records stay on the card after upload.

The device has no battery-backed clock. Until NTP synchronizes after boot,
readings are stored with an unknown time and are not uploaded or automatically
assigned a time later. Files under `/readings` use `p` for pending timestamped
records, `s` for uploaded records and `u` for unknown-time records. When space
runs low, the oldest HydroSense records, including unsent or unknown-time
records, are deleted with a Serial Monitor warning. Save the card's data
elsewhere if it must be retained. Invalid readings are not recorded or sent.

Card mount, write, and recovery errors are printed on Serial Monitor; if
storage is unavailable, readings cannot be buffered. An incomplete
`/readings/temp.json` is preserved for inspection and pauses new writes until
the card is repaired. An SD card cannot guarantee integrity during sudden
power loss; use a stable backup supply and test your module.

Apply the replay database migration and deploy the API before uploading this
firmware. Test an offline period, reconnect, inspect pending and uploaded files,
and verify timestamps and current alerts in HydroSense. Sensor checks may be
delayed by network or SIM900 operations.

### SIM900 SMS alerts

The SIM900 uses UART2: ESP32 GPIO 17 (TX) connects to SIM900 RX, and GPIO 18
(RX) connects to SIM900 TX. The DO sensor remains on UART1, GPIO 16/11. Confirm
that these GPIOs are available on the specific ESP32-S3 board and that the
module's serial voltage levels are compatible. Power the SIM900 from a supply
suited to its transmit-current peaks, connect grounds according to the module
instructions, and install an active SIM with SMS service and 2G coverage.
Turn power off before changing wiring.

The backend migration and API must be deployed before SMS can work. Each new
alert queues one SMS per distinct E.164 phone number belonging to an approved
user; pending and rejected accounts are excluded. The tank's provisioned
device sends its own queue. Messages are not queued for historical alerts.
Phone numbers that are absent or not in international E.164 format are skipped
and reported in database warnings.

The modem sends one queued message per loop after it registers on the network.
Its `+CMGS` confirmation means the modem accepted the message, not that the
recipient received it. Claimed messages are never automatically retried, even
after a timeout, restart, or lost API response, to avoid duplicate SMS charges.
Check the `sms_alert_queue` table for pending, claimed, sent, failed, or
cancelled messages. A claimed message may require manual investigation. An
account no longer approved or whose number changed is excluded when a pending
message is claimed.

The device must have Wi-Fi and synchronize its clock via NTP for HTTPS
certificate verification. The configured API certificate root expires in
January 2028 and must be updated if the API's certificate chain changes.
The SIM900 can block sensor polling for up to 30 seconds during SMS submission.

### First startup and provisioning

1. Confirm the firmware's `HYDROSENSE_API_URL` and replace the `HARDWARE_API_KEY` placeholder locally with the deployed backend key. Do not commit the key.
2. Upload the sketch. If the serial port disconnects, close Serial Monitor, reconnect the board, press BOOT plus RESET as needed, and upload again.
3. Open Serial Monitor at 115200 baud after the upload.
4. If no Wi-Fi or device ID is stored, the board starts a hotspot named `HydroSense-Setup-XXXX`.
5. Connect to that hotspot using password `hydrosense`.
6. Open `http://192.168.4.1`, enter the Wi-Fi network, Wi-Fi password, and registered tank device ID, then submit.
7. The ESP32 saves the values, connects to Wi-Fi, and sends readings to Supabase.

The device ID must exactly match the tank's `device_id` in HydroSense. Example values are `HS-001`, `HS-002`, and `HS-003`.

After provisioning, Serial Monitor prints water temperature, pH and sensor
voltage, dissolved oxygen, DO saturation, and DO probe temperature. A
disconnected DS18B20 is also reported. Analog pH output alone does not confirm
that its probe is connected or calibrated.

The sketch no longer polls the EC sensor or uploads EC, salinity, and TDS.
The DO RS-485 adapter uses GPIO 16 for RX and GPIO 11 for TX, at 4800 baud,
8N1, and slave address 1. Connect the adapter's receive output (RO) to GPIO 16
and its transmit input (DI) to GPIO 11, and follow the adapter's power, ground,
voltage, and direction-control requirements.

On a DO Modbus failure, Serial Monitor prints the hexadecimal error and the
bytes read after the request, if any. ModbusMaster may stop reading early on an
invalid response, so this is not necessarily a complete frame. `0xE0` means an
unexpected slave address, `0xE1` an unexpected function, and `0xE2` a timeout.
These diagnostics cannot by themselves distinguish a wiring, adapter, sensor,
or configuration fault.

The API currently requires a numeric DO value. If the DO read fails or is
non-finite, the sketch skips the reading to avoid false alerts; it also skips
readings when the temperature sensor is disconnected or a pH value is
non-finite. SMS polling continues for previously queued alerts.

## Firmware configuration

Set these values in `HydroSenseESP32S3/HydroSenseESP32S3.ino`:

- `HARDWARE_API_KEY`

The tank `device_id` is provisioned on the ESP32 setup page rather than compiled
into the firmware.

## Wi-Fi setup

On first boot without saved credentials or a device ID, or when setup is
forced with the BOOT button, the ESP32 creates:

- Network: `HydroSense-Setup-XXXX`
- Password: `hydrosense`

Connect to that hotspot from a phone or computer, then open `http://192.168.4.1`.
Enter the local Wi-Fi network name and password. The ESP32 stores them in flash and
restarts automatically. Wi-Fi can be changed later from the same setup hotspot:

1. Hold the BOOT button, reset the ESP32, and keep holding it for about three seconds.
2. Connect to `HydroSense-Setup-XXXX`.
3. Open `http://192.168.4.1`.

Wi-Fi credentials are stored locally on the ESP32 and are not sent to the web
application or cloud database.

Enter the tank's `device_id` in the provisioning page. It must exactly match the
value registered in Tank Overview and is stored in ESP32 flash. Example values are
`HS-001`, `HS-002`, and `HS-003`.

## Supabase configuration

Set the `HARDWARE_INGEST_API_KEY` secret on the hosted API. Use a unique random
value and place the same value in the ESP32 sketch:

```powershell
npx supabase secrets set HARDWARE_INGEST_API_KEY="<random-secret>" --project-ref iafooterjwbihuzwakoc --workdir backend/supabase
```

The ingestion endpoint is:

```text
POST https://iafooterjwbihuzwakoc.supabase.co/functions/v1/api/v1/ingest/readings
```

It requires the header `X-Hardware-Api-Key`.

## Saved sensor calculation reference

- DS18B20: `temperature C = raw 16-bit register / 16.0`.
- PH4502C ADC averaging: `ADC average = raw sum / sample count`.
- PH4502C voltage: `voltage = (ADC average / 4095.0) * 3.3`.
- PH4502C pH: `pH = (-5.689 * voltage) + 21.08`.
- RS-LDO-N01 float values use two 16-bit registers:
  - Saturation registers `0x0000` and `0x0001`, then `value * 100.0` for percent.
  - Concentration registers `0x0002` and `0x0003`, in mg/L.
  - Probe temperature registers `0x0004` and `0x0005`, in C.
