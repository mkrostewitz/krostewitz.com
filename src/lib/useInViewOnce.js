"use client";

import {useEffect, useRef, useState} from "react";

export const useInViewOnce = (options) => {
  const targetRef = useRef(null);
  const [hasBeenInView, setHasBeenInView] = useState(false);
  const optionsRef = useRef(
    options || {threshold: 0.25, rootMargin: "0px 0px -10% 0px"}
  );

  useEffect(() => {
    if (hasBeenInView) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setHasBeenInView(true);
        }
      });
    }, optionsRef.current);

    if (targetRef.current) observer.observe(targetRef.current);

    return () => observer.disconnect();
  }, [hasBeenInView]);

  return [targetRef, hasBeenInView];
};
