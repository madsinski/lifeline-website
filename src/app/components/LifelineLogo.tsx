interface LifelineLogoProps {
  size?: "sm" | "lg";
  className?: string;
  variant?: "default" | "white";
}

// Hybrid logo: small inline SVG mark + real Nunito Sans wordmark
// (extrabold "lifeline" + extralight "health"). The SVG-rendered
// wordmark was producing jagged anti-aliasing at small sizes; real
// web-font text uses the OS's font hinter so it's always crisp.
//
// Font is loaded once in app/layout.tsx as `--font-nunito-sans`.
export default function LifelineLogo({
  size = "sm",
  className = "",
  variant = "default",
}: LifelineLogoProps) {
  const height = size === "lg" ? 60 : 38;
  // Mark is square in the source SVG (viewBox 1211 × 1209).
  const markSize = height;
  // Text sized to match the proportions of the original combined-SVG
  // wordmark (text cap height ≈ 50 % of total logo height; Nunito Sans
  // cap-height ≈ 0.72 em → font-size ≈ 0.72 × height).
  const fontSize = Math.round(height * 0.72);
  const gapToText = Math.round(height * 0.18);
  const markColor = variant === "white" ? "#FFFFFF" : "#10B981";
  const textColor = variant === "white" ? "#FFFFFF" : "#000000";

  return (
    <span
      className={`inline-flex items-end ${className}`}
      style={{ gap: gapToText, lineHeight: 1, fontFamily: "var(--font-nunito-sans), sans-serif" }}
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 1211 1209"
        fill="none"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        <path d="M124.034 704.112V25.0192C124.034 11.2015 135.235 0 149.053 0C162.87 0 174.072 11.2015 174.072 25.0192V704.112C174.072 819.395 202.874 901.263 256.096 954.486C309.319 1007.71 391.188 1036.51 506.47 1036.51H1185.56C1199.38 1036.51 1210.58 1047.71 1210.58 1061.53C1210.58 1075.35 1199.38 1086.55 1185.56 1086.55H506.47C383.474 1086.55 286.634 1055.78 220.718 989.865C154.801 923.948 124.034 827.108 124.034 704.112Z" fill={markColor} />
        <path d="M245.555 704.112V25.0192C245.555 11.2015 256.757 0 270.575 0C284.392 0 295.594 11.2015 295.594 25.0192V704.112C295.594 778.888 314.269 830.375 347.238 863.345C380.207 896.314 431.695 914.989 506.47 914.989H1185.56C1199.38 914.989 1210.58 926.19 1210.58 940.008C1210.58 953.825 1199.38 965.027 1185.56 965.027H506.47C423.982 965.027 357.522 944.386 311.859 898.723C266.196 853.061 245.555 786.601 245.555 704.112Z" fill={markColor} />
        <path d="M367.077 704.112V25.0192C367.077 11.2015 378.279 0 392.097 0C405.914 0 417.116 11.2015 417.116 25.0192V704.112C417.116 738.38 425.664 759.488 438.379 772.203C451.095 784.919 472.202 793.467 506.47 793.467H1185.56C1199.38 793.467 1210.58 804.668 1210.58 818.486C1210.58 832.304 1199.38 843.505 1185.56 843.505H506.47C464.489 843.505 428.41 832.991 403.001 807.582C377.591 782.173 367.077 746.093 367.077 704.112Z" fill={markColor} />
        <path d="M0 703.93L2.4227 25.0191C2.4227 11.2014 13.615 0 27.4213 0C41.2277 0 52.4199 11.2014 52.4199 25.0191L49.9972 703.93C49.9972 819.212 78.8352 948.619 170.44 1040.22C265.543 1135.33 391.341 1158.94 506.529 1158.94H1185.58C1199.39 1158.94 1210.58 1170.15 1210.58 1183.96C1210.58 1197.78 1199.39 1208.98 1185.58 1208.98H506.529C305.722 1208.98 200.952 1141.52 135.09 1075.6C69.2281 1009.69 0 893.226 0 703.93Z" fill={markColor} />
      </svg>
      <span style={{ fontSize, color: textColor, letterSpacing: "-0.01em" }}>
        <span style={{ fontWeight: 800 }}>lifeline</span>
        <span style={{ fontWeight: 200, marginLeft: "0.32em" }}>health</span>
      </span>
    </span>
  );
}
