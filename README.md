# Annex Ventilation Controller for Shelly Plug S Plus

This repository contains Shelly scripts for an annex ventilation controller. It is intended for a small detached annex that uses BLE sensors for winter dew-point control and a customizable time window for summer.

## Origin of the Code

The original basis for this project comes from [BoeserBob/Taupi-4.0](https://github.com/BoeserBob/Taupi-4.0).
This repository extends that concept with:
- winter mode based on indoor/outdoor dew point comparison
- summer mode using a fixed 13:00-16:00 time schedule
- a dedicated summer script and a dedicated winter script
- a basic status display using the Shelly device name

## Features

- `taupunkt_annex_winter.js`: winter mode where the fan runs only when the outdoor dew point is sufficiently lower than the indoor dew point, using a 2 °C start threshold and 1 °C stop threshold.
- `taupunkt_annex_summer.js`: summer mode where the fan runs only during a configurable time window, without BLE temperature or humidity measurement.
- Simple on/off control, because the Shelly Plug S Plus can only switch the fan on and off.
- LEDs are disabled in both scripts so the device does not light up during operation.

## Installation

1. Set up a Shelly Plug S Plus.
2. Enable Bluetooth on the device if you plan to use the winter script.
3. Install `taupunkt_annex_winter.js` or `taupunkt_annex_summer.js` as a script on the Shelly.
4. Configure the script to start automatically.
5. If using `taupunkt_annex_winter.js`, adjust the indoor and outdoor BLE sensor MAC addresses in the script.
6. Configure the desired hysteresis settings in the winter script header, or use the default 13:00-16:00 schedule in the summer script.

### Required Hardware

- Shelly Plug S Plus
- Shelly BLU HT sensors or compatible BLE humidity/temperature sensors
- Bluetooth enabled on the Shelly device
- Shelly Cloud account for remote access through the Shelly App

### Configuration Parameters

`taupunkt_annex_winter.js`:

- `sensor_aussen`
- `sensor_innen`
- `dewpoint_on_buffer_c`
- `dewpoint_off_buffer_c`
- `control_interval_seconds`
- `battery_warn_threshold`
- `lost_connection_timeout`
- `ble_debug`

`taupunkt_annex_summer.js`:

- `control_interval_seconds`
- `fan_start_time` (default "13:00")
- `fan_stop_time` (default "16:00")

`taupunkt_annex.js` is the legacy combined script and is no longer required for the dedicated summer/winter operation.

## Notes

- The Shelly App may show a message like “No paired devices”, but that is unrelated to the script’s BLE scan path.
- The script uses the built-in BLE gateway on the Shelly device, so no manual pairing is required for the sensor data readout.

## Improvement Ideas

Potential future improvements include:
- MQTT publishing for integration with external dashboards
- more detailed status reporting inside the Shelly App
- support for additional time profiles or weekday-based scheduling
- persistent logging of temperature and humidity values
- support for more advanced ventilation strategies

## License

This project is licensed under the Boost Software License 1.0.
The repository includes a LICENSE file with the full text of that license.
The original reference project was distributed under the same license.
