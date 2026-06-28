# Summerhouse Ventilation Controller for Shelly Plug S

This repository contains a Shelly script for a summerhouse ventilation controller. It is intended for a small detached annex equipped with two BLE sensors, one inside and one outside.

## Origin of the Code

The original basis for this project comes from [BoeserBob/Taupi-4.0](https://github.com/BoeserBob/Taupi-4.0).
This repository extends that concept with:
- winter mode using indoor/outdoor humidity comparison
- summer mode using fixed daily time windows
- an optional disabled regular operating mode
- simple Shelly App-based switching between summer and winter mode
- a basic status display using the Shelly device name

## Features

- Winter mode: ventilation runs only when the outdoor air is sufficiently drier than the indoor air.
- Summer mode: ventilation runs during configured daily time windows regardless of humidity.
- Off mode: regular ventilation can be disabled entirely.
- Simple on/off control, because the Shelly Plug S Plus can only switch the fan on and off.
- Remote control through the Shelly App when the Shelly Cloud connection is configured.

## Installation

1. Set up a Shelly Plug S Plus.
2. Enable Bluetooth on the device.
3. Install [taupunkt_annex.js](taupunkt_annex.js) as a script on the Shelly.
4. Configure the script to start automatically.
5. Pair the BLE sensors and adjust the MAC addresses in the script.
6. Configure the desired operating mode, time windows, and intensity in the script header.

### Required Hardware

- Shelly Plug S Plus
- Shelly BLU HT sensors or compatible BLE humidity/temperature sensors
- Bluetooth enabled on the Shelly device
- Shelly Cloud account for remote access through the Shelly App

### Configuration Parameters

At minimum, the following values should be adjusted in [taupunkt_annex.js](taupunkt_annex.js):

- `sensor_aussen`
- `sensor_innen`
- `betrieb_modus`
- `start_hour` and `start_minute`
- `schedule_mode`
- `duration_minutes` or `end_hour` and `end_minute`

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
