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

In F1 25 enable UDP telemetry under **Settings → Telemetry**, select UDP format **2026** for the 2026 Season Pack, set port **20777**, and set the destination IP to the gaming PC. The bridge can receive base F1 25's **2025** format, but this wheel interface requires **2026** packets and will clearly reject the older format. Open `index.html` and press **LINK**.

The bridge binds UDP, WebSocket and health endpoints to loopback by default. To receive a console's UDP stream, bind UDP to the gaming PC's private LAN address, for example:

```powershell
py bridge.py --udp-host 192.168.1.20
```

For a browser on another LAN device, bind `--ws-host` to the specific private interface and connect to `ws://<gaming-pc-ip>:20778`. The health endpoint is `http://localhost:20779/`.

## GitHub Pages

Enable Pages for the `main` branch and root folder. GitHub Pages serves the static interface but cannot receive UDP. An HTTPS Pages site cannot connect to an insecure `ws://` bridge; remote use needs a properly configured `wss://` endpoint. Running the local page beside the bridge is the straightforward option.

## Current protocol scope

The bridge validates packet format, packet version 1, and exact packet length. It decodes Car Telemetry, Session, Lap Data, Car Status, Event, and Car Damage packets for the player's car. This supplies live driving inputs, tyre temperatures, basic lap times and sector 1/2 values, position, ERS store and usage, fuel, Safety Car/VSC status, game delta, basic FIA flag, and tyre wear when those packets are actually available. speed, throttle, steering, brake, gear, RPM, DRS, brake temperatures, tyre temperatures, tyre pressures and engine temperature. The LCD is laid out for additional packet fields, but the bridge does **not** yet decode lap timing, ERS energy, FIA flags, marshal zones, Safety Car/VSC state or delta, tyre wear, session information, or leaderboard. Those fields therefore remain unavailable in live mode. Recommendations and corner speed plans are not generated without supporting telemetry.

The interface reconnects to the local bridge automatically and keeps the driving values visible on HOME while race alerts take priority. JavaScript syntax and interface element references are checked. A real game session and visual browser run are still needed to verify packet offsets against the user's game build.

## References

- [EA SPORTS F1 25 / 2026 Season Pack UDP specification](https://forums.ea.com/blog/f1-games-game-info-hub-en/ea-sports%E2%84%A2-f1%C2%AE25-2026-season-pack-udp-specification/12187347)
- [Packet size and format notes](https://github.com/rdgonzaga/f1-game-telemetry/blob/main/docs/udp-spec.md)
