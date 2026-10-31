# FERMAXO RACING — Virtual Wheel Display

A full-screen steering wheel-inspired telemetry interface for F1 25 and its 2026 Season Pack, paired with a local UDP → WebSocket bridge.

## Wheel controls

- **DRIVE / ENERGY / TIMING / ENGINEER** buttons switch the central LCD page. The rotary-style **MODE** control advances pages; left/right arrow keys do the same.
- **LINK** connects to the bridge at `ws://localhost:20778`; **RECONNECT** retries the connection.
- **DEMO** is manual and clearly labelled. It is never enabled automatically.
- **REC / SAVE / LOAD** record incoming frames in browser memory, export JSON, and replay a saved JSON file.
- **VIEW** or the F key toggles browser fullscreen.

With no received game telemetry the LCD says **WAITING FOR F1 TELEMETRY**. If received packets go stale, it says **TELEMETRY CONNECTION LOST**. Missing fields display as `--` or `UNAVAILABLE`. The RPM strip responds to received RPM. Flag and Safety Car alerts appear only if those fields arrive from a source.

## Telemetry bridge

Requires Python 3.10+.

```powershell
cd telemetry-bridge
py -m pip install -r requirements.txt
py bridge.py
```

In F1 25 enable UDP telemetry under **Settings → Telemetry**, select UDP format **2026** for the 2026 Season Pack, set port **20777**, and set the destination IP to the gaming PC. Base F1 25's **2025** format is also accepted by the bridge. Open `index.html` and press **LINK**.

The bridge binds UDP, WebSocket and health endpoints to loopback by default. To receive a console's UDP stream, bind UDP to the gaming PC's private LAN address, for example:

```powershell
py bridge.py --udp-host 192.168.1.20
```

For a browser on another LAN device, bind `--ws-host` to the specific private interface and connect to `ws://<gaming-pc-ip>:20778`. The health endpoint is `http://localhost:20779/`.

## GitHub Pages

Enable Pages for the `main` branch and root folder. GitHub Pages serves the static interface but cannot receive UDP. An HTTPS Pages site cannot connect to an insecure `ws://` bridge; remote use needs a properly configured `wss://` endpoint. Running the local page beside the bridge is the straightforward option.

## Current protocol scope

The bridge validates packet format and exact packet length. The wheel accepts Car Telemetry only when its packetVersion is 1 and the expected fields are present; other versions are shown as unsupported rather than interpreted. It currently decodes only Car Telemetry: speed, throttle, steering, brake, gear, RPM, DRS, brake temperatures, tyre temperatures, tyre pressures and engine temperature. The LCD is laid out for additional packet fields, but the bridge does **not** yet decode lap timing, ERS energy, FIA flags, marshal zones, Safety Car/VSC state or delta, tyre wear, session information, or leaderboard. Those fields therefore remain unavailable in live mode. Recommendations and corner speed plans are not generated without supporting telemetry.

The redesign has been checked for JavaScript syntax and that every referenced interface element exists in `index.html`. It has not yet been run against a live F1 UDP session or visually verified in a browser.

## References

- [EA SPORTS F1 25 / 2026 Season Pack UDP specification](https://forums.ea.com/blog/f1-games-game-info-hub-en/ea-sports%E2%84%A2-f1%C2%AE25-2026-season-pack-udp-specification/12187347)
- [Packet size and format notes](https://github.com/rdgonzaga/f1-game-telemetry/blob/main/docs/udp-spec.md)
