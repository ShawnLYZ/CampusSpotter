import type { TableName } from '../../bundle/rows.ts';
import baselineValues from './baseline_values.json' with { type: 'json' };
import settings from './settings.json' with { type: 'json' };
import cafeteriaOutlets from './cafeteria_outlets.json' with { type: 'json' };
import energyProfiles from './energy_profiles.json' with { type: 'json' };
import waitingHalls from './waiting_halls.json' with { type: 'json' };
import shuttleTimetable from './shuttle_timetable.json' with { type: 'json' };
import sources from './sources.json' with { type: 'json' };
import rooms from './rooms.json' with { type: 'json' };
import timetableDays from './timetable_days.json' with { type: 'json' };
import timetableGroups from './timetable_groups.json' with { type: 'json' };
import timetableConditioned from './timetable_conditioned.json' with { type: 'json' };
import prayerTimes from './prayer_times.json' with { type: 'json' };
import weatherHourly from './weather_hourly.json' with { type: 'json' };
import trafficCache from './traffic_cache.json' with { type: 'json' };
import lrtRidershipDaily from './lrt_ridership_daily.json' with { type: 'json' };
import disruptions from './disruptions.json' with { type: 'json' };
import disruptionSources from './disruption_sources.json' with { type: 'json' };
import aiEstimates from './ai_estimates.json' with { type: 'json' };

// Later tasks replace the [] of a table with its imported JSON file.
export const fixtureTables: Record<TableName, unknown[]> = {
  baseline_values: baselineValues,
  settings,
  rooms,
  cafeteria_outlets: cafeteriaOutlets,
  energy_profiles: energyProfiles,
  waiting_halls: waitingHalls,
  shuttle_timetable: shuttleTimetable,
  timetable_days: timetableDays,
  timetable_groups: timetableGroups,
  timetable_conditioned: timetableConditioned,
  prayer_times: prayerTimes,
  weather_hourly: weatherHourly,
  traffic_cache: trafficCache,
  lrt_ridership_daily: lrtRidershipDaily,
  disruptions,
  disruption_sources: disruptionSources,
  ai_estimates: aiEstimates,
  sources,
};
