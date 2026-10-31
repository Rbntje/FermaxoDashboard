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

The landscape-first, no-scroll driving LCD puts speed, gear, ERS, the live car graphic and track map first, while retaining RPM shift lights, throttle, brake, steering input, fuel, lap and sector timing, position, Straight Mode, separate DRS status, race control and flags. A detailed top-down Fermaxo livery car silhouette sits centrally on MAIN, with live heat/wear colour on all four wheels and nearby temperature, wear, pressure and brake-temperature readings. Compound, stint age and measured average wear stay in the same visual group. Practice, qualifying and race sessions adjust emphasis automatically. Event banners are sourced from received game data.

A track map replaces the former mini-sector tile row. It is built from real world-position points in Motion packets paired by frame identifier with Lap Data distance and sector. Mini-sector paths follow the recorded circuit shape; S1/S2/S3 markers come from recorded sector transitions. The live marker and direction use the current matched position. A map appears only after a complete valid lap with dense coverage and a closed, plausible path. Until then the display explains that a clean lap with matched position data is needed. Track changes select geometry and comparison laps for that track.

The map colours the current mini-sector cyan, measured gains green and measured losses red; unavailable comparisons stay grey. Tap a path segment to inspect its measured delta. Active aero is labelled Straight Mode or Cornering Mode only when 2026 telemetry reports it available. DRS remains separate.

### ENGINEER

ENGINEER focuses on lap performance: saved lap/reference selection, lap and sector timing, the same measured track map at larger size, mini-sector deltas, recorded speed/throttle/brake/gear traces, and a selected mini-sector comparison of sampled speed, minimum speed, throttle and brake. Saved lap consistency is calculated only from valid recorded laps on the current track. A loss note identifies the selected mini-sector and measured time difference.

Corner names and braking points are not fabricated. Corner-by-corner conclusions require a reliable corner map, which is not bundled with the app. The map is not guessed from a track ID or drawn from an incomplete lap.

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

The bridge validates packet size and packet version separately for the F1 25 2026 Season Pack format. It decodes Motion world positions, car telemetry, session, lap data, event, session history, car status, car damage and Car Telemetry 2, including 2026 active-aero/overtake fields. Position samples are paired with lap-distance samples only when packet frame identifiers match.

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
