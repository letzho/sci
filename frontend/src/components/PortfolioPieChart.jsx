/**
 * SVG donut chart for insurance portfolio — no external chart library.
 */
export default function PortfolioPieChart({ slices = [], size = 160 }) {
  if (!slices.length) {
    return (
      <div className="flex items-center justify-center rounded-xl bg-slate-50 text-xs text-slate-400" style={{ width: size, height: size }}>
        No policies
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.26;
  let cumulative = 0;

  function arcPath(startAngle, endAngle) {
    const start = polar(cx, cy, outerR, endAngle);
    const end = polar(cx, cy, outerR, startAngle);
    const innerStart = polar(cx, cy, innerR, endAngle);
    const innerEnd = polar(cx, cy, innerR, startAngle);
    const large = endAngle - startAngle > 180 ? 1 : 0;
    return [
      `M ${start.x} ${start.y}`,
      `A ${outerR} ${outerR} 0 ${large} 0 ${end.x} ${end.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${innerR} ${innerR} 0 ${large} 1 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ');
  }

  function polar(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  const segments = slices.map((slice) => {
    const angle = (slice.percentage / 100) * 360;
    const startAngle = cumulative;
    cumulative += angle;
    return { ...slice, startAngle, endAngle: cumulative };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {segments.map((seg) => (
          <path
            key={seg.productType}
            d={arcPath(seg.startAngle, seg.endAngle)}
            fill={seg.color}
            stroke="#fff"
            strokeWidth="1.5"
          />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="fill-slate-700" fontSize="11" fontWeight="600">
          {slices.length}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="fill-slate-400" fontSize="8">
          policies
        </text>
      </svg>
      <ul className="space-y-1.5 flex-1 min-w-0">
        {slices.map((sl) => (
          <li key={sl.productType} className="flex items-center gap-2 text-[11px]">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
            <span className="text-slate-700 font-medium truncate flex-1">{sl.label}</span>
            <span className="text-slate-400 shrink-0">{sl.percentage}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
