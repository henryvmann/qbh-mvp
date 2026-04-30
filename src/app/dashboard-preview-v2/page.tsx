import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import DashboardV2Mock from "./DashboardV2Mock";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter" });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-source-serif" });

export const metadata: Metadata = {
  title: "QBH — Dashboard Preview v2",
};

export default function DashboardPreviewV2Page() {
  return (
    <div className={`${inter.variable} ${sourceSerif.variable}`}>
      <DashboardV2Mock />
    </div>
  );
}
