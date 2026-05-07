export default function Button({ children, className = '', ...rest }) {
  return (
    <button
      type="button"
      className={`rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
