export function getCurrentAcademicYear(referenceDate = new Date()): string {
  const month = referenceDate.getMonth();
  const startYear = month >= 3 ? referenceDate.getFullYear() : referenceDate.getFullYear() - 1;
  const endYearSuffix = String((startYear + 1) % 100).padStart(2, '0');

  return `${startYear}-${endYearSuffix}`;
}
