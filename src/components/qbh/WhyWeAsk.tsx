import { Info } from "lucide-react";

type Props = {
  text: string;
};

export default function WhyWeAsk({ text }: Props) {
  return (
    <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-[#F0F2F5] px-2.5 py-1.5">
      <Info size={13} className="mt-px shrink-0" style={{ color: "#7A7F8A" }} />
      <span className="text-xs leading-snug" style={{ color: "#7A7F8A" }}>
        {text}
      </span>
    </div>
  );
}
