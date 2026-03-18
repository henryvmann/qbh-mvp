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
        "w-full text-left rounded-2xl bg-white p-5 shadow-sm ring-1 transition",
        selected ? "ring-[#8B9D83] ring-2" : "ring-black/5 hover:ring-black/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-neutral-900">{title}</div>
          <div className="mt-1 text-sm text-neutral-600">{description}</div>
        </div>

        <div
          className={[
            "mt-1 h-5 w-5 rounded-full ring-1 grid place-items-center",
            selected ? "bg-[#8B9D83] ring-[#8B9D83]" : "bg-white ring-black/15",
          ].join(" ")}
          aria-hidden
        >
          {selected ? <div className="h-2 w-2 rounded-full bg-white" /> : null}
        </div>
      </div>
    </button>
  );
}