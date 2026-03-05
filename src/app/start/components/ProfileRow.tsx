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
        className="w-full rounded-2xl bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm ring-1 ring-black/5 outline-none focus:ring-2 focus:ring-[#8B9D83]"
      />
      <button
        type="button"
        onClick={onRemove}
        className="rounded-2xl bg-white px-4 py-3 text-sm text-neutral-700 shadow-sm ring-1 ring-black/5 hover:bg-white/90"
      >
        Remove
      </button>
    </div>
  );
}