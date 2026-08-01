import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Fades content up as it scrolls in. Purely decorative — content is always in the DOM. */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 },
    );
    io.observe(el);

    // Safety net: an entrance animation must never be able to hide content.
    // If the observer has not fired by now (odd browsers, a scroll container
    // it cannot see, print or screenshot rendering), show it anyway.
    const failsafe = setTimeout(() => {
      setShown(true);
      io.disconnect();
    }, 1500);

    return () => {
      clearTimeout(failsafe);
      io.disconnect();
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className={className}
      style={
        shown
          ? { animation: `fade-up 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms both` }
          : { opacity: 0 }
      }
    >
      {children}
    </div>
  );
}
