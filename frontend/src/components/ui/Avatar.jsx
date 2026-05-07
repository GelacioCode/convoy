export default function Avatar({ name = '', color = '#3B82F6', size = 32 }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  return (
    <div
      className="inline-flex items-center justify-center rounded-full font-semibold text-white"
      style={{ backgroundColor: color, width: size, height: size }}
    >
      {initial}
    </div>
  );
}
