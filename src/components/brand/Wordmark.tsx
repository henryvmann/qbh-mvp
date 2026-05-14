"use client";

import React from "react";
import { austin } from "./fonts";
import { T, type BrandMode } from "./index";

/**
 * "Quarterback Health" wordmark — Fraunces serif, two-tone (navy +
 * electric). Use in page headers, nav, footers.
 */
export default function Wordmark({
  mode = "light",
  size = 18,
}: {
  mode?: BrandMode;
  size?: number;
}) {
  return (
    <span
      className={austin.className}
      style={{
        fontSize: size,
        fontWeight: 500,
        letterSpacing: -0.2,
        lineHeight: 1,
      }}
    >
      <span style={{ color: mode === "light" ? T.lightText : T.darkText }}>
        Quarterback
      </span>{" "}
      <span style={{ color: T.electric }}>Health</span>
    </span>
  );
}
