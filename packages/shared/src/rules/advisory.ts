import type { Advisory, AdvisoryRuleSettings, AdvisoryState } from '../types';

export const DEFAULT_ADVISORY_RULES: AdvisoryRuleSettings = {
  salinityWatchTemperatureC: 31,
  salinityHighTemperatureC: 32,
  ammoniaWatchTemperatureC: 31,
  ammoniaHighPh: 7.8,
};

function advisoryState(
  kind: AdvisoryState['kind'],
  level: Advisory,
  inputs: AdvisoryState['inputs'],
  firedRule: string,
  updatedAt: string,
): AdvisoryState {
  return { kind, level, inputs, firedRule, updatedAt };
}

export function getSalinityAdvisory(
  inputs: { temperatureC: number; rainEvent: boolean; freshwaterDosing: boolean },
  rules = DEFAULT_ADVISORY_RULES,
  updatedAt = new Date().toISOString(),
): AdvisoryState {
  const evidence = {
    temperatureC: inputs.temperatureC,
    recentRainEvent: inputs.rainEvent ? 'yes' : 'no',
    freshwaterDosingLogged: inputs.freshwaterDosing ? 'yes' : 'no',
  };
  if (inputs.temperatureC >= rules.salinityHighTemperatureC && !inputs.rainEvent && !inputs.freshwaterDosing) {
    return advisoryState('salinity', 'high', evidence, `Temperature at or above ${rules.salinityHighTemperatureC}°C without a recent dilution event`, updatedAt);
  }
  if (inputs.temperatureC >= rules.salinityWatchTemperatureC || inputs.rainEvent || inputs.freshwaterDosing) {
    return advisoryState('salinity', 'watch', evidence, `Temperature at or above ${rules.salinityWatchTemperatureC}°C or a recent water event was logged`, updatedAt);
  }
  return advisoryState('salinity', 'low', evidence, `No salinity advisory rule fired (temperature below ${rules.salinityWatchTemperatureC}°C; no recent water event)`, updatedAt);
}

export function getAmmoniaAdvisory(
  inputs: { temperatureC: number; ph: number; feedingLoad: 'usual' | 'high' },
  rules = DEFAULT_ADVISORY_RULES,
  updatedAt = new Date().toISOString(),
): AdvisoryState {
  const evidence = {
    temperatureC: inputs.temperatureC,
    ph: inputs.ph,
    feedingLoad: inputs.feedingLoad,
  };
  if (inputs.ph >= rules.ammoniaHighPh && inputs.feedingLoad === 'high') {
    return advisoryState('ammonia', 'high', evidence, `pH at or above ${rules.ammoniaHighPh} with high feeding load`, updatedAt);
  }
  if (inputs.temperatureC >= rules.ammoniaWatchTemperatureC || inputs.ph >= rules.ammoniaHighPh || inputs.feedingLoad === 'high') {
    return advisoryState('ammonia', 'watch', evidence, `Temperature at or above ${rules.ammoniaWatchTemperatureC}°C, high pH, or high feeding load`, updatedAt);
  }
  return advisoryState('ammonia', 'low', evidence, `No ammonia advisory rule fired (temperature and pH below configured rules; usual feeding load)`, updatedAt);
}
