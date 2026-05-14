/**
 * Brand fonts — Inter for UI, Lora standing in for Austin (the paid
 * serif). Loaded once here so every page importing the brand shell
 * shares the same instances and avoids font flicker.
 *
 * We tried Fraunces first; its calligraphic lowercase f looked
 * italic-by-mistake even at WONK=0 / SOFT=0. Lora keeps the warm
 * editorial feel without the wonky letterforms.
 */

import { Inter, Lora } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const austin = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
