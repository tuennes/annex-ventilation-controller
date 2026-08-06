////////////// TAUPI ANNEX SUMMER @ Shelly Plug S Plus //////////////
// Dedicated summer-mode ventilation controller.
// This script only runs the summer logic and does not use the Shelly app switch.
// The fan is switched on from 13:00 until 16:00 and otherwise remains off.

//========== Configuration ==========
var control_interval_seconds = 60;
var fan_start_time = "13:00"; // e.g. 13 or "13:00"
var fan_stop_time = "16:00";  // e.g. 16 or "16:00"

print("Script startup: taupunkt_annex_summer.js V1.2");
print("Summer mode: dedicated script, time-based control.");

var luefterstatus = false;

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

function formatTime(date) {
  var h = date.getHours();
  var m = date.getMinutes();
  if (h < 10) h = "0" + h;
  if (m < 10) m = "0" + m;
  return h + ":" + m;
}

function updateDeviceNameForApp() {
  var now = new Date();
  var currentMinutes = now.getHours() * 60 + now.getMinutes();
  var startMinutes = parseTime(fan_start_time);
  var stopMinutes = parseTime(fan_stop_time);
  var active = false;
  if (startMinutes !== null && stopMinutes !== null) {
    if (startMinutes <= stopMinutes) {
      active = currentMinutes >= startMinutes && currentMinutes < stopMinutes;
    } else {
      active = currentMinutes >= startMinutes || currentMinutes < stopMinutes;
    }
  }
  var phase = active ? "ACTIVE" : "INACTIVE";
  var label = "Annex Summer " + phase + " " + formatTime(now);
  try { Shelly.call("Sys.SetConfig", { config: { device: { name: label } } }); } catch (e) { print("Device name could not be updated:", e); }
}

function parseTime(value) {
  if (typeof value === "number") return Math.floor(value) * 60;
  if (typeof value === "string") {
    var text = value.trim();
    var parts = text.split(":");
    if (parts.length === 1) {
      var singleHour = parseInt(parts[0], 10);
      return isNaN(singleHour) ? null : singleHour * 60;
    }
    if (parts.length === 2) {
      var hour = parseInt(parts[0], 10);
      var minute = parseInt(parts[1], 10);
      if (isNaN(hour) || isNaN(minute)) return null;
      return hour * 60 + minute;
    }
  }
  return null;
}

function isSummerActive() {
  var now = new Date();
  var currentMinutes = now.getHours() * 60 + now.getMinutes();
  var startMinutes = parseTime(fan_start_time);
  var stopMinutes = parseTime(fan_stop_time);
  if (startMinutes === null || stopMinutes === null) return false;
  if (startMinutes <= stopMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < stopMinutes;
  }
  return currentMinutes >= startMinutes || currentMinutes < stopMinutes;
}

function evaluateControl() {
  var shouldRun = isSummerActive();
  if (shouldRun) {
    if (!luefterstatus) print("Summer mode: time window active, Lüfter einschalten.");
    setFanState(true);
  } else {
    if (luefterstatus) print("Summer mode: time window inactive, Lüfter ausschalten.");
    setFanState(false);
  }
  disableLeds();
}

disableLeds();
evaluateControl();
updateDeviceNameForApp();

Timer.set(control_interval_seconds * 1000, true, function () {
  var now = new Date();
  print("----- Summer control cycle every", control_interval_seconds, "s -----");
  print("Current time:", formatTime(now));
  print("Window start:", fan_start_time, "stop:", fan_stop_time);
  print("Active:", isSummerActive() ? "yes" : "no");
  evaluateControl();
  updateDeviceNameForApp();
});
