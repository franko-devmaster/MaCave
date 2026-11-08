export interface Setting {
  key: string;
  value: unknown;
}

export interface RefCountry {
  name: string;
}

export interface RefRegion {
  country: string;
  name: string;
}

export interface RefGrape {
  name: string;
}
