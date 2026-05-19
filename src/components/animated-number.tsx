import { useEffect, useState, useRef } from "react";

export function AnimatedNumber({
  value,
  duration = 400,
  formatter = (v: number) => String(v),
}: {
  value: number;
  duration?: number;
  formatter?: (v: number) => string;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);

  useEffect(() => {
    const startValue = prevValueRef.current;
    const endValue = value;
    if (startValue === endValue) return;

    let startTime: number | null = null;
    let animId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      
      // Easing: easeOutQuad
      const easedProgress = progress * (2 - progress);
      const current = startValue + (endValue - startValue) * easedProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animId = requestAnimationFrame(animate);
      } else {
        prevValueRef.current = endValue;
        setDisplayValue(endValue);
      }
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [value, duration]);

  return <>{formatter(displayValue)}</>;
}
