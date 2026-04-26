export type FlightType = 'passenger' | 'cargo';
export type AirlineType = FlightType | 'both';
export type Simulator = 'msfs2020' | 'msfs2024' | 'xplane12';
export type Region = 'europe' | 'namerica' | 'asia' | 'africa' | 'pacific' | 'sam' | 'caribbean';
// Caribbean airlines exist but their airports are folded into the 'sam' file at build time.
export type AirportRegion = Exclude<Region, 'caribbean'>;
