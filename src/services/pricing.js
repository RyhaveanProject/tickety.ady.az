/* Qiymət hesablama — axtarış (scheduleService) və sifariş (bookingService) üçün vahid mənbə */

/* Xəttin tam marşrutu (məs. Bakı — Tbilisi) üzrə gediş haqqı sinfin özündə göstərilən
   qiymətdir. Yalnız aralıq məsafələr üçün məsafə əsaslı düstur tətbiq olunur. */
function fare(trip, fromCode, toCode, cls) {
  const stops = trip.stops || [];
  const fromIdx = stops.findIndex((s) => s.code === fromCode);
  const toIdx = stops.findIndex((s) => s.code === toCode);
  const fromStop = stops[fromIdx] || { distanceKm: 0 };
  const toStop = stops[toIdx] || { distanceKm: 0 };
  const distance = Math.max(1, (toStop.distanceKm || 0) - (fromStop.distanceKm || 0));
  const base = cls.price || 0;

  if (trip.line === 'absheron') return round(base);

  const isFullRoute = fromIdx === 0 && toIdx === stops.length - 1;
  if (isFullRoute && (trip.line === 'georgia' || trip.line === 'international')) return round(base);

  if (distance > 40) {
    const perKm = trip.line === 'domestic' ? 0.035 : 0.06;
    const factor = cls.code === 'first' ? 1 : cls.code === 'business' ? 0.75 : 1;
    return round(Math.max(base * 0.35, distance * perKm) * factor);
  }
  return round(base * 0.5);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { fare };
