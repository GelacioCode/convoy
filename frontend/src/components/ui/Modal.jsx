export default function Modal({ open, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="rounded-xl bg-white p-6 shadow-xl">{children}</div>
    </div>
  );
}
