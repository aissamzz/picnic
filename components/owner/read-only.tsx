"use client";

import * as React from "react";

const ReadOnlyContext = React.createContext(false);

/** True while a super admin views an owner dashboard (writes are blocked). */
export function useReadOnly() {
  return React.useContext(ReadOnlyContext);
}

export function ReadOnlyProvider({ value, children }: { value: boolean; children: React.ReactNode }) {
  return <ReadOnlyContext.Provider value={value}>{children}</ReadOnlyContext.Provider>;
}
