"use client";

import {useCallback, useEffect, useRef, useState} from "react";

export const useInViewOnce = (options) => {
  const [targetNode, setTargetNode] = useState(null);
  const [hasBeenInView, setHasBeenInView] = useState(false);
  const optionsRef = useRef(
    options || {threshold: 0.25, rootMargin: "0px 0px -10% 0px"}
  );
  const targetRef = useCallback((node) => {
    setTargetNode(node);
  }, []);

  useEffect(() => {
    if (hasBeenInView || !targetNode) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setHasBeenInView(true);
        }
      });
    }, optionsRef.current);

    observer.observe(targetNode);

    return () => observer.disconnect();
  }, [hasBeenInView, targetNode]);

  return [targetRef, hasBeenInView];
};
