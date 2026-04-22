const J1970 = 2440588;
const J2000 = 2451545;
const RAD = Math.PI / 180;

function toJulian(date: Date): number {
  return date.getTime() / 86400000 - 0.5 + J1970;
}

function fromJulian(j: number): Date {
  return new Date((j + 0.5 - J1970) * 86400000);
}

function toDays(date: Date): number {
  return toJulian(date) - J2000;
}

function rightAscension(l: number, b: number): number {
  const e = RAD * 23.4397;
  return Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
}

function declination(l: number, b: number): number {
  const e = RAD * 23.4397;
  return Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
}

function solarMeanAnomaly(d: number): number {
  return RAD * (357.5291 + 0.98560028 * d);
}

function eclipticLongitude(m: number): number {
  const c = RAD * (1.9148 * Math.sin(m) + 0.02 * Math.sin(2 * m) + 0.0003 * Math.sin(3 * m));
  const p = RAD * 102.9372;
  return m + c + p + Math.PI;
}

function julianCycle(d: number, lw: number): number {
  return Math.round(d - 0.0009 - lw / (2 * Math.PI));
}

function approxTransit(ht: number, lw: number, n: number): number {
  return 0.0009 + (ht + lw) / (2 * Math.PI) + n;
}

function solarTransitJ(ds: number, m: number, l: number): number {
  return J2000 + ds + 0.0053 * Math.sin(m) - 0.0069 * Math.sin(2 * l);
}

function hourAngle(h: number, phi: number, d: number): number {
  return Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(d)) / (Math.cos(phi) * Math.cos(d)));
}

function getSetJ(h: number, lw: number, phi: number, dec: number, n: number, m: number, l: number): number {
  const w = hourAngle(h, phi, dec);
  const a = approxTransit(w, lw, n);
  return solarTransitJ(a, m, l);
}

export function getSunriseSunset(date: Date, latitude: number, longitude: number): {
  sunrise: Date;
  sunset: Date;
} | null {
  const lw = RAD * -longitude;
  const phi = RAD * latitude;
  const d = toDays(date);
  const n = julianCycle(d, lw);
  const ds = approxTransit(0, lw, n);

  const m = solarMeanAnomaly(ds);
  const l = eclipticLongitude(m);
  const dec = declination(l, 0);
  const jNoon = solarTransitJ(ds, m, l);

  // Sun center at -0.833° for apparent sunrise/sunset.
  const h0 = RAD * -0.833;
  const jSet = getSetJ(h0, lw, phi, dec, n, m, l);
  if (Number.isNaN(jSet)) return null; // Polar day/night edge case.
  const jRise = jNoon - (jSet - jNoon);

  return {
    sunrise: fromJulian(jRise),
    sunset: fromJulian(jSet),
  };
}
