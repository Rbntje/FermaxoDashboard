# FERMAXO RACING — Phone LCD

A full-screen, screen-only driving display for F1 25 with the 2026 Season Pack. The phone is the display: there is no steering wheel illustration or hardware mockup.

## Quick start on Windows

1. Download this repository (**Code → Download ZIP**) and extract it.
2. Double-click `Start-Fermaxo.bat`. It installs the bridge dependency and opens the display. Keep the terminal window open.
3. In F1 25 open **Settings → Telemetry**. Enable UDP, choose format **2026**, port **20777**, and set the receiver IP to `127.0.0.1` if F1 25 is running on this same PC.
4. For a phone display, connect the phone to the same Wi-Fi/network as the gaming PC. Open the **Dashboard on phone** URL printed in the launcher window. If Windows Firewall asks, allow Python on your private network. The page detects the PC address and links to its telemetry bridge automatically.
5. On the phone, rotate to landscape and use the browser's full-screen option if needed. The display also has a fullscreen control.

For a console, enter the gaming PC's private LAN IP when the launcher asks for a UDP listen IP, then use that same IP as the receiver in F1 25 settings. Keep the phone and PC on the same local network.

## Display and controls

- The main LCD keeps gear, speed, RPM LEDs, throttle, brake, ERS, lap timing, sector times, position, race-control state and flag status visible.
- Session type adjusts the display emphasis. Race-control alerts appear automatically on the main display.
- **HOME**, **ERS**, **LAPS**, **TYRES**, **RACE**, and **DRIVER** are touchscreen pages. Detail pages only show when selected.
- **LINK** retries the connection. The address field allows a custom bridge address.
- **REC / SAVE / LOAD** on LAPS records actual received frames, exports JSON and replays a saved JSON recording. A replay is labelled as replay data.
- Missing live fields show `--`; no active game session is shown as standby.

## Manual bridge start

Requires Python 3.10+:

```powershell
cd telemetry-bridge
py -m pip install -r requirements.txt
py bridge.py
```

The bridge listens for UDP on port 20777. WebSocket telemetry uses port 20778. The phone dashboard is served on port 20780, and the health endpoint is `http://<PC-address>:20780/health`. By default the web and WebSocket services bind to the local network interfaces for phone use. To receive console UDP, start the bridge with its LAN address:

```powershell
py bridge.py --udp-host 192.168.1.20
```

For PC-only use, the dashboard URL is `http://127.0.0.1:20780/`.

## Telemetry

The bridge checks format 2026, packet version 1, and known packet sizes. It decodes actual Car Telemetry, Session, Lap Data, Event, Session History, Car Status, Car Damage, and Car Telemetry 2 packets. This includes core driving inputs, game rev lights, ERS, current session/lap timing, safety-car state, basic flags and 2026 active aero/overtake fields. Straight Mode is shown only when the 2026 packet provides applicable active-aero telemetry; otherwise the screen shows DRS when available.

VSC delta is shown from the game packet. The app does not estimate recommended speeds or invent engineer instructions. Double-yellow distinction, corner guidance, and driver suggestions remain unavailable unless decoded from game data.

## Verification status

The repository files were updated through GitHub. I checked that the application code targets the new display element IDs and the connection uses the dashboard host when opened over the local network. This environment has not run a live F1 UDP session or a phone browser preview, so packet compatibility and real-device layout still need confirmation against the game and target phone.
