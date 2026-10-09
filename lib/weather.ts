import weather from '../data/weather.json';

export type DayWeather = {
  highF: number | null;
  lowF: number | null;
  rainIn: number | null;
  humidityPct: number | null;
  dli: number | null; // daily light integral, mol/m²/day (approximate, from solar radiation)
};

const days: Record<string, DayWeather> = weather.days;

export const WEATHER_SOURCE = weather.source;
export const weatherForDate = (date: string): DayWeather | undefined => days[date];
