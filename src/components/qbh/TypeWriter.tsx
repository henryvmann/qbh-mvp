"use client";

import { useState, useEffect } from "react";

export default function TypeWriter({
  text,
  speed = 25,
  delay = 0,
}: {
  text: string;
  speed?: number;
  delay?: number;
}) {
  const [displayed, setDisplayed] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setDisplayed("");
    setStarted(false);
    const delayTimer = setTimeout(() => setStarted(true), delay);
    return () => clearTimeout(delayTimer);
  }, [text, delay]);

  useEffect(() => {
    if (!started) return;
    if (displayed.length >= text.length) return;

    const timer = setTimeout(() => {
      setDisplayed(text.slice(0, displayed.length + 1));
    }, speed);

    return () => clearTimeout(timer);
  }, [displayed, text, speed, started]);

  return (
    <>
      {displayed}
      {displayed.length < text.length && (
        <span className="inline-block w-0.5 h-4 bg-[#5C6B5C] animate-pulse ml-0.5 align-text-bottom" />
      )}
    </>
  );
}
