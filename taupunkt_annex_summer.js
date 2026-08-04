////////////// TAUPI ANNEX SUMMER @ Shelly Plug S Plus //////////////
// Dedicated summer-mode ventilation controller.
// This script only runs the summer logic and does not use the Shelly app switch.

//========== Configuration ==========
var sensor_aussen = "7c:c6:b6:76:b2:bc";
var sensor_innen = "7c:c6:b6:9e:f1:fd";
var control_interval_seconds = 60;
var battery_warn_threshold = 20;
var lost_connection_timeout = 1800;
var summer_run_time_minutes = 15;
var summer_pause_time_minutes = 60;
var ble_debug = true;
var ble_supported_by_device = null;

print("Script startup: taupunkt_annex_summer.js V1.2");
print("Summer mode: dedicated script, no app switch handling.");

if (hasPlaceholderAddress(sensor_aussen) || hasPlaceholderAddress(sensor_innen)) {
  print("WARNING: sensor_aussen/sensor_innen still contain placeholder addresses.");
}

var temperatur_innen, temperatur_aussen;
var humidity_innen, humidity_aussen;
var battery_innen, battery_aussen;
var lost_connection_innen = 0, lost_connection_aussen = 0;
var luefterstatus = false;
var run_phase = true;
var summer_phase_counter = 0;

function hasPlaceholderAddress(address) {
  if (typeof address !== "string") return true;
  var normalized = "";
  for (var i = 0; i < address.length; i++) {
    var ch = address.charAt(i);
    if (ch === ":" || ch === "-" || ch === " " || ch === "\t") continue;
    normalized += ch;
  }
  normalized = normalized.toUpperCase();
  return normalized === "XXXXXXXXXXXX" || normalized === "YYYYYYYYYYYY" || normalized.indexOf("XX") === 0 || normalized.indexOf("YY") === 0;
}

function disableLeds() {
  try {
    Shelly.call("PLUGS_UI.SetConfig", {
      id: 0,
      config: {
        leds: {
          mode: "switch",
          colors: {
            "switch:0": {
              on: { rgb: [0, 0, 0], brightness: 0 },
              off: { rgb: [0, 0, 0], brightness: 0 }
            }
          }
        }
      }
    }, function () {}, null);
  } catch (e) {
    print("disableLeds failed:", e);
  }
}

function setFanState(on) {
  if (luefterstatus !== on) {
    Shelly.call("Switch.Set", { id: 0, on: on });
    luefterstatus = on;
  }
}

function updateDeviceNameForApp() {
  var inTemp = (typeof temperatur_innen === "undefined") ? "--" : temperatur_innen.toFixed(1);
  var inHum = (typeof humidity_innen === "undefined") ? "--" : humidity_innen.toFixed(0);
  var outTemp = (typeof temperatur_aussen === "undefined") ? "--" : temperatur_aussen.toFixed(1);
  var outHum = (typeof humidity_aussen === "undefined") ? "--" : humidity_aussen.toFixed(0);
  var phase = run_phase ? "RUN" : "PAUSE";
  var label = "Annex Summer " + phase + " I:" + inTemp + "°C/" + inHum + "% A:" + outTemp + "°C/" + outHum + "%";
  try { Shelly.call("Sys.SetConfig", { config: { device: { name: label } } }); } catch (e) { print("Device name could not be updated:", e); }
}

function evaluateControl() {
  lost_connection_innen += control_interval_seconds;
  lost_connection_aussen += control_interval_seconds;
  if (lost_connection_innen > lost_connection_timeout || lost_connection_aussen > lost_connection_timeout) {
    print("Sensor connection lost for too long - keeping current state.");
    disableLeds();
    return;
  }
  if (battery_innen < battery_warn_threshold || battery_aussen < battery_warn_threshold) {
    print("Battery level low.");
    disableLeds();
  }

  var cycle_duration_seconds = run_phase ? summer_run_time_minutes * 60 : summer_pause_time_minutes * 60;
  summer_phase_counter += control_interval_seconds;

  if (summer_phase_counter >= cycle_duration_seconds) {
    run_phase = !run_phase;
    summer_phase_counter = 0;
    print("Summer mode: phase toggled to", run_phase ? "RUN" : "PAUSE");
  }

  if (run_phase) {
    setFanState(true);
    disableLeds();
    print("Summer mode: fan is running for", summer_run_time_minutes, "minutes.");
  } else {
    setFanState(false);
    disableLeds();
    print("Summer mode: fan is paused for", summer_pause_time_minutes, "minutes.");
  }
}

function normalizeAddress(addr) {
  if (typeof addr !== "string") return null;
  var normalized = "";
  for (var i = 0; i < addr.length; i++) {
    var ch = addr.charAt(i);
    if (ch === ":" || ch === "-" || ch === " " || ch === "\t") continue;
    normalized += ch;
  }
  return normalized.toUpperCase();
}

function checkBlu(event) {
  if (ble_debug) print("BLE event: addr=", event.address, "temp=", event.temperature, "hum=", event.humidity, "batt=", event.battery);
  var normalizedAddress = normalizeAddress(event.address);
  var sensorAussenNorm = normalizeAddress(sensor_aussen);
  var sensorInnenNorm = normalizeAddress(sensor_innen);
  if (normalizedAddress === sensorAussenNorm) {
    temperatur_aussen = event.temperature;
    humidity_aussen = event.humidity;
    battery_aussen = event.battery;
    lost_connection_aussen = 0;
    print("New outdoor values:", temperatur_aussen, "°C,", humidity_aussen, "%, battery:", battery_aussen, "%");
  } else if (normalizedAddress === sensorInnenNorm) {
    temperatur_innen = event.temperature;
    humidity_innen = event.humidity;
    battery_innen = event.battery;
    lost_connection_innen = 0;
    print("New indoor values:", temperatur_innen, "°C,", humidity_innen, "%, battery:", battery_innen, "%");
  } else if (ble_debug) {
    print("BLE event ignored: address does not match sensor_aussen/sensor_innen");
  }
}

Timer.set(control_interval_seconds * 1000, true, function () {
  print("----- Summer control cycle every", control_interval_seconds, "s -----");
  print("Inside: T =", temperatur_innen, "°C, RH =", humidity_innen, "%");
  print("Outside: T =", temperatur_aussen, "°C, RH =", humidity_aussen, "%");
  evaluateControl();
  updateDeviceNameForApp();
});

//========== BLE decoder ==========
var BTHOME_SVC_ID_STR = "fcd2";
var uint8 = 0, int8 = 1, uint16 = 2, int16 = 3, uint24 = 4, int24 = 5;
var BTH = {
  0x00: { n: "pid", t: uint8 },
  0x01: { n: "battery", t: uint8 },
  0x02: { n: "temperature", t: int16, f: 0.01 },
  0x03: { n: "humidity", t: uint16, f: 0.01 },
  0x05: { n: "illuminance", t: uint24, f: 0.01 },
  0x21: { n: "motion", t: uint8 },
  0x2d: { n: "window", t: uint8 },
  0x2e: { n: "humidity", t: uint8 },
  0x3a: { n: "button", t: uint8 },
  0x3f: { n: "rotation", t: int16, f: 0.1 },
  0x45: { n: "temperature", t: int16, f: 0.1 }
};

function getByteSize(type) {
  if (type === uint8 || type === int8) return 1;
  if (type === uint16 || type === int16) return 2;
  if (type === uint24 || type === int24) return 3;
  return 255;
}

function bytesFromBuffer(buffer) {
  if (typeof buffer === "string") {
    var text = buffer.trim();
    var hex = text;
    if (hex.indexOf("0x") === 0 || hex.indexOf("0X") === 0) hex = hex.slice(2);
    var hexCharsOnly = true;
    for (var i = 0; i < hex.length; i++) {
      var ch = hex.charAt(i);
      if ((ch >= "0" && ch <= "9") || (ch >= "a" && ch <= "f") || (ch >= "A" && ch <= "F")) continue;
      hexCharsOnly = false;
      break;
    }
    if (hexCharsOnly && hex.length % 2 === 0 && hex.length > 0) {
      var bytes = [];
      for (var j = 0; j < hex.length; j += 2) bytes.push(parseInt(hex.slice(j, j + 2), 16));
      return bytes;
    }
    var raw = [];
    for (var k = 0; k < text.length; k++) raw.push(text.charCodeAt(k));
    return raw;
  }
  if (buffer && typeof buffer.length === "number") {
    var array = [];
    for (var l = 0; l < buffer.length; l++) {
      var item = buffer[l];
      if (typeof item === "number") array.push(item);
      else if (typeof item === "string" && item.length === 1) array.push(item.charCodeAt(0));
      else if (typeof item === "object" && item !== null && typeof item.valueOf === "function") {
        var num = item.valueOf();
        if (typeof num === "number") array.push(num);
      }
    }
    return array;
  }
  return null;
}

function bytesToHex(buffer) {
  var bytes = bytesFromBuffer(buffer);
  if (!bytes || bytes.length === 0) return "";
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var value = bytes[i];
    if (typeof value !== "number") value = Number(value);
    if (value < 0) value = 0;
    var part = value.toString(16).toUpperCase();
    if (part.length === 1) part = "0" + part;
    hex += part;
  }
  return hex;
}

function decodeBTHome(buffer) {
  var bytes = bytesFromBuffer(buffer);
  if (!bytes || bytes.length === 0) return null;
  var result = { encryption: (bytes[0] & 0x1) ? true : false, BTHome_version: bytes[0] >> 5 };
  if (result.BTHome_version !== 2 || result.encryption) return result;
  bytes = bytes.slice(1);
  while (bytes.length > 0) {
    var spec = BTH[bytes[0]];
    if (typeof spec === "undefined") { print("BTH: Unknown type", bytes[0]); break; }
    bytes = bytes.slice(1);
    var size = getByteSize(spec.t);
    if (bytes.length < size) break;
    var val = bytes.slice(0, size);
    var num = 0;
    if (spec.t === uint8) num = val[0];
    else if (spec.t === int8) num = (val[0] & 0x80) ? val[0] - 0x100 : val[0];
    else if (spec.t === uint16) num = ((val[1] << 8) | val[0]) >>> 0;
    else if (spec.t === int16) { num = (((val[1] << 8) | val[0]) << 0) & 0xffff; num = (num & 0x8000) ? num - 0x10000 : num; }
    else if (spec.t === uint24) num = ((val[2] << 16) | (val[1] << 8) | val[0]) >>> 0;
    else if (spec.t === int24) { num = (((val[2] << 16) | (val[1] << 8) | val[0]) << 0) & 0xffffff; num = (num & 0x800000) ? num - 0x1000000 : num; }
    if (typeof spec.f !== "undefined") num = num * spec.f;
    if (typeof result[spec.n] === "undefined") result[spec.n] = num;
    else if (Array.isArray(result[spec.n])) result[spec.n].push(num);
    else result[spec.n] = [result[spec.n], num];
    bytes = bytes.slice(size);
  }
  return result;
}

function getPayloadContainer(result) {
  var candidates = [result && result.service_data, result && result.serviceData, result && result.advertisement_data, result && result.adv, result && result.data, result && result.payload];
  for (var i = 0; i < candidates.length; i++) if (typeof candidates[i] !== "undefined" && candidates[i] !== null) return candidates[i];
  return null;
}

var lastPacketId = 0x100;

function BLEScanCallback(event, result) {
  if (event !== BLE.Scanner.SCAN_RESULT) return;
  if (ble_debug) {
    try { print("BLE callback received for addr=", result.addr, "rssi=", result.rssi, "raw=", JSON.stringify(result)); }
    catch (e) { print("BLE callback received for addr=", result.addr, "rssi=", result.rssi, "raw=<not printable>"); }
  }
  var container = getPayloadContainer(result);
  if (!container) {
    if (ble_debug) print("BLE callback: no service data payload in advertisement");
    return;
  }
  var payloadValue = null;
  var serviceDataKey = null;
  if (container && typeof container === "object") {
    for (var key in container) {
      if (typeof key === "string" && key.toLowerCase() === BTHOME_SVC_ID_STR) { serviceDataKey = key; break; }
    }
    if (serviceDataKey) payloadValue = container[serviceDataKey];
    else if (typeof container.length === "number" && container.length > 0) payloadValue = container[0];
  } else if (typeof container === "string") {
    payloadValue = container;
  }
  if (ble_debug) print("BLE callback payload source=", serviceDataKey || "direct", "payload=", payloadValue);
  if (payloadValue === null || typeof payloadValue === "undefined") return;
  var unpackedData = decodeBTHome(payloadValue);
  if (!unpackedData || unpackedData.encryption) { if (ble_debug) print("BLE callback: failed to decode BTHome payload"); return; }
  if (lastPacketId === unpackedData.pid) return;
  lastPacketId = unpackedData.pid;
  unpackedData.address = result.addr;
  checkBlu(unpackedData);
}

function initBLE() {
  print("BLE init: starting scanner...");
  try {
    var BLEConfig = Shelly.getComponentConfig("ble");
    if (BLEConfig && typeof BLEConfig.enable !== "undefined") {
      if (!BLEConfig.enable) { print("BLE init: Bluetooth is disabled on this Shelly."); ble_supported_by_device = false; return; }
      ble_supported_by_device = true;
    }
  } catch (e) { print("BLE init: getComponentConfig failed", e); }

  if (typeof BLE === "undefined") {
    print("BLE init: BLE object is not available on this device/firmware.");
    ble_supported_by_device = false;
    return;
  }

  try {
    if (typeof BLE.Scanner === "undefined" || typeof BLE.Scanner.Start !== "function") {
      print("BLE init: BLE.Scanner API is not available on this firmware.");
      ble_supported_by_device = false;
      return;
    }
    if (!BLE.Scanner.isRunning()) {
      var bleScanner = BLE.Scanner.Start({ duration_ms: BLE.Scanner.INFINITE_SCAN, active: false });
      if (!bleScanner) { print("Error: Can not start new scanner"); return; }
      print("BLE init: scanner started successfully");
    }
  } catch (e) { print("BLE init: scanner start failed", e); return; }
  try { BLE.Scanner.Subscribe(BLEScanCallback); print("BLE init: subscription registered"); } catch (e) { print("BLE init: subscribe failed", e); }
}

initBLE();
Timer.set(15000, true, function () {
  try {
    if (ble_supported_by_device === false) { print("BLE watchdog: BLE scanning is unavailable on this device/firmware."); return; }
    if (!BLE.Scanner.isRunning()) { print("BLE watchdog: scanner is not running, restarting..."); initBLE(); }
  } catch (e) { print("BLE watchdog error", e); }
});
