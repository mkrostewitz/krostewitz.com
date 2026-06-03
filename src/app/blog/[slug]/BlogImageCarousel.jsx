"use client";

/* eslint-disable @next/next/no-img-element */

import {ChevronLeft, ChevronRight} from "lucide-react";
import {useMemo, useState} from "react";

import styles from "./blog-post.module.css";

function getMediaIdentity(media, index) {
  return media?.key || media?.url || `image-${index}`;
}

function getImageAlt(media, index) {
  const fileName = String(media?.fileName || "").replace(/\.[^.]+$/, "").trim();
  return fileName || `Post image ${index + 1}`;
}

export default function BlogImageCarousel({images = []}) {
  const carouselImages = useMemo(
    () => images.filter((image) => image?.type === "image" && image.url),
    [images]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const hasMultipleImages = carouselImages.length > 1;

  if (carouselImages.length === 0) return null;

  function showPrevious() {
    setSelectedIndex((current) =>
      current === 0 ? carouselImages.length - 1 : current - 1
    );
  }

  function showNext() {
    setSelectedIndex((current) =>
      current === carouselImages.length - 1 ? 0 : current + 1
    );
  }

  function handleKeyDown(event) {
    if (!hasMultipleImages) return;

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      showNext();
    }
  }

  return (
    <section
      aria-label="Post image carousel"
      className={styles.carousel}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.carouselViewport}>
        <div
          className={styles.carouselTrack}
          style={{transform: `translateX(-${selectedIndex * 100}%)`}}
        >
          {carouselImages.map((media, index) => (
            <figure
              aria-hidden={index === selectedIndex ? undefined : "true"}
              className={styles.carouselSlide}
              key={getMediaIdentity(media, index)}
            >
              <img
                alt={getImageAlt(media, index)}
                className={styles.carouselImage}
                loading={index === 0 ? undefined : "lazy"}
                src={media.url}
              />
            </figure>
          ))}
        </div>

        {hasMultipleImages && (
          <>
            <button
              aria-label="Previous image"
              className={`${styles.carouselControl} ${styles.carouselControlPrevious}`}
              type="button"
              onClick={showPrevious}
            >
              <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.4} />
            </button>
            <button
              aria-label="Next image"
              className={`${styles.carouselControl} ${styles.carouselControlNext}`}
              type="button"
              onClick={showNext}
            >
              <ChevronRight aria-hidden="true" size={20} strokeWidth={2.4} />
            </button>
            <span className={styles.carouselCounter}>
              {selectedIndex + 1} / {carouselImages.length}
            </span>
          </>
        )}
      </div>

      {hasMultipleImages && (
        <div className={styles.carouselThumbnails} aria-label="Choose image">
          {carouselImages.map((media, index) => {
            const isSelected = index === selectedIndex;

            return (
              <button
                aria-current={isSelected ? "true" : undefined}
                aria-label={`Show image ${index + 1}`}
                className={`${styles.carouselThumb} ${
                  isSelected ? styles.carouselThumbActive : ""
                }`}
                key={getMediaIdentity(media, index)}
                type="button"
                onClick={() => setSelectedIndex(index)}
              >
                <img
                  alt=""
                  className={styles.carouselThumbImage}
                  loading="lazy"
                  src={media.url}
                />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
