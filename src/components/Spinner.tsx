export function Spinner({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: "block",
        animation: "none",          // reset any inherited
      }}
    >
      <style>{`
        @keyframes _etl_spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }
        @keyframes _etl_dash {
          0%   { stroke-dashoffset: 0;  }
          50%  { stroke-dashoffset: 30; }
          100% { stroke-dashoffset: 0;  }
        }
        ._etl_ring {
          transform-origin: 24px 24px;
          animation: _etl_spin 0.9s linear infinite;
        }
        ._etl_arc {
          animation: _etl_dash 1.8s ease-in-out infinite;
        }
      `}</style>

      {/* Track */}
      <circle
        cx="24" cy="24" r="20"
        stroke="#86efac"
        strokeWidth="3"
        strokeOpacity="0.3"
      />

      {/* Spinning arc */}
      <g className="_etl_ring">
        <circle
          cx="24" cy="24" r="20"
          stroke="#22c55e"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="60 66"
          strokeDashoffset="0"
          className="_etl_arc"
          style={{ transformOrigin: "24px 24px" }}
        />
      </g>
    </svg>
  );
}