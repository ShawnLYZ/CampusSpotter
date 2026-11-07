export function PrivacyTab() {
  return (
    <section aria-labelledby="h-priv" className="max-w-3xl rounded-lg border border-border bg-panel p-5">
      <h2 id="h-priv" className="mb-2 text-lg font-semibold text-text">Privacy</h2>
      <p className="text-text">
        CampusSpotter never stores personal data. The APU timetable feed contains lecturer names and account IDs; these fields are never read, stored or logged. Cohort (intake) codes are used only in memory to count first and last classes of the day and are never stored. Only counts per block, room type and time are kept. No student accounts or student data exist in the system.
      </p>
    </section>
  );
}
