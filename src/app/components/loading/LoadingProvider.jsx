"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import LoadingSpinner from "./LoadingSpinner";
import styles from "./loading-provider.module.css";

const DEFAULT_LOADING_ID = "global";
const DEFAULT_LOADING_LABEL = "Loading";
const DEFAULT_LOADING_TYPE = "page";
const LoadingContext = createContext(null);

function normalizeLoadingState(input = {}) {
  const label = String(input.label || DEFAULT_LOADING_LABEL).trim();
  const type = String(input.type || DEFAULT_LOADING_TYPE).trim();

  return {
    label: label || DEFAULT_LOADING_LABEL,
    type: type || DEFAULT_LOADING_TYPE,
  };
}

export function LoadingProvider({children}) {
  const [loaders, setLoaders] = useState({});
  const sequenceRef = useRef(0);

  const showLoading = useCallback((input = {}) => {
    const id = String(input.id || DEFAULT_LOADING_ID);
    const nextLoading = normalizeLoadingState(input);

    setLoaders((current) => ({
      ...current,
      [id]: {
        ...nextLoading,
        id,
        sequence: (sequenceRef.current += 1),
      },
    }));
  }, []);

  const hideLoading = useCallback((id = DEFAULT_LOADING_ID) => {
    const loaderId = String(id || DEFAULT_LOADING_ID);

    setLoaders((current) => {
      if (!current[loaderId]) return current;

      const next = {...current};
      delete next[loaderId];
      return next;
    });
  }, []);

  const setLoading = useCallback(
    (input = {}) => {
      const id = String(input.id || DEFAULT_LOADING_ID);
      const isLoading = Boolean(input.isLoading ?? input.state);

      if (isLoading) {
        showLoading({...input, id});
      } else {
        hideLoading(id);
      }
    },
    [hideLoading, showLoading]
  );

  const loadingState = useMemo(() => {
    const activeLoaders = Object.values(loaders);

    if (activeLoaders.length === 0) {
      return {
        isLoading: false,
        label: DEFAULT_LOADING_LABEL,
        type: DEFAULT_LOADING_TYPE,
      };
    }

    const activeLoader = activeLoaders.reduce((latest, loader) =>
      loader.sequence > latest.sequence ? loader : latest
    );

    return {
      isLoading: true,
      label: activeLoader.label,
      type: activeLoader.type,
    };
  }, [loaders]);

  const value = useMemo(
    () => ({
      clearLoading: hideLoading,
      hideLoading,
      loadingState,
      setLoading,
      showLoading,
    }),
    [hideLoading, loadingState, setLoading, showLoading]
  );

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {loadingState.isLoading && (
        <div
          className={styles.viewport}
          data-loading-type={loadingState.type}
          role="presentation"
        >
          <div className={styles.panel}>
            <LoadingSpinner
              label={loadingState.label}
              size={loadingState.type === "action" ? "medium" : "large"}
            />
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);

  if (!context) {
    throw new Error("useLoading must be used within LoadingProvider.");
  }

  return context;
}

export function useLoadingState({isLoading, label, type = DEFAULT_LOADING_TYPE}) {
  const {setLoading} = useLoading();
  const loadingId = useId();

  useEffect(() => {
    setLoading({
      id: loadingId,
      isLoading,
      label,
      type,
    });

    return () => {
      setLoading({id: loadingId, isLoading: false});
    };
  }, [isLoading, label, loadingId, setLoading, type]);
}
