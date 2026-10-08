export function zonedDay(instant: Date | string, timezone: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant)); }
export function zonedInput(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(instant));
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
export function localToUtc(input: string, timezone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error('Укажите дату и время');
  const nominal = Date.parse(`${input}:00Z`);
  if (!Number.isFinite(nominal)) throw new Error('Некорректная дата');
  let guess = nominal;
  for (let i = 0; i < 4; i++) {
    const rendered = Date.parse(`${zonedInput(new Date(guess).toISOString(), timezone)}:00Z`);
    const correction = nominal - rendered;
    if (!correction) return new Date(guess).toISOString();
    guess += correction;
  }
  throw new Error('Это время отсутствует в выбранном часовом поясе из-за перевода часов');
}
export function shiftDay(day: string, delta: number) { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + delta); return date.toISOString().slice(0, 10); }
