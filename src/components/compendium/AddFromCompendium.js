import React, { useId, useRef, useState } from 'react';
import { PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useCompendium } from '../../hooks/useCompendium';
import useDialog from '../../hooks/useDialog';
import CompendiumBrowser from './CompendiumBrowser';
import './AddFromCompendium.css';

export default function AddFromCompendiumModal({ onClose, onAddItem, players = [], dmId, playerProfiles = {}, user, inventories = {} }) {
    const { globalItems, customItems, isLoading, errors, retry } = useCompendium();
    const isDM = !!user?.uid && user.uid === dmId;
    const targetablePlayers = (isDM ? players : [user?.uid]).filter(playerId => playerId && inventories[playerId]);
    const [targetPlayerId, setTargetPlayerId] = useState(() => targetablePlayers.includes(user?.uid) ? user.uid : targetablePlayers[0] || '');
    const [selectedKey, setSelectedKey] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [source, setSource] = useState('all');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const requestInProgress = useRef(false);
    const newItemId = useRef(null);
    const formId = useId();
    const handleClose = () => { if (!requestInProgress.current) onClose(); };
    const dialogRef = useDialog({ onClose: handleClose, busy: saving });
    const entries = [
        ...customItems.map(item => ({ key: `custom:${item.id}`, item, source: 'Custom' })),
        ...globalItems.map(item => ({ key: `global:${item.id}`, item, source: 'Global' })),
    ].filter(entry => source === 'all' || entry.source.toLowerCase() === source);
    const selected = entries.find(entry => entry.key === selectedKey);

    const handleSelect = entry => {
        setSelectedKey(entry.key);
        setQuantity(entry.item.quantity || 1);
        setError('');
        newItemId.current = null;
    };

    const handleConfirm = async event => {
        event.preventDefault();
        if (requestInProgress.current) return;
        if (!selected || !targetablePlayers.includes(targetPlayerId)) {
            setError('Select an item and an available inventory.');
            return;
        }
        const amount = Number(quantity);
        if (!Number.isSafeInteger(amount) || amount < 1) {
            setError('Quantity must be a positive whole number.');
            return;
        }
        requestInProgress.current = true;
        setSaving(true);
        setError('');
        try {
            if (!newItemId.current) newItemId.current = crypto.randomUUID();
            const result = await onAddItem({ ...selected.item, id: newItemId.current, quantity: amount }, targetPlayerId);
            if (result === false) throw new Error('Item not saved');
            onClose();
        } catch {
            setError('Could not add this item. Your selection has been kept. Please try again.');
        } finally {
            requestInProgress.current = false;
            setSaving(false);
        }
    };

    return (
        <div className="add-from-compendium" onClick={handleClose}>
            <div className="add-from-compendium__dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} aria-busy={saving} tabIndex={-1} onClick={event => event.stopPropagation()}>
                <header className="add-from-compendium__header"><h2 id={`${formId}-title`} className="add-from-compendium__title">Add from Compendium</h2><button type="button" className="compendium__icon-button" onClick={handleClose} disabled={saving} aria-label="Close compendium" title="Close compendium"><XMarkIcon aria-hidden="true" /></button></header>
                <form className="add-from-compendium__form" onSubmit={handleConfirm}>
                    <div className="add-from-compendium__content">
                        <fieldset className="add-from-compendium__fields" disabled={saving}>
                            <label className="add-from-compendium__collection" htmlFor={`${formId}-collection`}>Collection<select id={`${formId}-collection`} className="add-from-compendium__field" value={source} onChange={event => { setSource(event.target.value); setSelectedKey(null); setError(''); newItemId.current = null; }}><option value="all">All items</option><option value="custom">My custom items</option><option value="global">Global compendium</option></select></label>
                            <CompendiumBrowser entries={entries} selectedKey={selectedKey} onSelect={handleSelect} isLoading={isLoading} errors={[errors.custom, errors.global]} onRetry={retry} disabled={saving} isViewerDM={isDM}>
                                <div className="add-from-compendium__destination">
                                    <label htmlFor={`${formId}-quantity`}>Quantity<input id={`${formId}-quantity`} type="number" required min="1" step="1" value={quantity} onChange={event => setQuantity(event.target.value)} className="add-from-compendium__field" /></label>
                                    <label htmlFor={`${formId}-target`}>Add to inventory<select id={`${formId}-target`} required value={targetPlayerId} onChange={event => setTargetPlayerId(event.target.value)} disabled={!isDM} className="add-from-compendium__field">{!targetablePlayers.includes(targetPlayerId) && <option value="">Choose inventory</option>}{targetablePlayers.map(playerId => <option key={playerId} value={playerId}>{inventories[playerId]?.characterName || playerProfiles[playerId]?.displayName || playerId}</option>)}</select></label>
                                </div>
                            </CompendiumBrowser>
                            {!targetablePlayers.length && <p role="alert" className="compendium-browser__error">No available inventories.</p>}
                        </fieldset>
                    </div>
                    {error && <p role="alert" className="add-from-compendium__error">{error}</p>}
                    <footer className="add-from-compendium__actions"><button type="button" className="compendium__button" disabled={saving} onClick={handleClose}>Cancel</button><button type="submit" className="compendium__button compendium__button--primary" disabled={saving || !selected || !targetablePlayers.length}><PlusIcon aria-hidden="true" />{saving ? 'Adding...' : 'Add item'}</button></footer>
                </form>
            </div>
        </div>
    );
}