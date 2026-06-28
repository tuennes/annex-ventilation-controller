////////////// TAUPI ANNEX @ Shelly Plug S Plus //////////////
// Erweiterte Variante für einen Taupunktlüfter im Annex.
//
// Funktionen:
// - BLE-Sensoren (innen/außen) auslesen
// - Winterbetrieb: nur lüften, wenn die Außenluft feuchtereguliert trockener ist als innen
// - Sommerbetrieb: täglich zu einer konfigurierbaren Zeit lüften, unabhängig von der Feuchte
// - Kein regelmäßiger Betrieb
// - Einfache Schaltlogik mit einstellbarer Intensität als Tastverhältnis
//
// Wichtig:
// - Mindestens die MAC-Adressen von sensor_aussen und sensor_innen anpassen.
// - Die Konfigurationswerte im Kopfteil an das eigene Setup anpassen.

//========== Sensor-Konfiguration ==========
var sensor_aussen = "XX:XX:XX:XX:XX:XX";
var sensor_innen  = "YY:YY:YY:YY:YY:YY";

//========== Betriebsmodus ==========
// Mögliche Werte: "winter", "summer", "off"
// Die Shelly-App kann den Modus über den normalen Schalter des Geräts steuern:
// - Schalter EIN => Sommerbetrieb
// - Schalter AUS => Winterbetrieb
var betrieb_modus = "winter";
var app_sync_enabled = true;
var last_seen_relay_state = null;
var suppress_next_relay_change = false;

//========== Zeitfenster ==========
// Startzeitpunkt des regelmäßigen Betriebs
var start_hour = 12;
var start_minute = 0;

// Art des Zeitfensters:
// - "duration" : Startzeit + Dauer
// - "endtime"   : Startzeit bis Endzeit
var schedule_mode = "duration";

// Wenn schedule_mode = "duration"
var duration_minutes = 120;

// Wenn schedule_mode = "endtime"
var end_hour = 14;
var end_minute = 0;

//========== Schaltkonfiguration ==========
var humidity_diff_threshold = 0;   // [%] Lüften nur, wenn RH innen > RH außen + Schwelle
var control_interval_seconds = 60; // [s] Steuerung prüfen alle X Sekunden
var battery_warn_threshold = 20;  // [%] LED blinkt rot, wenn Batteriestand darunter liegt
var lost_connection_timeout = 1800; // [s] Nach dieser Zeit wird der Lüfter ausgeschaltet
var fan_intensity_percent = 100;   // [%] 100 = durchgehend im aktiven Fenster, 50 = 50% der Zeit

//===== Ende Konfiguration =====

var taupunkt_aussen;
var taupunkt_innen;
var temperatur_innen;
var temperatur_aussen;
var humidity_innen;
var humidity_aussen;
var battery_innen;
var battery_aussen;
var lost_connection_innen = 0;
var lost_connection_aussen = 0;
var luefterstatus = null;

function taupunkt(T, RH) {
  var a = (T >= 0) ? 17.27 : 21.875;
  var b = (T >= 0) ? 237.7 : 265.5;
  var alpha = (a * T) / (b + T) + Math.log(RH / 100);
  return (b * alpha) / (a - alpha);
}

function getMinutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getSecondsOfDay(date) {
  return date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
}

function isWithinSchedule(now) {
  var start = start_hour * 60 + start_minute;
  var current = now.getHours() * 60 + now.getMinutes();

  if (schedule_mode === "duration") {
    var end = start + duration_minutes;
    if (end >= 24 * 60) {
      end = end - 24 * 60;
      return current >= start || current < end;
    }
    return current >= start && current < end;
  }

  var end = end_hour * 60 + end_minute;
  if (end < start) {
    return current >= start || current < end;
  }
  return current >= start && current < end;
}

function getIntensityState(now) {
  if (fan_intensity_percent >= 100) {
    return true;
  }
  if (fan_intensity_percent <= 0) {
    return false;
  }

  var cycle_seconds = 600; // 10 Minuten
  var cycle_position = getSecondsOfDay(now) % cycle_seconds;
  var on_seconds = Math.round((fan_intensity_percent / 100) * cycle_seconds);
  return cycle_position < on_seconds;
}

function farbring(red, green, blue, helligkeit) {
  Shelly.call(
    "PLUGS_UI.SetConfig",
    {
      id: 0,
      config: {
        leds: {
          mode: "switch",
          colors: {
            "switch:0": {
              on: { rgb: [red, green, blue], brightness: helligkeit },
              off: { rgb: [red, green, blue], brightness: helligkeit }
            }
          }
        }
      }
    },
    function (result, code, msg, ud) {},
    null
  );
}

function setFanState(on) {
  if (luefterstatus !== on) {
    suppress_next_relay_change = true;
    Shelly.call("Switch.Set", { id: 0, on: on });
    luefterstatus = on;
  }
}

function syncModeFromShellyApp() {
  if (!app_sync_enabled) {
    return;
  }

  var status = Shelly.getComponentStatus("switch:0");
  if (!status || typeof status.output === "undefined") {
    return;
  }

  if (last_seen_relay_state === null) {
    last_seen_relay_state = status.output;
    return;
  }

  if (status.output !== last_seen_relay_state) {
    if (suppress_next_relay_change) {
      suppress_next_relay_change = false;
    } else {
      betrieb_modus = status.output ? "summer" : "winter";
      print("Betriebsmodus über Shelly-App geändert auf:", betrieb_modus);
    }
    last_seen_relay_state = status.output;
  }
}

function updateDeviceNameForApp() {
  var modeLabel = (betrieb_modus === "summer") ? "Sommer" : (betrieb_modus === "winter" ? "Winter" : "Aus");
  var inTemp = (typeof temperatur_innen === "undefined") ? "--" : temperatur_innen.toFixed(1);
  var inHum = (typeof humidity_innen === "undefined") ? "--" : humidity_innen.toFixed(0);
  var outTemp = (typeof temperatur_aussen === "undefined") ? "--" : temperatur_aussen.toFixed(1);
  var outHum = (typeof humidity_aussen === "undefined") ? "--" : humidity_aussen.toFixed(0);
  var label = "Annex " + modeLabel + " I:" + inTemp + "°C/" + inHum + "% A:" + outTemp + "°C/" + outHum + "%";

  try {
    Shelly.call("Sys.SetConfig", { config: { device: { name: label } } });
  } catch (e) {
    print("Gerätename konnte nicht aktualisiert werden:", e);
  }
}

function evaluateControl() {
  var now = new Date();
  var within_schedule = isWithinSchedule(now);

  if (typeof taupunkt_innen === "undefined" ||
      typeof taupunkt_aussen === "undefined" ||
      typeof temperatur_innen === "undefined" ||
      typeof humidity_innen === "undefined" ||
      typeof humidity_aussen === "undefined") {
    print("Nicht alle Sensorwerte vorhanden – Lüfter ausgeschaltet.");
    setFanState(false);
    farbring(80, 80, 0, 100);
    return;
  }

  lost_connection_innen = lost_connection_innen + control_interval_seconds;
  lost_connection_aussen = lost_connection_aussen + control_interval_seconds;

  if (lost_connection_innen > lost_connection_timeout || lost_connection_aussen > lost_connection_timeout) {
    print("Verbindung zu Sensoren zu lange verloren – Lüfter ausgeschaltet.");
    setFanState(false);
    farbring(80, 80, 0, 100);
    return;
  }

  if (battery_innen < battery_warn_threshold || battery_aussen < battery_warn_threshold) {
    print("Batteriestand niedrig.");
    farbring(100, 0, 0, 100);
  }

  var should_run = false;
  var reason = "keine Aktivierung";

  if (betrieb_modus === "winter") {
    if (within_schedule && humidity_innen > humidity_aussen + humidity_diff_threshold) {
      should_run = true;
      reason = "Wintermodus: Außenluft trockener als innen";
    }
  } else if (betrieb_modus === "summer") {
    if (within_schedule) {
      should_run = true;
      reason = "Sommermodus: Zeitfenster aktiv";
    }
  } else {
    should_run = false;
    reason = "Kein regelmäßiger Betrieb gewählt";
  }

  if (within_schedule && fan_intensity_percent < 100) {
    var intensity_on = getIntensityState(now);
    should_run = should_run && intensity_on;
    if (!intensity_on) {
      reason = reason + " (Intensität reduziert)";
    }
  }

  if (should_run) {
    print("Lüfter einschalten – " + reason);
    setFanState(true);
    farbring(80, 10, 0, 100);
  } else {
    print("Lüfter ausschalten – " + reason);
    setFanState(false);
    farbring(0, 0, 80, 100);
  }
}

function checkBlu(event) {
  if (event.address === sensor_aussen) {
    temperatur_aussen = event.temperature;
    humidity_aussen = event.humidity;
    taupunkt_aussen = taupunkt(event.temperature, event.humidity);
    battery_aussen = event.battery;
    lost_connection_aussen = 0;
    print("Neue Werte für Außen:", temperatur_aussen, "°C,", humidity_aussen, "%, Tp:", taupunkt_aussen, "°C, Batt:", battery_aussen, "%");
  } else if (event.address === sensor_innen) {
    temperatur_innen = event.temperature;
    humidity_innen = event.humidity;
    taupunkt_innen = taupunkt(event.temperature, event.humidity);
    battery_innen = event.battery;
    lost_connection_innen = 0;
    print("Neue Werte für Innen:", temperatur_innen, "°C,", humidity_innen, "%, Tp:", taupunkt_innen, "°C, Batt:", battery_innen, "%");
  }
}

Timer.set(control_interval_seconds * 1000, true, function () {
  print("----- Steuerung alle", control_interval_seconds, "s -----");
  print("Modus:", betrieb_modus, "Zeitfenster:", start_hour, ":", start_minute, "-", end_hour, ":", end_minute, "Intensität:", fan_intensity_percent, "%");
  print("Innen: T =", temperatur_innen, "°C, RH =", humidity_innen, "%, Tp =", taupunkt_innen, "°C");
  print("Außen: T =", temperatur_aussen, "°C, RH =", humidity_aussen, "%, Tp =", taupunkt_aussen, "°C");
  syncModeFromShellyApp();
  evaluateControl();
  updateDeviceNameForApp();
});

///////////////// BLE-Decoder ///////////////////////

const BTHOME_SVC_ID_STR = "fcd2";

const uint8 = 0;
const int8 = 1;
const uint16 = 2;
const int16 = 3;
const uint24 = 4;
const int24 = 5;

const BTH = {
  0x00: { n: "pid", t: uint8 },
  0x01: { n: "battery", t: uint8, u: "%" },
  0x02: { n: "temperature", t: int16, f: 0.01, u: "tC" },
  0x03: { n: "humidity", t: uint16, f: 0.01, u: "%" },
  0x05: { n: "illuminance", t: uint24, f: 0.01 },
  0x21: { n: "motion", t: uint8 },
  0x2d: { n: "window", t: uint8 },
  0x2e: { n: "humidity", t: uint8, u: "%" },
  0x3a: { n: "button", t: uint8 },
  0x3f: { n: "rotation", t: int16, f: 0.1 },
  0x45: { n: "temperature", t: int16, f: 0.1, u: "tC" },
};

function getByteSize(type) {
  if (type === uint8 || type === int8) return 1;
  if (type === uint16 || type === int16) return 2;
  if (type === uint24 || type === int24) return 3;
  return 255;
}

const BTHomeDecoder = {
  utoi: function (num, bitsz) {
    const mask = 1 << (bitsz - 1);
    return num & mask ? num - (1 << bitsz) : num;
  },
  getUInt8: function (buffer) {
    return buffer.at(0);
  },
  getInt8: function (buffer) {
    return this.utoi(this.getUInt8(buffer), 8);
  },
  getUInt16LE: function (buffer) {
    return 0xffff & ((buffer.at(1) << 8) | buffer.at(0));
  },
  getInt16LE: function (buffer) {
    return this.utoi(this.getUInt16LE(buffer), 16);
  },
  getUInt24LE: function (buffer) {
    return 0x00ffffff & ((buffer.at(2) << 16) | (buffer.at(1) << 8) | buffer.at(0));
  },
  getInt24LE: function (buffer) {
    return this.utoi(this.getUInt24LE(buffer), 24);
  },
  getBufValue: function (type, buffer) {
    if (buffer.length < getByteSize(type)) return null;
    let res = null;
    if (type === uint8) res = this.getUInt8(buffer);
    if (type === int8) res = this.getInt8(buffer);
    if (type === uint16) res = this.getUInt16LE(buffer);
    if (type === int16) res = this.getInt16LE(buffer);
    if (type === uint24) res = this.getUInt24LE(buffer);
    if (type === int24) res = this.getInt24LE(buffer);
    return res;
  },
  unpack: function (buffer) {
    if (typeof buffer !== "string" || buffer.length === 0) return null;
    let result = {};
    let _dib = buffer.at(0);
    result["encryption"] = _dib & 0x1 ? true : false;
    result["BTHome_version"] = _dib >> 5;
    if (result["BTHome_version"] !== 2) return null;
    if (result["encryption"]) return result;
    buffer = buffer.slice(1);

    let _bth;
    let _value;
    while (buffer.length > 0) {
      _bth = BTH[buffer.at(0)];
      if (typeof _bth === "undefined") {
        print("BTH: Unknown type");
        break;
      }
      buffer = buffer.slice(1);
      _value = this.getBufValue(_bth.t, buffer);
      if (_value === null) break;
      if (typeof _bth.f !== "undefined") _value = _value * _bth.f;

      if (typeof result[_bth.n] === "undefined") {
        result[_bth.n] = _value;
      } else {
        if (Array.isArray(result[_bth.n])) {
          result[_bth.n].push(_value);
        } else {
          result[_bth.n] = [result[_bth.n], _value];
        }
      }

      buffer = buffer.slice(getByteSize(_bth.t));
    }
    return result;
  },
};

let lastPacketId = 0x100;

function BLEScanCallback(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT) {
    return;
  }

  if (typeof result.service_data === "undefined" || typeof result.service_data[BTHOME_SVC_ID_STR] === "undefined") {
    return;
  }

  let unpackedData = BTHomeDecoder.unpack(result.service_data[BTHOME_SVC_ID_STR]);

  if (unpackedData === null || typeof unpackedData === "undefined" || unpackedData["encryption"]) {
    print("Error: Encrypted devices are not supported");
    return;
  }

  if (lastPacketId === unpackedData.pid) {
    return;
  }

  lastPacketId = unpackedData.pid;
  unpackedData.address = result.addr;
  checkBlu(unpackedData);
}

function initBLE() {
  const BLEConfig = Shelly.getComponentConfig("ble");

  if (!BLEConfig.enable) {
    print("Error: The Bluetooth is not enabled, please enable it from settings");
    return;
  }

  if (BLE.Scanner.isRunning()) {
    print("Info: The BLE gateway is running, the BLE scan configuration is managed by the device");
  } else {
    const bleScanner = BLE.Scanner.Start({
      duration_ms: BLE.Scanner.INFINITE_SCAN,
      active: false
    });

    if (!bleScanner) {
      print("Error: Can not start new scanner");
    }
  }

  BLE.Scanner.Subscribe(BLEScanCallback);
}

initBLE();
