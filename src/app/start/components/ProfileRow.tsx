// src/app/start/components/ProfileRow.tsx

type Props = {
  name: string;
  onChange: (next: string) => void;
  onRemove: () => void;
  placeholder?: string;
};

export function ProfileRow({ name, onChange, onRemove, placeholder }: Props) {
  return (
    <div className="flex items-center gap-2">
      <input
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Name"}
        className="w-full rounded-2xl bg-[#162030] px-4 py-3 text-sm text-[#EFF4FF] placeholder:text-[#3D526B] ring-1 ring-white/8 outline-none focus:ring-2 focus:ring-[#5DE8C5]"
      />
      <button
        type="button"
        onClick={onRemove}
        className="rounded-2xl bg-[#0F1520] px-4 py-3 text-sm text-[#6B85A8] ring-1 ring-white/8 hover:bg-[#162030]"
      >
        Remove
      </button>
    </div>
  );
}
