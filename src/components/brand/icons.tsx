"use client";

import React from "react";

/**
 * Brand icon set — all line-style, 1.8 stroke, sized 18px by default
 * to fit inside an IconTile. Pass `color` (usually T.electric) and
 * optional `size` override.
 */

type IconProps = { color?: string; size?: number };

export function StethoscopeIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v6a5 5 0 0 0 10 0V3" />
      <path d="M5 3h2M13 3h2" />
      <path d="M10 14v3a4 4 0 0 0 8 0v-2" />
      <circle cx={18} cy={11} r={2} />
    </svg>
  );
}

export function LabIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v6.5L4 18a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 18l-5-8.5V3" />
      <line x1={7} y1={3} x2={17} y2={3} />
      <line x1={6.5} y1={14} x2={17.5} y2={14} />
    </svg>
  );
}

export function PillIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2.5} y={8} width={19} height={8} rx={4} transform="rotate(-30 12 12)" />
      <line x1={8} y1={8} x2={14.5} y2={14.5} transform="rotate(-30 12 12)" />
    </svg>
  );
}

export function PhoneIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function UsersIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx={9} cy={7} r={4} />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function DocumentIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1={8} y1={13} x2={16} y2={13} />
      <line x1={8} y1={17} x2={13} y2={17} />
    </svg>
  );
}

export function CardIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={2} y={5} width={20} height={14} rx={2.5} />
      <line x1={2} y1={10} x2={22} y2={10} />
      <line x1={6} y1={15} x2={10} y2={15} />
    </svg>
  );
}

export function BellIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

export function LockIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={4} y={11} width={16} height={10} rx={2} />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function CalendarIcon({ color = "currentColor", size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={3} x2={8} y2={7} />
      <line x1={16} y1={3} x2={16} y2={7} />
    </svg>
  );
}

export function CalendarPlusIcon({ color = "currentColor", size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={5} width={18} height={16} rx={2.5} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={3} x2={8} y2={7} />
      <line x1={16} y1={3} x2={16} y2={7} />
      <line x1={12} y1={13} x2={12} y2={18} />
      <line x1={9.5} y1={15.5} x2={14.5} y2={15.5} />
    </svg>
  );
}

export function CheckIcon({ color = "currentColor", size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 12 10 18 20 6" />
    </svg>
  );
}

export function HomeIcon({ color = "currentColor", size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9z" />
    </svg>
  );
}

export function TimelineIcon({ color = "currentColor", size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <rect x={3} y={4} width={18} height={18} rx={3} />
      <line x1={3} y1={10} x2={21} y2={10} />
      <line x1={8} y1={2} x2={8} y2={6} />
      <line x1={16} y1={2} x2={16} y2={6} />
      <path d="M8 14h2M14 14h2M8 18h2" />
    </svg>
  );
}

export function InsightsIcon({ color = "currentColor", size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <line x1={4} y1={20} x2={4} y2={12} />
      <line x1={10} y1={20} x2={10} y2={6} />
      <line x1={16} y1={20} x2={16} y2={14} />
      <line x1={22} y1={20} x2={22} y2={9} />
    </svg>
  );
}

export function PersonIcon({ color = "currentColor", size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function SparkleIcon({ color = "currentColor", size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M12 2 L13.6 9.6 L21 11.5 L13.6 13.4 L12 21 L10.4 13.4 L3 11.5 L10.4 9.6 Z" />
      <path d="M19 3 L19.7 5.4 L22 6 L19.7 6.6 L19 9 L18.3 6.6 L16 6 L18.3 5.4 Z" opacity={0.7} />
    </svg>
  );
}
