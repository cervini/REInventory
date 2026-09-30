import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';

/**
 * A custom hook to fetch all available starter packs from the 'starterPacks'
 * collection in Firestore. This fetch is performed once when the hook is mounted.
 *
 * @returns {{packs: object[], isLoading: boolean, error: string, retry: Function}} Starter packs and their fetch state.
 * @property {object[]} packs - An array of starter pack objects after they have been fetched.
 * @property {boolean} isLoading - True while the starter packs are being fetched.
 */
export function useStarterPacks() {
    const [packs, setPacks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        const fetchPacks = async () => {
            setIsLoading(true);
            setError('');
            try {
                const querySnapshot = await getDocs(collection(db, 'starterPacks'));
                const packList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (active) setPacks(packList);
            } catch (error) {
                console.error("Error fetching starter packs:", error);
                if (active) setError('Could not load starter packs.');
            } finally {
                if (active) setIsLoading(false);
            }
        };

        fetchPacks();
        return () => { active = false; };
    }, [attempt]);

    return { packs, isLoading, error, retry: () => setAttempt(value => value + 1) };
}