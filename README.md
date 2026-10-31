# FERMAXO RACING — F1 LCD

A screen-only, phone-first F1 driving display for F1 25 with the 2026 Season Pack. Its compact information grid takes inspiration from the SF-25 LCD layout: high-density fields, a top RPM strip, thin dividers, a large central gear and a prominent ERS section. It does not reproduce Ferrari branding or draw a steering wheel.

## Quick start on Windows

1. Download the repository and extract it.
2. Double-click \`Start-Fermaxo.bat\`. It installs the bridge dependency and opens the LCD. Leave the terminal running.
3. In F1 25 open **Settings → Telemetry**. Enable UDP, choose format **2026**, port **20777**, and use receiver IP \`127.0.0.1\` when the game runs on this PC.
4. For a phone, connect it to the same Wi-Fi as the PC and open the **Dashboard on phone** address printed in the terminal. Allow Python on your private network if Windows Firewall asks.
5. Rotate the phone to landscape. Tap the fullscreen control if your browser supports fullscreen.

For a console, enter the gaming PC's LAN IP when the launcher asks for a UDP listen IP, then use that PC IP as the receiver address in the game.

## Main driving display

The main page keeps speed and pedals, gear, game RPM lights, lap timing, delta, ERS battery/store/deploy/harvest, active aero, DRS, position, session, sectors, race-control state, and flag status on the screen. SC, VSC, and flag banners appear automatically from received game data. When the game or telemetry has not supplied a value, it displays \`--\` or a neutral standby state.

Practice, qualifying, race, and time trial use the same compact driving grid with session-specific visual emphasis. Qualifying enlarges delta and sector timing; race highlights position and race control. The vertical ERS battery meter stays on the main screen.

## Touchscreen pages

- **HOME** returns to the driving screen.
- **ERS** shows battery/deployment data and a trace from samples captured with REC.
- **TIMING** shows valid session lap history, sectors, best lap, delta, and recording controls.
- **TYRES** shows compound where supplied, age, wear, pressure, and temperatures.
- **TELEMETRY** shows live speed, RPM, controls, temperatures, aero, and DRS.
- **RACE** shows gaps, position, laps, pit state, warnings, penalties, fuel and race control.
- **ENGINEER** shows actual decoded driver/vehicle states. It does not generate coaching advice without a validated comparison dataset.

Use **CONNECT** to retry. The small settings control opens the bridge address and fullscreen options. A successful bridge address is remembered in the browser.

## Bridge and network

Requires Python 3.10+:

\`\`\`powershell
cd telemetry-bridge
py -m pip install -r requirements.txt
py bridge.py
\`\`\`

The bridge receives UDP on port 20777, sends WebSocket telemetry on port 20778, and serves the dashboard on port 20780. The web and WebSocket listeners bind to local network interfaces for phone access. To receive console telemetry, bind UDP to the gaming PC address:

\`\`\`powershell
py bridge.py --udp-host 192.168.1.20
\`\`\`

For PC-only use, open \`http://127.0.0.1:20780/\`. The health endpoint is \`http://<PC-address>:20780/health\`.

## Decoded telemetry and limits

The bridge validates packet lengths and packet version, and accepts F1 25 2026 Season Pack format 2026. It reads Car Telemetry, Session, Lap Data, Event, Session History, Car Status, Car Damage, and Car Telemetry 2. Actual decoded fields include driving inputs, RPM/rev lights, lap and sector timing, valid session best lap, gaps, safety-car delta, basic flags, tyre state, ERS energy, active aero and overtake state.

Some requested details are not available in the current decode: mini-sectors, compound-independent tyre strategy, double-yellow distinction, a direct gap-to-safety-car field, and validated driving recommendations. The app leaves these unavailable instead of inventing a value. VSC/SC displays the signed game delta; it does not estimate a target speed.

## Verification

The JavaScript syntax and HTML element references were checked after the redesign. No live game packet capture or phone-browser preview was available in this environment, so verify the connection and final fit on the target phone before driving.
