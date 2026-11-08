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

### First startup and provisioning

1. Confirm the firmware's `HYDROSENSE_API_URL` and `HARDWARE_API_KEY` match the deployed backend configuration.
2. Upload the sketch. If the serial port disconnects, close Serial Monitor, reconnect the board, press BOOT plus RESET as needed, and upload again.
3. Open Serial Monitor at 115200 baud after the upload.
4. If no Wi-Fi or device ID is stored, the board starts a hotspot named `HydroSense-Setup-XXXX`.
5. Connect to that hotspot using password `hydrosense`.
6. Open `http://192.168.4.1`, enter the Wi-Fi network, Wi-Fi password, and registered tank device ID, then submit.
7. The ESP32 saves the values, connects to Wi-Fi, and sends readings to Supabase.

The device ID must exactly match the tank's `device_id` in HydroSense. Example values are `HS-001`, `HS-002`, and `HS-003`.

## Firmware configuration

Set these values in `HydroSenseESP32S3/HydroSenseESP32S3.ino`:

- `HARDWARE_API_KEY`

The tank `device_id` is provisioned on the ESP32 setup page rather than compiled
into the firmware.

## Wi-Fi setup

On first boot, or after saved Wi-Fi credentials fail, the ESP32 creates:

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
- RS-EC-N01 registers:
  - EC is register `0x0000`, in uS/cm.
  - Probe temperature is signed register `0x0001 / 10.0`, in C.
  - Salinity is register `0x0002`, in ppm.
  - TDS is register `0x0003`, in ppm.
- RS-LDO-N01 float values use two 16-bit registers:
  - Saturation registers `0x0000` and `0x0001`, then `value * 100.0` for percent.
  - Concentration registers `0x0002` and `0x0003`, in mg/L.
  - Probe temperature registers `0x0004` and `0x0005`, in C.
