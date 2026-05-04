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

export const austin = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
