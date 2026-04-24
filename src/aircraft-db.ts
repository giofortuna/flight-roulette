export type FlightType = 'passenger' | 'cargo';
export type Simulator = 'msfs2020' | 'msfs2024' | 'xplane12';

export interface Aircraft {
  icao_type: string;
  type_name: string;
  airframe_name: string;
  flight_type: FlightType;
  simulator: Simulator[];
  range_nm: number;
  min_runway_m: number;
  cruise_ft: number;
  cruise_kts: number;
  category: 'narrowbody' | 'widebody' | 'regional' | 'turboprop';
  max_pax: number;
  max_cargo_kg: number;
  simbrief_type: string;
  simbrief_airframe_id: string;
}

export const aircraft: Aircraft[] = [
  {
    icao_type:            'B738',
    type_name:            'Boeing 737-800',
    airframe_name:        'PMDG 737-800',
    flight_type:          'passenger',
    simulator:            ['msfs2020', 'msfs2024'],
    range_nm:             2935,
    min_runway_m:         1800,
    cruise_ft:            35000,
    cruise_kts:           453,
    category:             'narrowbody',
    max_pax:              162,
    max_cargo_kg:         9000,
    simbrief_type:        'B738',
    simbrief_airframe_id: '', // TODO: locate curated PMDG airframe ID on SimBrief
  },
  {
    icao_type:            'A320',
    type_name:            'Airbus A320-200',
    airframe_name:        'Fenix A320 Sharklet CFM',
    flight_type:          'passenger',
    simulator:            ['msfs2020', 'msfs2024'],
    range_nm:             3300,
    min_runway_m:         1800,
    cruise_ft:            35000,
    cruise_kts:           447,
    category:             'narrowbody',
    max_pax:              150,
    max_cargo_kg:         7500,
    simbrief_type:        'A320',
    simbrief_airframe_id: '', // TODO: locate curated Fenix airframe ID on SimBrief
  },
];
