#!/usr/bin/env python3
"""F1 25 / 2026 Season Pack UDP to a local phone dashboard."""
import argparse
import json
import os
import socket
import struct
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from websockets.sync.server import serve

from protocol import parse_packet

lock = threading.Lock()
stop = threading.Event()
latest = {"revision":0,"received":0,"invalid":0,"data":{}}
zones = []
track_length = 0
red_flag = False
event_flag = None
event_flag_until = 0
bridge_config = {}
def udp_loop(host,port):
    global zones,track_length,red_flag,event_flag,event_flag_until
    sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
    try:
        sock.bind((host,port))
        sock.settimeout(1)
        with lock:
            bridge_config["udpReady"]=True
            bridge_config["udpError"]=""
    except OSError as exc:
        with lock:
            bridge_config["udpReady"]=False
            bridge_config["udpError"]=str(exc)
        print("UDP bind failed: %s"%exc,flush=True)
        sock.close()
        return
    print("UDP listening on %s:%s"%(host,port),flush=True)
    while not stop.is_set():
        try: buf,_=sock.recvfrom(4096)
        except socket.timeout: continue
        except OSError: break
        try:
            packet=parse_packet(buf)
            with lock:
                data=latest["data"]
                uid=packet.get("sessionUID")
                if data.get("sessionUID") is not None and uid is not None and data["sessionUID"]!=uid:
                    data.clear()
                    zones=[];track_length=0;red_flag=False;event_flag=None;event_flag_until=0
                data.update({k:v for k,v in packet.items() if k not in ("format","packetVersion","packetId","marshalZones")})
                data.update(format=packet["format"],packetVersion=packet["packetVersion"],packetId=6,sourcePacketId=packet["packetId"])
                if "marshalZones" in packet:
                    zones=packet["marshalZones"];track_length=packet.get("trackLength",0)
                if "lapDistance" in packet and zones and track_length>0:
                    fraction=(packet["lapDistance"]%track_length)/track_length
                    active_zone=max((zone for zone in zones if zone[0]<=fraction),key=lambda zone:zone[0],default=None)
                    zone_flag=active_zone[1] if active_zone else None
                    data["flag"]={1:"green",2:"blue",3:"yellow"}.get(zone_flag)
                if "safetyCarStatus" in packet:
                    data["safetyCar"]={0:None,1:"SAFETY CAR",2:"VSC",3:"FORMATION LAP"}.get(packet["safetyCarStatus"])
                code=packet.get("eventCode")
                if code=="RDFL":
                    red_flag=True
                elif code=="CHQF":
                    event_flag="chequered";event_flag_until=0
                elif code=="SSTA":
                    red_flag=False;event_flag=None;event_flag_until=0;data["flag"]=None
                elif code=="SCAR":
                    if "safetyCar" in packet:data["safetyCar"]=packet["safetyCar"]
                    if packet.get("safetyCarEventType")==3:
                        red_flag=False;event_flag="green";event_flag_until=time.time()+6
                if red_flag:
                    data["flag"]="red"
                elif event_flag:
                    if event_flag_until==0 or time.time()<event_flag_until:
                        data["flag"]=event_flag
                    else:
                        if data.get("flag")==event_flag:data["flag"]=None
                        event_flag=None
                if code=="CHQF":data["flag"]="chequered"
                if data.get("currentLapMs") is not None and data.get("bestLapMs"):
                    data["deltaMs"]=data["currentLapMs"]-data["bestLapMs"]
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
            if data is not None and "speed" in data and rev!=last:
                data["sessionUID"]=str(data.get("sessionUID",""))
                ws.send(json.dumps({"type":"telemetry","data":data}));last=rev
            time.sleep(.03)
    except Exception: pass

class Health(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):
        root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        super().__init__(*args,directory=root,**kwargs)
    def do_GET(self):
        if self.path in ("/health","/health/"):
            with lock:
                received_at=latest["data"].get("receivedAt")
                age=max(0,time.time()-received_at) if received_at else None
                body=json.dumps({"service":"fermaxo-udp-bridge","validPackets":latest["received"],"invalidPackets":latest["invalid"],"hasTelemetry":"speed" in latest["data"],"lastPacketAge":age,**bridge_config}).encode()
            self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(body)
            return
        return super().do_GET()
    def log_message(self,*args): pass

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--udp-host",default="127.0.0.1",help="default loopback; use a private LAN IP for console UDP")
    p.add_argument("--udp-port",type=int,default=20777)
    p.add_argument("--ws-host",default="0.0.0.0",help="bind for local phone/tablet access")
    p.add_argument("--ws-port",type=int,default=20778)
    p.add_argument("--http-host",default="0.0.0.0",help="bind dashboard web server for phone access")
    p.add_argument("--http-port",type=int,default=20780)
    a=p.parse_args()
    bridge_config.update(udpHost=a.udp_host,udpPort=a.udp_port,wsPort=a.ws_port,httpPort=a.http_port,format=2026,udpReady=False,udpError="")
    threading.Thread(target=udp_loop,args=(a.udp_host,a.udp_port),daemon=True).start()
    http=ThreadingHTTPServer((a.http_host,a.http_port),Health)
    threading.Thread(target=http.serve_forever,daemon=True).start()
    print("Dashboard on this PC: http://127.0.0.1:%s/"%a.http_port,flush=True)
    try:
        addresses=socket.gethostbyname_ex(socket.gethostname())[2]
        lan=next((ip for ip in addresses if ip.startswith(("192.168.","10.")) or any(ip.startswith("172.%d."%n) for n in range(16,32))),None)
        if lan:
            bridge_config["phoneUrl"]="http://%s:%s/"%(lan,a.http_port)
            print("Dashboard on phone: "+bridge_config["phoneUrl"],flush=True)
        else:
            bridge_config["phoneUrl"]="http://127.0.0.1:%s/"%a.http_port
    except OSError: pass
    print("WebSocket bridge: ws://<this-PC-address>:%s"%a.ws_port,flush=True)
    try:
        with serve(handler,a.ws_host,a.ws_port,ping_interval=20,ping_timeout=20) as server: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: stop.set();http.shutdown()
if __name__=="__main__": main()
