/**
 * Brand fonts — Inter for UI, Fraunces standing in for Austin (the
 * paid serif). Loaded once here so every page importing the brand
 * shell shares the same instances and avoids font flicker.
 */

import { Inter, Fraunces } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// SOFT + WONK axes are loaded so consumers can disable the calligraphic
// f/g/k alternates that Fraunces ships with at its default soft/wonky
// settings. We pin "WONK" 0 and "SOFT" 0 on the heading + wordmark to
// get a more conventional serif while keeping Fraunces' overall shape.
export const austin = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  axes: ["SOFT", "WONK"],
});

export const austinNormalAxes = '"WONK" 0, "SOFT" 0';
