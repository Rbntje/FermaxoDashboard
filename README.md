# FERMAXO RACING — F1 25 / 2026 Season Pack LCD

A phone-first telemetry LCD for **EA SPORTS F1 25 with the 2026 Season Pack**. Its compact information boxes take inspiration from Formula-style steering-wheel displays and use Fermaxo red, cyan, black and white. The application draws only the digital screen.

## Quick start on Windows

1. Download or clone this repository and extract it.
2. Double-click `Start-Fermaxo.bat`. It checks Python, installs the bridge dependency if needed, and opens the dashboard. Leave its terminal window open while using the display.
3. In F1 25, open **Settings → Telemetry**. Enable UDP telemetry, choose format **2026**, and set port **20777**.
4. If the game runs on this PC, set receiver IP to `127.0.0.1`. For a console, enter the gaming PC's LAN IP as the game receiver and use the same IP when the launcher asks for UDP listen IP.
5. Connect the phone to the same Wi-Fi network and open the **PHONE URL** shown in the dashboard's settings panel. Rotate to landscape and tap **FULLSCREEN**.

Allow Python through Windows Firewall on the private network if prompted. The PC dashboard opens at `http://127.0.0.1:20780/`. Connection status and packet counts are shown in the compact settings overlay. The browser remembers the last bridge address.

## Exactly two display pages

### MAIN

The landscape-first, no-scroll driving LCD keeps gear, speed, RPM shift lights, throttle, brake, ERS charge and energy values, lap and sector timing, position, aero mode, DRS (only when applicable), race control, flags and calculated mini-sector deltas visible. Practice, qualifying and race sessions adjust emphasis automatically. Event banners are sourced from received game data and do not replace the key readings.

The ERS battery stays prominent on MAIN. Active aero displays Straight Line Mode or Cornering Mode only when the 2026 telemetry says it is available. DRS remains a separate field.

### ENGINEER

ENGINEER is the only detail page. It combines lap history and comparison, mini-sector detail, saved telemetry graphs, ERS history and modes, tyre state, race and session data, and measured driver-improvement notes. Saved laps can be selected as the comparison reference. Use its recording and export controls to save session data.

Lap consistency is calculated from recorded valid laps on the current track. A mini-sector loss recommendation identifies its measured mini-sector and time difference. Corner-by-corner advice is withheld unless a verified track map exists; this repository does not currently include one.

Use the two large bottom controls to switch instantly between MAIN and ENGINEER. Connection settings remain in a small overlay, not another page.

## Recorded mini-sectors

F1 UDP supplies official sector times, but not the detailed mini-sector comparisons shown here. Mini-sectors are calculated from real lap-distance/time samples and a complete valid reference lap. They are clearly labelled as calculated. Equal-distance boundaries are interpolated only across sufficiently close received samples; missing ranges remain unavailable. Negative delta means measured gain, positive delta means measured loss.

The dashboard saves valid completed laps in browser storage (up to 30). Export/import lap JSON to back them up or use them on another browser. Session recording also supports JSON, CSV and recorded-data replay. No telemetry is synthesized; absent readings display `--` or standby.

## Local bridge

Requires Python 3.10 or later. For manual startup:

```powershell
cd telemetry-bridge
py -m pip install -r requirements.txt
py bridge.py --udp-host 127.0.0.1 --udp-port 20777
```

UDP receives on **20777**, WebSocket streams on **20778**, and HTTP serves the dashboard and health endpoint on **20780**. The web and WebSocket services bind to local network interfaces for phone access. For console telemetry, bind UDP to the gaming PC LAN address, such as:

```powershell
py bridge.py --udp-host 192.168.1.20 --udp-port 20777
```

The health endpoint is `http://<PC-address>:20780/health`.

## Telemetry and availability limits

The bridge validates packet size and packet version separately for the F1 25 2026 Season Pack format. It decodes car telemetry, session, lap data, event, session history, car status, car damage and Car Telemetry 2, including 2026 active-aero/overtake fields.

The game feed does not provide every possible engineer metric. The app does not infer a target speed, direct gap to the safety car, unreported flag types, or corner names without reliable source data. Those values remain unavailable. No live game session or phone browser is available in the development environment, so verify UDP delivery and device fit on the target setup.

## Tests

Run the frontend regression and mini-sector tests with Node.js:

```powershell
node --test tests/*.test.js
```

Run parser tests and compile the Python bridge:

```powershell
cd telemetry-bridge
py -m unittest discover -s tests -v
py -m py_compile bridge.py protocol.py
```

Packet tests use fixtures. They do not replace a live F1 telemetry session.
