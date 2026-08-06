////////////// TAUPI ANNEX SUMMER @ Shelly Plug S Plus //////////////
// Dedicated summer-mode ventilation controller.
// This script only runs the summer logic and does not use the Shelly app switch.
// The fan is switched on from 13:00 until 16:00 and otherwise remains off.

//========== Configuration ==========
var control_interval_seconds = 60;
var fan_start_hour = 13;
var fan_stop_hour = 16;

print("Script startup: taupunkt_annex_summer.js V1.2");
print("Summer mode: dedicated script, time-based 13-16 Uhr control.");

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

function updateDeviceNameForApp() {
  var now = new Date();
  var phase = (now.getHours() >= fan_start_hour && now.getHours() < fan_stop_hour) ? "ACTIVE" : "INACTIVE";
  var label = "Annex Summer " + phase + " " + now.toTimeString().split(" ")[0];
  try { Shelly.call("Sys.SetConfig", { config: { device: { name: label } } }); } catch (e) { print("Device name could not be updated:", e); }
}

function isSummerActive() {
  var now = new Date();
  var hour = now.getHours();
  return hour >= fan_start_hour && hour < fan_stop_hour;
}

function evaluateControl() {
  var shouldRun = isSummerActive();
  if (shouldRun) {
    if (!luefterstatus) print("Summer mode: 13-16 Uhr aktiv, Lüfter einschalten.");
    setFanState(true);
  } else {
    if (luefterstatus) print("Summer mode: außerhalb von 13-16 Uhr, Lüfter ausschalten.");
    setFanState(false);
  }
  disableLeds();
}

Timer.set(control_interval_seconds * 1000, true, function () {
  var now = new Date();
  print("----- Summer control cycle every", control_interval_seconds, "s -----");
  print("Current time:", now.toTimeString().split(" ")[0]);
  evaluateControl();
  updateDeviceNameForApp();
});
