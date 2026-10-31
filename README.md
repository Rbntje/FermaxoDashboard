# FERMAXO RACING — Virtual F1 Wheel

A full-screen, steering wheel-inspired display for F1 25 with the 2026 Season Pack and a local UDP-to-WebSocket bridge.

## Quick start on Windows

1. Download this repository (**Code → Download ZIP**) and extract it.
2. Double-click `Start-Fermaxo.bat`. It installs the WebSocket dependency if needed, opens the wheel display and starts the receiver. Keep its terminal window open.
3. In F1 25 open **Settings → Telemetry**. Enable UDP, set format to **2026**, and port to **20777**. If the game is on this PC, set receiver IP to `127.0.0.1`.
4. The page connects to the bridge automatically. It shows **WAITING FOR F1 TELEMETRY** until real car telemetry arrives.

For a console, enter the gaming PC's private LAN IP when the launcher asks for a UDP listen IP. Set that same PC IP as the console's receiver IP in game settings. Allow Python through Windows Firewall on the private network if prompted.

## Wheel controls

- **HOME** keeps essential driving values and race alerts on the main LCD. Touch targets reflow to full-width, 50 px controls on phone-sized displays.
- **ENERGY**, **TIMING**, and **ENGINEER** open secondary detail pages (ERS, completed session laps, tyres, fuel and received race-control messages). The physical **HOME** button returns immediately.
- **LINK** connects/reconnects to `ws://localhost:20778`.
- **DEMO** is manual and labelled. It never starts automatically.
- **REC / SAVE / LOAD** record frames in browser memory, export JSON and replay a saved JSON file.
- **VIEW** or the F key toggles fullscreen. Arrow keys change pages.

When data is missing, the wheel shows `--` or `UNAVAILABLE`. It clears stale live values when the connection drops. Actual flags and Safety Car/VSC state automatically appear on HOME when the game packets report them. The VSC game delta is shown when present; this build does not invent recommended speeds or coaching.

## Manual bridge start

Requires Python 3.10+:

```powershell
cd telemetry-bridge
py -m pip install -r requirements.txt
py bridge.py
```

The bridge listens on UDP 20777 and WebSocket 20778. By default, all services bind to loopback. To receive UDP from a console, bind UDP to the gaming PC's private address:

```powershell
py bridge.py --udp-host 192.168.1.20
```

The dashboard still connects locally at `ws://localhost:20778`. The local health endpoint is `http://localhost:20779/`.

GitHub Pages can serve the static wheel, but cannot receive UDP. An HTTPS Pages site cannot connect to this local insecure `ws://` bridge; use the local launcher for the simplest setup or configure a secure `wss://` endpoint yourself.

## Telemetry currently decoded

The bridge checks the packet format, packet version 1 and exact 2026 packet lengths. It reads Car Telemetry, Session, Lap Data, Session History, Car Status, Event and Car Damage packets. The available fields include speed, throttle, brake, steering, gear, RPM and game rev LEDs, DRS, tyre/brake temperatures, tyre pressures/wear, lap and sector 1/2 times, current sector 3 when in that sector, session best lap and derived delta, race position, safety car/VSC status and delta, basic FIA flag state, fuel and ERS energy.

This is not yet the complete requested engineering suite. Double-yellow distinction, detailed penalty messages, engineer recommendations, per-corner guidance and a real track map are not decoded. Those areas remain unavailable. The built-in demo is not live game data.

## Verification

The browser JavaScript syntax and HTML element references were checked. I attempted a synthetic bridge parser check, but this environment has no Python installation. The bridge has not been verified against a live game packet capture, and the wheel has not been visually checked in a browser yet.

## References

- [EA SPORTS F1 25 / 2026 Season Pack UDP specification](https://forums.ea.com/blog/f1-games-game-info-hub-en/ea-sports%E2%84%A2-f1%C2%AE25-2026-season-pack-udp-specification/12187347)
- [Packet sizes and format notes](https://github.com/rdgonzaga/f1-game-telemetry/blob/main/docs/udp-spec.md)
