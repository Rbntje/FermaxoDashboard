"""F1 25 UDP packet validation and decoding."""
import struct

HEADER = 29
# Official packed datagram sizes. Unknown IDs/versions are never unpacked.
SIZES = {
    2025: {0:1349,1:753,2:1285,3:45,4:1284,5:1133,6:1352,7:1239,8:1042,9:954,10:1041,11:1460,12:231,13:273,14:101,15:1131},
    2026: {0:1325,1:926,2:1399,3:45,4:1470,5:1233,6:1448,7:1445,8:1134,9:1062,10:1133,11:1460,12:231,13:273,14:104,15:1231,16:269},
}

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
    out = {"format":fmt,"packetVersion":version,"packetId":pid,
           "sessionUID":struct.unpack_from("<Q",buf,7)[0],
           "sessionTime":struct.unpack_from("<f",buf,15)[0]}
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
          tyreInnerTempC=list(struct.unpack_from("<4B",buf,o+34)),
          surfaceType=list(struct.unpack_from("<4B",buf,o+55)) if fmt==2026 else [])
        out["engineTempC"] = buf[o+38] if fmt == 2026 else struct.unpack_from("<H",buf,o+38)[0]
        out["tyrePressurePsi"] = list(struct.unpack_from("<4f",buf,o+(39 if fmt==2026 else 40)))
    elif pid == 16 and fmt == 2026:
        # 2026 CarTelemetry2: active aero and overtake mode, for every car.
        if player >= cars: raise ValueError("invalid player index")
        o = HEADER + player * 10
        out.update(activeAeroMode=buf[o], activeAeroAvailable=bool(buf[o+1]),
          overtakeAvailable=bool(buf[o+4]), overtakeActive=bool(buf[o+5]),
          regulations2026Applicable=bool(buf[o+8]), wrongWay=bool(buf[o+9]))
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
          gapToCarAheadMs=struct.unpack_from("<H",buf,o+14)[0]+60000*buf[o+16],
          gapToLeaderMs=struct.unpack_from("<H",buf,o+17)[0]+60000*buf[o+19],
          position=buf[o+32],lap=buf[o+33],pitStatus=buf[o+34],numPitStops=buf[o+35],
          sector=buf[o+36],currentLapInvalid=buf[o+37],penalties=buf[o+38],
          totalWarnings=buf[o+39],cornerCuttingWarnings=buf[o+40],
          unservedDriveThrough=buf[o+41],unservedStopGo=buf[o+42],
          gridPosition=buf[o+43],driverStatus=buf[o+44],resultStatus=buf[o+45],
          pitLaneTimerActive=buf[o+46],pitLaneTimeMs=struct.unpack_from("<H",buf,o+47)[0],
          pitStopTimeMs=struct.unpack_from("<H",buf,o+49)[0],penaltyAtPitStop=buf[o+51],
          speedTrapFastestKph=struct.unpack_from("<f",buf,o+52)[0],
          speedTrapFastestLap=buf[o+56])
        out["s3Ms"]=max(0,out["currentLapMs"]-s1-s2) if out["sector"]==2 else None
    elif pid == 3:
        code=buf[29:33].decode("ascii","replace")
        out["eventCode"]=code
        if code=="SCAR":
            sc_type,event_type=buf[33],buf[34]
            out["safetyCar"]={1:"SAFETY CAR",2:"VSC",3:"FORMATION LAP"}.get(sc_type)
            out["safetyCarEventType"]=event_type
            if event_type in (2,3): out["safetyCar"]=None
            if event_type==3: out["flag"]="green"
        elif code=="RDFL": out["flag"]="red"
        elif code=="CHQF": out["flag"]="chequered"
    elif pid == 11:
        # Session history packets rotate across cars; decode only player's lap records.
        if buf[29] == player:
            count=min(buf[30],100)
            best=[]
            for i in range(count):
                o=36+i*14
                lap_ms=struct.unpack_from("<I",buf,o)[0]
                valid=buf[o+13]
                if lap_ms>0 and valid&1: best.append(lap_ms)
            if best: out["bestLapMs"]=min(best)
            history=[]
            for i in range(count):
                o=36+i*14
                lap_ms=struct.unpack_from("<I",buf,o)[0]
                s1=struct.unpack_from("<H",buf,o+4)[0]+60000*buf[o+6]
                s2=struct.unpack_from("<H",buf,o+7)[0]+60000*buf[o+9]
                s3=struct.unpack_from("<H",buf,o+10)[0]+60000*buf[o+12]
                history.append({"lap":i+1,"time":lap_ms,"s1":s1,"s2":s2,"s3":s3,"valid":buf[o+13]&1==1})
            out["lapHistory"]=history
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
        out.update(fuelKg=fuel,fuelRemainingLaps=struct.unpack_from("<f",buf,o+13)[0],
          drsAllowed=bool(buf[o+22]),actualTyreCompound=buf[o+25],
          visualTyreCompound=buf[o+26],tyreAgeLaps=buf[o+27],
          ersPercent=max(0,min(100,store/4000000*100)),
          energyKj=store/1000,energyUsedLapKj=deployed/1000,
          energyHarvestedLapKj=(harvest_k+harvest_h)/1000,
          enginePowerICE=struct.unpack_from("<f",buf,o+29)[0]/1000,
          enginePowerMGUK=struct.unpack_from("<f",buf,o+33)[0]/1000,
          ersMode=mode,boost=(mode==3))
        out["flag"]={0:None,1:"green",2:"blue",3:"yellow"}.get(fia)
    elif pid == 10:
        if player >= cars: raise ValueError("invalid player index")
        o=HEADER+player*46
        out["tyreWear"]=list(struct.unpack_from("<4f",buf,o))
    return out
