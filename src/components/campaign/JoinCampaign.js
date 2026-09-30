import React, { useEffect, useId, useRef, useState } from 'react';
import { ArchiveBoxIcon, ArrowPathIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { db, auth } from '../../firebase';
import { doc, updateDoc, arrayUnion, setDoc, getDoc } from 'firebase/firestore';
import { useStarterPacks } from '../../hooks/useStarterPacks';
import './JoinCampaign.css';

export default function JoinCampaign({ campaignId, onClose, onJoinSuccess, isDMAddingCharacter = false }) {
  const [characterName, setCharacterName] = useState('');
  const [selectedPackId, setSelectedPackId] = useState('none');
  const [loading, setLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [error, setError] = useState('');
  const [characterSaved, setCharacterSaved] = useState(false);
  const dialogRef = useRef(null);
  const nameRef = useRef(null);
  const submitRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const requestInProgress = useRef(false);
  const creationRef = useRef(null);
  const mountedRef = useRef(true);
  const formId = useId();
  const { packs, isLoading: packsLoading, error: packsError, retry: retryPacks } = useStarterPacks();
  const selectedPack = packs.find(pack => pack.id === selectedPackId);
  const packItems = Array.isArray(selectedPack?.items) ? selectedPack.items : [];

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    mountedRef.current = true;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nameRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!requestInProgress.current) onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      const controls = [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      mountedRef.current = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (error && !loading) submitRef.current?.focus();
  }, [error, loading]);

  const handleClose = () => {
    if (!requestInProgress.current) onClose();
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    if (requestInProgress.current) return;
    setNameError('');
    setError('');
    if (!characterName.trim()) {
      setNameError('Enter a character name.');
      nameRef.current?.focus();
      return;
    }
    if (!event.currentTarget.reportValidity()) return;
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError('Sign in again to create your character.');
      return;
    }
    if (!characterSaved && selectedPackId !== 'none' && (packsLoading || !Array.isArray(selectedPack?.items))) {
      setError('This starter pack is unavailable. Choose another pack.');
      return;
    }

    requestInProgress.current = true;
    setLoading(true);
    try {
      const campaignDocRef = doc(db, 'campaigns', campaignId);
      const campaignDoc = await getDoc(campaignDocRef);
      if (!campaignDoc.exists()) {
        setError('This campaign is no longer available.');
        return;
      }
      const campaignData = campaignDoc.data();
      const isDM = campaignData.dmId === currentUser.uid;
      if (isDMAddingCharacter && !isDM) {
        setError('Only the DM can add another character to this campaign.');
        return;
      }
      if (!isDM && campaignData.players?.includes(currentUser.uid) && !creationRef.current) {
        onJoinSuccess(campaignId);
        return;
      }
      if (!creationRef.current) {
        creationRef.current = { id: isDM ? crypto.randomUUID() : currentUser.uid, inventorySaved: false, backpackSaved: false };
      }
      const creation = creationRef.current;
      const defaultBackpackSize = campaignData?.defaultBackpackSize || { width: 10, height: 5 };

      await updateDoc(campaignDocRef, {
        players: arrayUnion(creation.id),
        'layout.order': arrayUnion(creation.id),
        [`layout.visible.${creation.id}`]: true,
      });

      const inventoryDocRef = doc(db, 'campaigns', campaignId, 'inventories', creation.id);
      if (!creation.inventorySaved) {
        const startingItems = selectedPackId === 'none' ? [] : selectedPack.items.map(item => ({
          name: 'Unknown Item',
          w: 1,
          h: 1,
          type: 'Gear',
          stackable: item.quantity > 1,
          ...item,
          id: crypto.randomUUID(),
        }));
        await setDoc(inventoryDocRef, {
          characterName: characterName.trim(),
          ownerId: currentUser.uid,
          trayItems: startingItems,
          totalMaxWeight: isDM ? 150 : 100,
          weightUnit: 'lbs',
          ...(isDM ? { strength: 10, size: 'Medium', useCalculatedWeight: true } : {}),
          currency: { gp: 0, sp: 0, cp: 0 },
        });
        creation.inventorySaved = true;
        if (mountedRef.current) setCharacterSaved(true);
      }

      if (!creation.backpackSaved) {
        await setDoc(doc(inventoryDocRef, 'containers', 'backpack'), {
          name: 'Backpack',
          gridItems: [],
          gridWidth: defaultBackpackSize.width,
          gridHeight: defaultBackpackSize.height,
          trackWeight: true,
        });
        creation.backpackSaved = true;
      }

      if (mountedRef.current) {
        toast.success(isDM ? `Character "${characterName.trim()}" added.` : `Welcome, ${characterName.trim()}!`);
        onJoinSuccess(campaignId);
      }
    } catch (error) {
      console.error('Error creating campaign character:', error);
      if (mountedRef.current) {
        setError(creationRef.current?.inventorySaved
          ? 'Your character was saved, but setup could not finish. Please try again.'
          : error.code === 'permission-denied'
            ? 'You do not have permission to create a character in this campaign.'
            : 'Could not create your character. Please try again.');
      }
    } finally {
      requestInProgress.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="join-campaign" onClick={event => { if (event.target === event.currentTarget) handleClose(); }}>
      <div ref={dialogRef} className="join-campaign__dialog" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} tabIndex={-1} aria-busy={loading}>
        <header className="join-campaign__header">
          <div>
            <h2 className="join-campaign__title" id={`${formId}-title`}>{isDMAddingCharacter ? 'Add character' : 'Join campaign'}</h2>
            <p className="join-campaign__code" aria-label={`Campaign code ${campaignId}`}>{campaignId}</p>
          </div>
          <button type="button" className="join-campaign__close" aria-label="Close character dialog" title="Close" disabled={loading} onClick={handleClose}>
            <XMarkIcon className="join-campaign__icon" aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={handleJoin} className="join-campaign__form" aria-label={isDMAddingCharacter ? 'Add character' : 'Join campaign'} noValidate>
          <div>
            <label className="join-campaign__label" htmlFor={`${formId}-name`}>Character name</label>
            <input
              ref={nameRef}
              id={`${formId}-name`}
              name="characterName"
              type="text"
              autoComplete="off"
              required
              readOnly={loading || characterSaved}
              value={characterName}
              onChange={event => { setCharacterName(event.target.value); setNameError(''); setError(''); }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? `${formId}-name-error` : undefined}
              className="join-campaign__field"
              placeholder="Character name"
            />
            {nameError && <p className="join-campaign__error" id={`${formId}-name-error`} role="alert">{nameError}</p>}
          </div>
          <div>
            <label className="join-campaign__label" htmlFor={`${formId}-pack`}>Starter pack</label>
            <select
              id={`${formId}-pack`}
              value={selectedPackId}
              onChange={event => { setSelectedPackId(event.target.value); setError(''); }}
              disabled={packsLoading || loading || characterSaved}
              className="join-campaign__field"
            >
              <option value="none">No starter pack</option>
              {[...packs].sort((first, second) => (first.name || '').localeCompare(second.name || '')).map(pack => (
                <option key={pack.id} value={pack.id}>{pack.name}</option>
              ))}
            </select>
            {packsLoading && <p className="join-campaign__status" role="status"><ArrowPathIcon className="join-campaign__icon join-campaign__spinner" aria-hidden="true" />Loading starter packs...</p>}
            {!packsLoading && packsError && <div className="join-campaign__pack-error" role="alert"><p>{packsError}</p><button type="button" className="join-campaign__retry" onClick={retryPacks} disabled={loading || characterSaved}><ArrowPathIcon className="join-campaign__icon" aria-hidden="true" />Retry</button></div>}
            {!packsLoading && !packsError && packs.length === 0 && <p className="join-campaign__status">No starter packs available.</p>}
          </div>
          {selectedPack && (
            <section className="join-campaign__pack" aria-label={selectedPack.name}>
              <h3 className="join-campaign__pack-title"><ArchiveBoxIcon className="join-campaign__icon" aria-hidden="true" />{selectedPack.name}</h3>
              {selectedPack.description && <p className="join-campaign__status">{selectedPack.description}</p>}
              {packItems.length > 0 ? <ul className="join-campaign__pack-items" aria-label="Starter pack contents" tabIndex={0}>
                {packItems.map((item, index) => <li key={`${item.id || item.name || 'item'}-${index}`}><span>{item.name || 'Unknown item'}</span><span className="join-campaign__quantity">{item.quantity || 1}</span></li>)}
              </ul> : <p className="join-campaign__status">No items in this pack.</p>}
            </section>
          )}
          {error && <p className="join-campaign__error" role="alert">{error}</p>}
          <div className="join-campaign__actions">
            <button type="button" onClick={handleClose} disabled={loading} className="join-campaign__button join-campaign__button--cancel">Cancel</button>
            <button ref={submitRef} type="submit" disabled={loading || (packsLoading && selectedPackId !== 'none' && !characterSaved)} className="join-campaign__button join-campaign__button--submit">
              {loading ? <ArrowPathIcon className="join-campaign__icon join-campaign__spinner" aria-hidden="true" /> : <UserPlusIcon className="join-campaign__icon" aria-hidden="true" />}
              {loading ? isDMAddingCharacter ? 'Adding character...' : 'Joining...' : characterSaved ? 'Finish setup' : isDMAddingCharacter ? 'Add character' : 'Join campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}