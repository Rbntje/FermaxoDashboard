# FERMAXO RACING — Race Engineering Dashboard

A GitHub Pages friendly telemetry dashboard and local F1 UDP → WebSocket bridge.

## Features

- Race workstation interface with speed, gear, RPM, throttle, brake and DRS.
- Prominent flag and safety-car alert area.
- ERS display and charge history when data is supplied.
- Lap table and two-lap comparison for captured data.
- Local recording, JSON/CSV export, replay import, and labelled demo mode.
- Python bridge validates F1 25 (2025) and F1 25: 2026 Season Pack packet headers and exact packet lengths. It decodes the player's Car Telemetry packet: speed, throttle, steering, brake, gear, RPM, DRS, brake temperatures, tyre temperatures, pressures and engine temperature.
- Undecoded fields remain unavailable. Demo values are clearly labelled and are not game telemetry.

## Run the bridge locally

Requires Python 3.10+.

```powershell
cd telemetry-bridge
py -m pip install -r requirements.txt
py bridge.py
```

Open `index.html` and click **CONNECT LIVE** (default `ws://localhost:20778`). In F1 25, enable UDP telemetry in **Settings → Telemetry**, choose UDP format **2026** for the 2026 Season Pack or **2025** for base F1 25, set port **20777**, and choose the PC running the bridge as destination.

The bridge binds its UDP, WebSocket and health endpoints to loopback by default. To receive UDP from a console, bind UDP to the gaming PC's private LAN address, for example:

```powershell
py bridge.py --udp-host 192.168.1.20
```

The browser can still connect locally to `ws://localhost:20778`. If a browser on another LAN device needs access, bind `--ws-host` to the specific private interface address and use `ws://<gaming-pc-ip>:20778`. Expose only the private interface needed for your setup. The health endpoint is `http://localhost:20779/`.

## GitHub Pages

Enable Pages for the `main` branch and root folder. GitHub Pages serves the static dashboard but cannot receive UDP. A hosted HTTPS page cannot connect to an insecure `ws://` endpoint; remote Pages use requires a properly configured secure `wss://` endpoint. For race day, running the local page and bridge on the same PC is the straightforward option.

## Recording

Start recording to capture received frames in browser memory. Export JSON to retain a session or CSV for available per-frame fields. Load a JSON export to replay. Demo recordings remain demo data.

## Protocol scope and known limitations

EA's 2026 Season Pack uses a different UDP format from base F1 25; the packet format, packet ID and exact packet length are checked for every incoming datagram. This initial release decodes only Car Telemetry. While the browser supports the visual areas for strategy, flags, lap analysis and race control, it does **not** yet decode the packets required for accurate session/lap timing, ERS charge/deployment, FIA flags/marshal zones, safety car/VSC state and authoritative delta, tyre wear, track map, or multiplayer leaderboard. Those fields are deliberately not presented as live values. VSC speed plans and corner coaching are not inferred from a schematic.

## References

- [EA SPORTS F1 25 / 2026 Season Pack UDP specification](https://forums.ea.com/blog/f1-games-game-info-hub-en/ea-sports%E2%84%A2-f1%C2%AE25-2026-season-pack-udp-specification/12187347)
- [F1 telemetry packet size and format notes](https://github.com/rdgonzaga/f1-game-telemetry/blob/main/docs/udp-spec.md)
