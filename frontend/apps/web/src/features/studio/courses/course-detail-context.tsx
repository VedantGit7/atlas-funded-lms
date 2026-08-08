"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type CourseDetailContextValue = {
  dashboardRefreshToken: number;
  bumpDashboardRefresh: () => void;
  enrollDialogOpen: boolean;
  openEnrollDialog: () => void;
  closeEnrollDialog: () => void;
};

const CourseDetailContext = createContext<CourseDetailContextValue | null>(null);

export function CourseDetailProvider({ children }: { children: React.ReactNode }) {
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);

  const bumpDashboardRefresh = useCallback(() => {
    setDashboardRefreshToken((value) => value + 1);
  }, []);

  const value = useMemo(
    () => ({
      dashboardRefreshToken,
      bumpDashboardRefresh,
      enrollDialogOpen,
      openEnrollDialog: () => {
        setEnrollDialogOpen(true);
      },
      closeEnrollDialog: () => {
        setEnrollDialogOpen(false);
      },
    }),
    [dashboardRefreshToken, bumpDashboardRefresh, enrollDialogOpen],
  );

  return <CourseDetailContext.Provider value={value}>{children}</CourseDetailContext.Provider>;
}

export function useCourseDetailActions(): CourseDetailContextValue {
  const value = useContext(CourseDetailContext);
  if (!value) {
    throw new Error("useCourseDetailActions must be used within CourseDetailProvider");
  }
  return value;
}
