import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';

// Manage the cached Global Compendium
const getGlobalCompendium = async (forceRefresh = false) => {
    const CACHE_KEY = 'globalCompendiumCache';
    const CACHE_DURATION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

    try {
        const cachedData = localStorage.getItem(CACHE_KEY);
        if (cachedData && !forceRefresh) {
            const { timestamp, items } = JSON.parse(cachedData);
            // If the cache is still fresh, return the cached items
            if (Array.isArray(items) && Date.now() - timestamp >= 0 && Date.now() - timestamp < CACHE_DURATION_MS) {
                console.log("Loaded Global Compendium from cache.");
                return items;
            }
        }
    } catch (error) {
        console.error("Could not read compendium from cache:", error);
    }

    // If cache is empty or stale, fetch from Firestore
    console.log("Fetching Global Compendium from Firestore...");
    const querySnapshot = await getDocs(collection(db, 'globalCompendium'));
    const items = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    // Save the new data and a timestamp to the cache
    try {
        const cachePayload = {
            timestamp: Date.now(),
            items: items,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
    } catch (error) {
        console.error("Could not save compendium to cache:", error);
    }
    
    return items;
};


/**
 * Custom hook that fetches both global (cached) and user-specific
 * custom (real-time) compendium items. It combines these lists and provides a loading state.
 * @returns {{allItems: object[], isLoading: boolean}} An object containing the combined list and the loading state.
 * @property {object[]} allItems - A combined array of custom and global items, with custom items appearing first.
 * @property {boolean} isLoading - True while the initial fetch for items is in progress.
 */
export function useCompendium({ liveGlobal = false } = {}) {
  const [globalItems, setGlobalItems] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [loading, setLoading] = useState({ global: true, custom: true });
  const [errors, setErrors] = useState({ global: '', custom: '' });
  const [retryVersion, setRetryVersion] = useState(0);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    let active = true;
    setGlobalItems([]);
    setCustomItems([]);
    setErrors({ global: '', custom: '' });
    if (!userId) {
      setLoading({ global: false, custom: false });
      setErrors({ global: 'Sign in to browse the compendium.', custom: 'Sign in to browse your items.' });
      return;
    }
    setLoading({ global: true, custom: true });

    let globalUnsubscribe;
    if (liveGlobal) {
      globalUnsubscribe = onSnapshot(collection(db, 'globalCompendium'), snapshot => {
        if (!active) return;
        setGlobalItems(snapshot.docs.map(document => ({ ...document.data(), id: document.id })));
        setLoading(previous => ({ ...previous, global: false }));
      }, () => {
        if (!active) return;
        setErrors(previous => ({ ...previous, global: 'Could not load the global compendium.' }));
        setLoading(previous => ({ ...previous, global: false }));
      });
    } else {
      getGlobalCompendium(retryVersion > 0).then(items => {
        if (active) setGlobalItems(items);
      }).catch(() => {
        if (active) setErrors(previous => ({ ...previous, global: 'Could not load the global compendium.' }));
      }).finally(() => {
        if (active) setLoading(previous => ({ ...previous, global: false }));
      });
    }

    const customUnsubscribe = onSnapshot(collection(db, 'compendiums', userId, 'masterItems'), (snapshot) => {
      if (!active) return;
      const items = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setCustomItems(items);
      setLoading(previous => ({ ...previous, custom: false }));
    }, () => {
      if (!active) return;
      setErrors(previous => ({ ...previous, custom: 'Could not load your custom items.' }));
      setLoading(previous => ({ ...previous, custom: false }));
    });

    return () => {
      active = false;
      globalUnsubscribe?.();
      customUnsubscribe();
    };
  }, [userId, retryVersion, liveGlobal]);

  return {
    allItems: [...customItems, ...globalItems], globalItems, customItems, loading, errors,
    isLoading: loading.global || loading.custom,
    retry: () => setRetryVersion(previous => previous + 1),
  };
}