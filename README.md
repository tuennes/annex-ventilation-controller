# Annex Ventilation Controller for Shelly Plug S Plus

This repository contains a Shelly script for an annex ventilation controller. It is intended for a small detached annex equipped with two BLE sensors, one indoors and one outdoors.

## Origin of the Code

The original basis for this project comes from [BoeserBob/Taupi-4.0](https://github.com/BoeserBob/Taupi-4.0).
This repository extends that concept with:
- winter mode based on indoor/outdoor dew point comparison
- summer mode using a fixed daily time window
- an off mode for disabling automatic ventilation
- simple Shelly App-based switching between summer and winter mode
- a basic status display using the Shelly device name

## Features

- Winter mode: the fan runs only when the outdoor dew point is sufficiently higher than the indoor dew point, using a 1 °C buffer and 0.5 °C hysteresis.
- Summer mode: the fan runs during a configurable daily window, regardless of humidity.
- Off mode: automatic control can be disabled completely.
- Simple on/off control, because the Shelly Plug S Plus can only switch the fan on and off.
- Remote control through the Shelly App when the Shelly Cloud connection is configured.

## Installation

1. Set up a Shelly Plug S Plus.
2. Enable Bluetooth on the device.
3. Install [taupunkt_annex.js](taupunkt_annex.js) as a script on the Shelly.
4. Configure the script to start automatically.
5. Pair the BLE sensors and adjust the MAC addresses in the script.
6. Configure the desired operating mode and time window in the script header.

### Required Hardware

- Shelly Plug S Plus
- Shelly BLU HT sensors or compatible BLE humidity/temperature sensors
- Bluetooth enabled on the Shelly device
- Shelly Cloud account for remote access through the Shelly App

### Configuration Parameters

At minimum, the following values should be adjusted in [taupunkt_annex.js](taupunkt_annex.js):

- `sensor_aussen`
- `sensor_innen`
- `betrieb_modus` (default: `winter`)
- `summer_start_hour` and `summer_start_minute`
- `summer_end_hour` and `summer_end_minute`
- `dewpoint_on_buffer_c` and `dewpoint_off_buffer_c`

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
