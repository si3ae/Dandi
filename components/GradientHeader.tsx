"use client";

export default function GradientHeader({
  title,
  sub,
  onBack,
}: {
  title: string;
  sub: string;
  onBack?: () => void;
}) {
  return (
    <div className="gh">
      {onBack && (
        <button className="gh-back" onClick={onBack}>
          ←
        </button>
      )}
      <div className="gh-row">
        <div>
          <div className="gh-t">{title}</div>
          <div className="gh-s">{sub}</div>
        </div>
      </div>
    </div>
  );
}
