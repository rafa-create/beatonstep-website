/**
 * Single production paid/API gate for every Strava operation.
 * Both export and import/world-claim paths must depend on this same value.
 * Off by default: a missing/incorrect deployment var never enables access.
 */
export function stravaApiEnabled(env) {
  return env?.STRAVA_API_ENABLED === 'true';
}
