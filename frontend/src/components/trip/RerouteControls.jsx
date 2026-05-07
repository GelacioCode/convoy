export default function RerouteControls({ rerouted, loading, onReroute, onUseMain }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
      <button
        type="button"
        onClick={onReroute}
        disabled={loading}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-wait disabled:opacity-50"
      >
        {loading ? (
          'Calculating route…'
        ) : (
          <>
            <span aria-hidden>🔄</span>
            <span>{rerouted ? 'Reroute again' : 'Reroute from here'}</span>
          </>
        )}
      </button>
      {rerouted && !loading && (
        <button
          type="button"
          onClick={onUseMain}
          className="mt-1 w-full rounded-lg px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-100"
        >
          Switch back to main route
        </button>
      )}
    </div>
  );
}
