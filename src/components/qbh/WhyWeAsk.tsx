import { Info } from "lucide-react";

type Props = {
  text: string;
};

export default function WhyWeAsk({ text }: Props) {
  return (
    <div className="mt-1 flex items-start gap-1.5">
      <Info size={12} className="mt-px shrink-0" style={{ color: "#B0B4BC" }} />
      <span className="text-[11px] leading-snug" style={{ color: "#B0B4BC" }}>
        {text}
      </span>
    </div>
  );
}
