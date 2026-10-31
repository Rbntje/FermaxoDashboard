# FERMAXO RACING — F1 25 LCD

A full-screen, phone-first telemetry display for **F1 25 with the 2026 Season Pack**. The display uses a compact Formula-style LCD layout with Fermaxo red and cyan accents, high contrast timing boxes and a large gear readout. It draws no steering wheel or hardware.

## Quick start on Windows

1. Download or clone this repository and extract it.
2. Double-click `Start-Fermaxo.bat`. On first run it checks Python, installs the bridge dependency and starts the dashboard. Keep the terminal window open.
3. In F1 25 open **Settings → Telemetry** and set UDP telemetry on, format **2026**, port **20777**.
4. For a game running on the same PC, use receiver IP `127.0.0.1`. For a console, set receiver IP to the gaming PC's LAN address and enter that same LAN address when the launcher asks for UDP listen IP.
5. Connect the phone to the same Wi-Fi network as the PC and open the **PHONE URL** shown in the dashboard's settings panel (or in the terminal health output). Rotate to landscape and use **FULLSCREEN**.

If Windows Firewall prompts, allow Python on the private network. The dashboard opens on the PC at `http://127.0.0.1:20780/`. Use **CONNECT** to retry the WebSocket connection. The bridge URL is remembered by the browser.

## Main driving screen

The LCD keeps the gear, speed, RPM shift lights, throttle, brake, ERS charge and deployment, lap timing, position, sectors, active-aero mode, DRS, race-control state and flags visible together. Session layouts adjust emphasis for practice, qualifying and race. SC, VSC and decoded flag notifications appear automatically on the main display. Alerts use values received from the game.

When no car/session data is available, the display stays in neutral standby and shows unavailable readings as `--`. The 2026 active-aero mode is displayed only when the packet marks the feature available. Straight-line mode is not assumed to be DRS.

## Detail pages

Touch **HOME**, **ERS**, **TIMING**, **TYRES**, **TELEMETRY**, **RACE** or **ENGINEER** to switch LCD pages. HOME returns to the driving screen. Detail pages include live decoded data, lap history, tyre state, recorded traces, gaps, penalties and race control.

Use **START REC** on a detail page to capture session frames. Export the session as JSON or CSV from TIMING; saved laps can also be exported/imported as JSON and replayed. Captures stay in browser storage until exported. A valid reference lap is selected for comparison on the same track.

## Measured mini-sector comparison

Mini-sectors are calculated from real lap-distance/time samples received from F1 25 and interpolated at equal-distance boundaries. The comparison becomes available after a complete, continuous recorded lap and a valid reference lap. Missing sample ranges are not guessed; affected mini-sectors remain `--`. Change the mini-sector count in settings (8, 12, 16 or 24).

The delta is current mini-sector time minus reference time: negative is a measured gain and positive is a measured loss. This is a distance-based comparison, not an official game mini-sector feed. Detailed driver suggestions are limited to the measured comparison data; the system does not invent a target speed, corner instruction or strategy.

## Bridge and network

Requires Python 3.10 or later. To start manually:

```powershell
cd telemetry-bridge
py -m pip install -r requirements.txt
py bridge.py --udp-host 127.0.0.1 --udp-port 20777
```

The bridge receives UDP on port **20777**, provides WebSocket telemetry on **20778**, and serves the dashboard and health endpoint on **20780**. The web and WebSocket services listen on the local network so a phone can connect. For console telemetry, bind UDP to the gaming PC's LAN address, for example:

```powershell
py bridge.py --udp-host 192.168.1.20 --udp-port 20777
```

Open `http://<PC-address>:20780/health` for bridge status, packet counts and the phone URL.

## Telemetry and data limits

The bridge validates packet sizes and accepts F1 25 2026 Season Pack packet format 2026. It decodes car telemetry, session, lap data, event, session history, car status, car damage and car telemetry 2. This supplies speed, controls, RPM/rev lights, lap and sector timing, session bests, gaps, safety-car delta, basic flags, tyre state, ERS, active aero and overtake state.

The game feed does not provide every requested engineer value. The app does not infer double-yellow distinctions, target speed, safety-car gap, or corner-by-corner guidance when the UDP packets do not contain reliable data. These values stay unavailable. Mini-sector times are derived only from sampled laps as described above.

## Tests

Run the browser-side mini-sector tests with Node.js:

```powershell
node --test tests/minisectors.test.js
```

Run the UDP parser tests with Python:

```powershell
cd telemetry-bridge
py -m unittest discover -s tests -v
py -m py_compile bridge.py protocol.py
```

The parser tests use packet fixtures. A live F1 session, console network and phone browser are required to verify actual UDP delivery and device fit.
