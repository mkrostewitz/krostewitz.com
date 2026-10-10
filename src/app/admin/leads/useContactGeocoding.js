"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {formatAddress, geocodeAddress, hasAddressCoordinates} from "../../lib/leadAddress.mjs";

export default function useContactGeocoding(contact, setContact) {
  const pending = useRef(null);
  const [failure, setFailure] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const address = contact.address;
  const query = address ? formatAddress(address) : "";
  const located = hasAddressCoordinates(address);

  const resolveAddress = useCallback((value) => {
    if (!value || !formatAddress(value) || hasAddressCoordinates(value)) return Promise.resolve(value);
    const key = formatAddress(value);
    if (pending.current?.key === key) return pending.current.promise;
    pending.current?.controller.abort();
    const controller = new AbortController();
    const promise = geocodeAddress(value, {
      token: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    });
    pending.current = {key, controller, promise};
    return promise;
  }, []);

  useEffect(() => {
    if (!query || located) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      void resolveAddress(address).then((resolved) => {
        if (cancelled) return;
        setContact((current) => formatAddress(current.address || {}) === query
          ? {...current, address: resolved} : current);
      }).catch((error) => {
        if (!cancelled) setFailure({query, attempt, message: error.name === "TimeoutError" ? "Address lookup timed out. Please retry." : error.message});
      });
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      pending.current?.controller.abort();
      pending.current = null;
    };
  }, [address, query, located, attempt, resolveAddress, setContact]);

  const prepareContact = async (value) => {
    try {
      const resolved = await resolveAddress(value.address);
      return resolved ? {...value, address: resolved} : value;
    } catch (error) {
      if (error.name === "AbortError") throw error;
      setFailure({query: formatAddress(value.address || {}), attempt, message: error.name === "TimeoutError" ? "Address lookup timed out. Please retry." : error.message});
      return value;
    }
  };

  function retry() {
    pending.current?.controller.abort();
    pending.current = null;
    setAttempt((current) => current + 1);
  }

  const message = query && !located ? (failure?.query === query && failure?.attempt === attempt ? failure.message : "Locating address…") : "";
  return {message, prepareContact, retry, needsGeocoding: Boolean(query && !located)};
}
