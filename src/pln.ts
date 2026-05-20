import type { SelectedRoute } from './route-selector.js';

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function buildPln(route: SelectedRoute): string {
  const { departure: dep, destination: dest } = route;
  const depIcao  = xmlEscape(dep.icao);
  const destIcao = xmlEscape(dest.icao);
  return `<?xml version="1.0" encoding="UTF-8"?>
<SimBase.Document Type="AceXML" version="1,0">
    <Descr>AceXML Document</Descr>
    <FlightPlan.FlightPlan>
        <Title>${depIcao} to ${destIcao}</Title>
        <FPType>IFR</FPType>
        <CruisingAlt>0</CruisingAlt>
        <DepartureID>${depIcao}</DepartureID>
        <DestinationID>${destIcao}</DestinationID>
        <Descr>${depIcao}, ${destIcao}</Descr>
        <DepartureName>${xmlEscape(dep.name)}</DepartureName>
        <DestinationName>${xmlEscape(dest.name)}</DestinationName>
        <AppVersion>
            <AppVersionMajor>11</AppVersionMajor>
            <AppVersionBuild>282174</AppVersionBuild>
        </AppVersion>
    </FlightPlan.FlightPlan>
</SimBase.Document>`;
}

export function plnFilename(route: SelectedRoute): string {
  return `${route.departure.icao}-${route.destination.icao}.pln`;
}
