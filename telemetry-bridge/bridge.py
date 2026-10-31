#!/usr/bin/env python3
"""Local F1 25 / 2026 UDP → WebSocket telemetry bridge.

By default every service binds to loopback. To receive a console's UDP stream,
pass the gaming PC's private LAN address to --udp-host. Bind WebSocket to a
chosen private interface only when a remote browser needs it.
"""
import argparse, json, socket, struct, threading, time
from http.server import BaseHTTPRequestHandler, HTTPServer
from websockets.sync.server import serve
HEADER=29
EXPECTED={(2025,0):1349,(2025,1):753,(2025,2):1285,(2025,3):45,(2025,4):1284,(2025,5):1133,(2025,6):1352,(2025,7):1239,(2025,8):1042,(2025,9):954,(2025,10):1041,(2025,11):1460,(2025,12):231,(2025,13):273,(2025,14):101,(2025,15):1131,(2026,0):1325,(2026,1):926,(2026,2):1399,(2026,3):45,(2026,4):1470,(2026,5):1233,(2026,6):1448,(2026,7):1445,(2026,8):1134,(2026,9):1062,(2026,10):1133,(2026,11):1460,(2026,12):231,(2026,13):273,(2026,14):104,(2026,15):1231,(2026,16):269}
latest={"connected":False,"received":0,"invalid":0,"data":{}}
lock=threading.Lock(); shutdown=threading.Event()
def parse_packet(buf):
 if len(buf)<HEADER: raise ValueError("short header")
 year=struct.unpack_from("<H",buf,0)[0]; pid=buf[6]; player=buf[27]
 if year not in (2025,2026): raise ValueError("unsupported packet format")
 if EXPECTED.get((year,pid))!=len(buf): raise ValueError("packet id/length mismatch")
 result={"format":year,"packetVersion":buf[5],"packetId":pid,"playerCarIndex":player}
 if pid==6:
  cars=24 if year==2026 else 22; slot=59 if year==2026 else 60
  if player>=cars: raise ValueError("player index outside grid")
  o=HEADER+player*slot
  speed=struct.unpack_from("<H",buf,o)[0]
  throttle,steer,brake=struct.unpack_from("<fff",buf,o+2)
  gear=struct.unpack_from("<b",buf,o+15)[0]; rpm=struct.unpack_from("<H",buf,o+16)[0]; drs=bool(buf[o+18])
  brakes=struct.unpack_from("<4H",buf,o+22); surface=struct.unpack_from("<4B",buf,o+30); inner=struct.unpack_from("<4B",buf,o+34)
  engine=buf[o+38] if year==2026 else struct.unpack_from("<H",buf,o+38)[0]
  pressure=struct.unpack_from("<4f",buf,o+(39 if year==2026 else 40))
  result.update(speed=speed,throttle=max(0,min(1,throttle)),steer=steer,brake=max(0,min(1,brake)),gear=gear,rpm=rpm,drs=drs,brakeTempC=list(brakes),tyreSurfaceTempC=list(surface),tyreInnerTempC=list(inner),engineTempC=engine,tyrePressurePsi=list(pressure))
 return result
def udp_loop(host,port):
 sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);sock.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);sock.bind((host,port));sock.settimeout(1)
 print(f"UDP listening on {host}:{port}")
 while not shutdown.is_set():
  try: buf,_=sock.recvfrom(4096)
  except socket.timeout: continue
  except OSError: break
  try:
   packet=parse_packet(buf)
   if packet["packetId"]==6:
    packet["receivedAt"]=time.time()
    with lock: latest.update(connected=True,received=latest["received"]+1,data=packet)
  except (ValueError,struct.error):
   with lock: latest["invalid"]+=1
 sock.close()
def handler(ws):
 try:
  last=None
  while not shutdown.is_set():
   with lock: snapshot=latest.copy()
   marker=snapshot["received"]
   if marker!=last:
    ws.send(json.dumps({"type":"telemetry","data":snapshot["data"]}));last=marker
   time.sleep(.05)
 except Exception: pass
class Health(BaseHTTPRequestHandler):
 def do_GET(self):
  with lock: body=json.dumps({"service":"fermaxo-udp-bridge","udpConnected":latest["connected"],"validTelemetryPackets":latest["received"],"invalidPackets":latest["invalid"]}).encode()
  self.send_response(200);self.send_header("Content-Type","application/json");self.end_headers();self.wfile.write(body)
 def log_message(self,*args): pass
def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument("--udp-host",default="127.0.0.1",help="bind address; use gaming PC private LAN IP for console UDP")
 p.add_argument("--udp-port",type=int,default=20777)
 p.add_argument("--ws-host",default="127.0.0.1",help="WebSocket bind address; loopback by default")
 p.add_argument("--ws-port",type=int,default=20778)
 p.add_argument("--health-host",default="127.0.0.1")
 p.add_argument("--health-port",type=int,default=20779)
 a=p.parse_args();threading.Thread(target=udp_loop,args=(a.udp_host,a.udp_port),daemon=True).start()
 http=HTTPServer((a.health_host,a.health_port),Health);threading.Thread(target=http.serve_forever,daemon=True).start()
 print(f"WebSocket ws://{a.ws_host}:{a.ws_port} · health http://{a.health_host}:{a.health_port}/")
 try:
  with serve(handler,a.ws_host,a.ws_port,ping_interval=20,ping_timeout=20) as server: server.serve_forever()
 except KeyboardInterrupt: pass
 finally: shutdown.set();http.shutdown()
if __name__=="__main__": main()
