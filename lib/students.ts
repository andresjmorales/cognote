/** Parse a YYYY-MM-DD date string as local date parts (avoids UTC shifting). */
function parseDateParts(dateString: string): [number, number, number] | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Age in whole years from a YYYY-MM-DD birthdate, or null if invalid. */
export function ageFromBirthdate(birthdate: string): number | null {
  const parts = parseDateParts(birthdate);
  if (!parts) return null;
  const [year, month, day] = parts;
  const now = new Date();
  let age = now.getFullYear() - year;
  const hadBirthdayThisYear =
    now.getMonth() + 1 > month ||
    (now.getMonth() + 1 === month && now.getDate() >= day);
  if (!hadBirthdayThisYear) age--;
  return age >= 0 && age < 130 ? age : null;
}
