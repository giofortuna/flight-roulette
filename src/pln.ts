import type { SelectedRoute } from './route-selector.js';

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
    </FlightPlan.FlightPlan>
</SimBase.Document>`;
}

export function plnFilename(route: SelectedRoute): string {
  return `${route.departure.icao}-${route.destination.icao}.pln`;
}
