// src/app/start/components/HouseholdOptionCard.tsx

type Props = {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
};

export function HouseholdOptionCard({ title, description, selected, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full text-left rounded-2xl bg-[#0F1520] p-5 ring-1 transition",
        selected ? "ring-[#5DE8C5] ring-2" : "ring-white/8 hover:ring-white/15",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[#EFF4FF]">{title}</div>
          <div className="mt-1 text-sm text-[#6B85A8]">{description}</div>
        </div>

        <div
          className={[
            "mt-1 h-5 w-5 rounded-full ring-1 grid place-items-center",
            selected ? "bg-[#5DE8C5] ring-[#5DE8C5]" : "bg-[#162030] ring-white/15",
          ].join(" ")}
          aria-hidden
        >
          {selected ? <div className="h-2 w-2 rounded-full bg-[#080C14]" /> : null}
        </div>
      </div>
    </button>
  );
}
