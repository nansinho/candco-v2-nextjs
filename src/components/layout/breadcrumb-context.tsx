"use client";

import * as React from "react";

interface BreadcrumbOverrides {
  [segment: string]: string;
}

interface BreadcrumbContextValue {
  overrides: BreadcrumbOverrides;
  setOverride: (segment: string, label: string) => void;
  clearOverrides: () => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({
  overrides: {},
  setOverride: () => {},
  clearOverrides: () => {},
});

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = React.useState<BreadcrumbOverrides>({});

  const setOverride = React.useCallback((segment: string, label: string) => {
    setOverrides((prev) => ({ ...prev, [segment]: label }));
  }, []);

  const clearOverrides = React.useCallback(() => {
    setOverrides({});
  }, []);

  const value = React.useMemo(
    () => ({ overrides, setOverride, clearOverrides }),
    [overrides, setOverride, clearOverrides]
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Hook to set a breadcrumb label for a UUID segment.
 * Call this in detail pages to replace UUID with entity name.
 */
export function useBreadcrumb(segment: string | undefined, label: string | undefined) {
  const { setOverride } = React.useContext(BreadcrumbContext);

  React.useEffect(() => {
    if (segment && label) {
      setOverride(segment, label);
    }
  }, [segment, label, setOverride]);
}

export function useBreadcrumbOverrides() {
  return React.useContext(BreadcrumbContext).overrides;
}
