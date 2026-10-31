#!/usr/bin/env python3
"""Loopback-first F1 25 / 2026 UDP to WebSocket bridge."""
import argparse
import json
import socket
import struct
import threading
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from websockets.sync.server import serve

HEADER = 29
# Official packed datagram sizes. Unknown IDs/versions are never unpacked.
SIZES = {
    2025: {0:1349,1:753,2:1285,3:45,4:1284,5:1133,6:1352,7:1239,8:1042,9:954,10:1041,11:1460,12:231,13:273,14:101,15:1131},
    2026: {0:1325,1:926,2:1399,3:45,4:1470,5:1233,6:1448,7:1445,8:1134,9:1062,10:1133,11:1460,12:231,13:273,14:104,15:1231,16:269},
}
lock = threading.Lock()
stop = threading.Event()
latest = {"revision":0,"received":0,"invalid":0,"data":{}}
zones = []
track_length = 0

def parse_packet(buf):
    if len(buf) < HEADER:
        raise ValueError("short header")
    fmt = struct.unpack_from("<H", buf, 0)[0]
    version, pid, player = buf[5], buf[6], buf[27]
    if fmt not in SIZES or SIZES[fmt].get(pid) != len(buf):
        raise ValueError("unsupported format, packet ID, or size")
    if version != 1:
        raise ValueError("unsupported packet version")
    cars = 24 if fmt == 2026 else 22
    out = {"format":fmt,"packetVersion":version,"packetId":pid}
    if pid == 6:
        slot = 59 if fmt == 2026 else 60
        if player >= cars: raise ValueError("invalid player index")
        o = HEADER + player * slot
        out.update(speed=struct.unpack_from("<H",buf,o)[0],
          throttle=max(0,min(1,struct.unpack_from("<f",buf,o+2)[0])),
          steer=struct.unpack_from("<f",buf,o+6)[0],
          brake=max(0,min(1,struct.unpack_from("<f",buf,o+10)[0])),
          gear=struct.unpack_from("<b",buf,o+15)[0],
          rpm=struct.unpack_from("<H",buf,o+16)[0],drs=bool(buf[o+18]),
          revLightsPercent=buf[o+19],revLightsBits=struct.unpack_from("<H",buf,o+20)[0],
          brakeTempC=list(struct.unpack_from("<4H",buf,o+22)),
          tyreSurfaceTempC=list(struct.unpack_from("<4B",buf,o+30)),
          tyreInnerTempC=list(struct.unpack_from("<4B",buf,o+34)))
        out["engineTempC"] = buf[o+38] if fmt == 2026 else struct.unpack_from("<H",buf,o+38)[0]
        out["tyrePressurePsi"] = list(struct.unpack_from("<4f",buf,o+(39 if fmt==2026 else 40)))
    elif pid == 1 and fmt == 2026:
        # Fixed 21 marshal slots; each is a packed float start + signed flag.
        count = buf[47]
        if count > 21: raise ValueError("invalid marshal zone count")
        out.update(trackTemp=struct.unpack_from("<b",buf,30)[0],
          trackLength=struct.unpack_from("<H",buf,33)[0],
          sessionType=buf[35],trackId=struct.unpack_from("<b",buf,36)[0],
          totalLaps=buf[32],safetyCarStatus=buf[153])
        out["marshalZones"] = [[struct.unpack_from("<f",buf,48+i*5)[0],struct.unpack_from("<b",buf,52+i*5)[0]] for i in range(count)]
    elif pid == 2:
        if player >= cars: raise ValueError("invalid player index")
        o=HEADER+player*57
        s1=struct.unpack_from("<H",buf,o+8)[0]+60000*buf[o+10]
        s2=struct.unpack_from("<H",buf,o+11)[0]+60000*buf[o+13]
        out.update(lastLapMs=struct.unpack_from("<I",buf,o)[0],
          currentLapMs=struct.unpack_from("<I",buf,o+4)[0],s1Ms=s1,s2Ms=s2,
          lapDistance=struct.unpack_from("<f",buf,o+20)[0],
          scDelta=struct.unpack_from("<f",buf,o+28)[0],
          position=buf[o+32],lap=buf[o+33],sector=buf[o+36],
          penalties=buf[o+38])
    elif pid == 3:
        code=buf[29:33].decode("ascii","replace")
        out["eventCode"]=code
        if code=="SCAR":
            sc_type,event_type=buf[33],buf[34]
            out["safetyCar"]={1:"SAFETY CAR",2:"VSC",3:"FORMATION LAP"}.get(sc_type)
            if event_type==3: out["flag"]="green"
        elif code=="RDFL": out["flag"]="red"
        elif code=="CHQF": out["flag"]="chequered"
    elif pid == 7:
        if player >= cars: raise ValueError("invalid player index")
        slot=59 if fmt==2026 else 55
        o=HEADER+player*slot
        # Common 2025/2026 CarStatus prefix through ERS mode.
        fuel=struct.unpack_from("<f",buf,o+5)[0]
        fia=struct.unpack_from("<b",buf,o+28)[0]
        store=struct.unpack_from("<f",buf,o+37)[0]
        mode=buf[o+41]
        harvest_k=struct.unpack_from("<f",buf,o+42)[0]
        harvest_h=struct.unpack_from("<f",buf,o+46)[0]
        deployed=struct.unpack_from("<f",buf,o+54 if fmt==2026 else o+50)[0]
        out.update(fuelKg=fuel,ersPercent=max(0,min(100,store/4000000*100)),
          energyKj=store/1000,energyUsedLapKj=deployed/1000,
          energyHarvestedLapKj=(harvest_k+harvest_h)/1000,ersMode=mode,boost=(mode==3))
        out["flag"]={0:None,1:"green",2:"blue",3:"yellow"}.get(fia)
    elif pid == 10:
        if player >= cars: raise ValueError("invalid player index")
        o=HEADER+player*46
        out["tyreWear"]=list(struct.unpack_from("<4f",buf,o))
    return out

def udp_loop(host,port):
    global zones,track_length
    sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
    sock.bind((host,port));sock.settimeout(1)
    print("UDP listening on %s:%s"%(host,port),flush=True)
    while not stop.is_set():
        try: buf,_=sock.recvfrom(4096)
        except socket.timeout: continue
        except OSError: break
        try:
            packet=parse_packet(buf)
            with lock:
                data=latest["data"]
                data.update({k:v for k,v in packet.items() if k not in ("format","packetVersion","packetId","marshalZones")})
                data.update(format=packet["format"],packetVersion=packet["packetVersion"],packetId=6)
                if "marshalZones" in packet:
                    zones=packet["marshalZones"];track_length=packet.get("trackLength",0)
                if "lapDistance" in packet and zones and track_length>0:
                    fraction=(packet["lapDistance"]%track_length)/track_length
                    zone_flag=next((flag for start,flag in zones if start<=fraction and flag in (1,2,3)),None)
                    if zone_flag==1:data["flag"]="green"
                    elif zone_flag==2:data["flag"]="blue"
                    elif zone_flag==3:data["flag"]="yellow"
                if "safetyCarStatus" in packet:
                    data["safetyCar"]={0:None,1:"SAFETY CAR",2:"VSC",3:"FORMATION LAP"}.get(packet["safetyCarStatus"])
                if packet.get("eventCode") in ("SCAR","RDFL","CHQF"):
                    if "flag" in packet:data["flag"]=packet["flag"]
                    if "safetyCar" in packet:data["safetyCar"]=packet["safetyCar"]
                data["receivedAt"]=time.time()
                latest["received"]+=1;latest["revision"]+=1
        except (ValueError,struct.error,IndexError) as exc:
            with lock: latest["invalid"]+=1
            print("Dropped UDP packet:",exc,flush=True)
    sock.close()

def handler(ws):
    last=0
    try:
        while not stop.is_set():
            with lock:
                rev=latest["revision"]
                data=latest["data"].copy() if latest["received"] else None
            # Do not send an empty packet on browser connect: wait for real UDP.
            if data is not None and rev!=last:
                ws.send(json.dumps({"type":"telemetry","data":data}));last=rev
            time.sleep(.03)
    except Exception: pass

class Health(BaseHTTPRequestHandler):
    def do_GET(self):
        with lock:
            body=json.dumps({"service":"fermaxo-udp-bridge","validPackets":latest["received"],"invalidPackets":latest["invalid"],"hasTelemetry":bool(latest["data"])}).encode()
        self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(body)
    def log_message(self,*args): pass

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--udp-host",default="127.0.0.1",help="default loopback; use a private LAN IP for console UDP")
    p.add_argument("--udp-port",type=int,default=20777)
    p.add_argument("--ws-host",default="127.0.0.1",help="default loopback")
    p.add_argument("--ws-port",type=int,default=20778)
    p.add_argument("--health-host",default="127.0.0.1")
    p.add_argument("--health-port",type=int,default=20779)
    a=p.parse_args()
    threading.Thread(target=udp_loop,args=(a.udp_host,a.udp_port),daemon=True).start()
    http=HTTPServer((a.health_host,a.health_port),Health)
    threading.Thread(target=http.serve_forever,daemon=True).start()
    print("Dashboard auto-connect: ws://%s:%s"%(a.ws_host,a.ws_port),flush=True)
    try:
        with serve(handler,a.ws_host,a.ws_port,ping_interval=20,ping_timeout=20) as server: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: stop.set();http.shutdown()
if __name__=="__main__": main()
