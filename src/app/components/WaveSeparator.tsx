export default function WaveSeparator({ from = "#ffffff", to = "#ecf0f3" }: { from?: string; to?: string }) {
  return (
    <div className="relative h-16 sm:h-24 -mb-px" style={{ backgroundColor: from }}>
      <svg
        className="absolute bottom-0 w-full h-full"
        viewBox="0 0 1440 96"
        preserveAspectRatio="none"
        fill={to}
      >
        <path d="M0,64 C360,96 720,32 1080,64 C1260,80 1380,48 1440,64 L1440,96 L0,96 Z" />
      </svg>
    </div>
  );
}
