import type { SelectedRoute } from './route-selector.js';

function toDms(deg: number, posDir: string, negDir: string): string {
  const dir = deg >= 0 ? posDir : negDir;
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const minFull = (abs - d) * 60;
  const m = Math.floor(minFull);
  const s = (minFull - m) * 60;
  return `${dir}${d}° ${String(m).padStart(2, '0')}' ${s.toFixed(2)}"`;
}

function worldPos(lat: number, lon: number): string {
  return `${toDms(lat, 'N', 'S')},${toDms(lon, 'E', 'W')},+000000.00`;
}

export function buildPln(route: SelectedRoute): string {
  const { departure: dep, destination: dest, aircraft } = route;
  return `<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="AceXML" version="1,0">
    <Descr>AceXML Document</Descr>
    <FlightPlan.FlightPlan>
        <Title>${dep.icao} to ${dest.icao}</Title>
        <FPType>IFR</FPType>
        <RouteType>LowAlt</RouteType>
        <CruisingAlt>${aircraft.cruise_fl}</CruisingAlt>
        <DepartureID>${dep.icao}</DepartureID>
        <DestinationID>${dest.icao}</DestinationID>
        <Descr>${dep.icao}, ${dest.icao}</Descr>
        <DepartureName>${dep.name}</DepartureName>
        <DestinationName>${dest.name}</DestinationName>
        <AppVersion>
            <AppVersionMajor>11</AppVersionMajor>
            <AppVersionBuild>282174</AppVersionBuild>
        </AppVersion>
        <ATCWaypoint id="${dep.icao}">
            <ATCWaypointType>Airport</ATCWaypointType>
            <WorldPosition>${worldPos(dep.lat, dep.lon)}</WorldPosition>
            <ICAO>
                <ICAOIdent>${dep.icao}</ICAOIdent>
            </ICAO>
        </ATCWaypoint>
        <ATCWaypoint id="${dest.icao}">
            <ATCWaypointType>Airport</ATCWaypointType>
            <WorldPosition>${worldPos(dest.lat, dest.lon)}</WorldPosition>
            <ICAO>
                <ICAOIdent>${dest.icao}</ICAOIdent>
            </ICAO>
        </ATCWaypoint>
    </FlightPlan.FlightPlan>
</SimBase.Document>`;
}

export function plnFilename(route: SelectedRoute): string {
  return `${route.departure.icao}-${route.destination.icao}.pln`;
}
