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
        "w-full text-left rounded-2xl bg-white/5 p-5 ring-1 transition",
        selected ? "ring-[#7BA59A] ring-2" : "ring-white/8 hover:ring-white/15",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-[#F0F2F5]">{title}</div>
          <div className="mt-1 text-sm text-[#8A9BAE]">{description}</div>
        </div>

        <div
          className={[
            "mt-1 h-5 w-5 rounded-full ring-1 grid place-items-center",
            selected ? "bg-[#7BA59A] ring-[#7BA59A]" : "bg-[#162030] ring-white/15",
          ].join(" ")}
          aria-hidden
        >
          {selected ? <div className="h-2 w-2 rounded-full bg-[#1E2228]" /> : null}
        </div>
      </div>
    </button>
  );
}
