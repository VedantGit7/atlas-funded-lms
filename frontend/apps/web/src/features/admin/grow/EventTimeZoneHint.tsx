"use client";

import { useEffect, useState } from "react";
import { timeZoneLongName } from "./events-shared";

/**
 * Which zone the start and end times are typed in, and which zone visitors
 * see (QA review 2 H29). The browser's zone is read after mount, so the
 * server render and the first browser render match.
 */
export function EventTimeZoneHint({
  id,
  academyTimeZone,
}: {
  id: string;
  academyTimeZone?: string | null;
}) {
  const [browserZone, setBrowserZone] = useState<string | null>(null);

  useEffect(() => {
    setBrowserZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  if (!browserZone) return null;
  const now = new Date();
  const yours = timeZoneLongName(browserZone, now);
  const academy = academyTimeZone ? timeZoneLongName(academyTimeZone, now) : null;

  return (
    <p id={id} className="mt-1.5 text-xs text-[var(--admin-on-surface-variant)]">
      Enter times in your time zone ({yours}).
      {academy && academy !== yours
        ? ` Visitors and emails show them in your academy's time zone (${academy}).`
        : academy
          ? " Visitors and emails show the time zone too."
          : null}
    </p>
  );
}
