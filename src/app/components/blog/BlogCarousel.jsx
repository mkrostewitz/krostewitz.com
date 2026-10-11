"use client";

import {Children, cloneElement, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import styles from "./blog-section.module.css";

export default function BlogCarousel({children}) {
  const {t} = useTranslation();
  const viewport = useRef(null);
  const group = useRef(null);
  const [paused, setPaused] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const cards = Children.toArray(children);
  const loops = cards.length > 1;

  useEffect(() => {
    if (!loops || paused || interacting) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame;
    let previous;
    let position = viewport.current.scrollLeft;
    function tick(time) {
      const element = viewport.current;
      const width = group.current.offsetWidth;
      if (previous && !motion.matches && !document.hidden && width) {
        position += Math.min(time - previous, 50) * 0.025;
        position %= width;
        element.scrollLeft = position;
      }
      previous = time;
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [loops, paused, interacting]);

  function move(direction) {
    setPaused(true);
    const element = viewport.current;
    const width = group.current.offsetWidth;
    if (loops && direction < 0 && element.scrollLeft < 1) element.scrollLeft = width;
    if (loops && direction > 0 && element.scrollLeft >= width) element.scrollLeft -= width;
    element.scrollBy({left: direction * (group.current.firstElementChild.offsetWidth + 16),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth"});
  }

  return <div className={styles.carousel} role="region" aria-roledescription="carousel" aria-label={t("blog.title")}>
    {loops && <div className={styles.carouselControls}>
      <button type="button" onClick={() => move(-1)} aria-label={t("blog.previous")}>←</button>
      <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>{t(paused ? "blog.play" : "blog.pause")}</button>
      <button type="button" onClick={() => move(1)} aria-label={t("blog.next")}>→</button>
    </div>}
    <div ref={viewport} className={styles.carouselViewport}
      onMouseEnter={() => setInteracting(true)} onMouseLeave={() => setInteracting(false)}
      onFocusCapture={() => setPaused(true)} onTouchStart={() => setPaused(true)}
      onWheel={() => setPaused(true)}>
      <div className={styles.carouselTrack}>
        <div ref={group} className={styles.carouselGroup}>{cards}</div>
        {loops && <div className={styles.carouselGroup} aria-hidden="true">
          {cards.map((card) => cloneElement(card, {tabIndex: -1, prefetch: false}))}
        </div>}
      </div>
    </div>
  </div>;
}
