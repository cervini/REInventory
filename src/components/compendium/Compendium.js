import React, { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowLeftIcon, DocumentDuplicateIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { db, auth } from '../../firebase';
import { collection, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { useCompendium } from '../../hooks/useCompendium';
import AddItem from '../items/AddItem';
import CompendiumBrowser from './CompendiumBrowser';
import './Compendium.css';

export default function Compendium({ onClose }) {
  const { globalItems, customItems, loading, errors, retry } = useCompendium({ liveGlobal: true });
  const [selectedKey, setSelectedKey] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const [activeTab, setActiveTab] = useState('custom');
  const [itemToCustomize, setItemToCustomize] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const requestInProgress = useRef(false);
  const entries = (activeTab === 'custom' ? customItems : globalItems).map(item => ({ key: `${activeTab}:${item.id}`, item, source: activeTab === 'custom' ? 'Custom' : 'Global' }));
  const selected = entries.find(entry => entry.key === selectedKey);

  const handleAddItem = async itemData => {
    if (!auth.currentUser) return false;
    try {
      await addDoc(collection(db, 'compendiums', auth.currentUser.uid, 'masterItems'), {
        ...itemData,
        id: itemData.id || itemToCustomize?.id,
      });
      toast.success('Custom item saved.');
      return true;
    } catch {
      return false;
    }
  };

  const handleDelete = async () => {
    if (requestInProgress.current || activeTab !== 'custom' || !selected || !auth.currentUser) return;
    requestInProgress.current = true;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteDoc(doc(db, 'compendiums', auth.currentUser.uid, 'masterItems', selected.item.id));
      setSelectedKey(null);
      setConfirmDelete(false);
      toast.success('Custom item deleted.');
    } catch {
      setDeleteError('Could not delete this item. Please try again.');
    } finally {
      requestInProgress.current = false;
      setDeleting(false);
    }
  };

  const changeTab = tab => {
    setActiveTab(tab);
    setSelectedKey(null);
    setConfirmDelete(false);
    setDeleteError('');
  };

  return (
    <div className="compendium">
      <header className="compendium__header">
        <div className="compendium__heading"><button type="button" className="compendium__icon-button" onClick={onClose} disabled={deleting} aria-label="Back to campaigns" title="Back to campaigns"><ArrowLeftIcon aria-hidden="true" /></button><h1 className="compendium__title">Item Compendium</h1></div>
        <button type="button" className="compendium__button compendium__button--primary" disabled={deleting} onClick={() => { setItemToCustomize(null); setShowAddItem(true); }}><PlusIcon aria-hidden="true" />Add custom item</button>
      </header>
      <div className="compendium__tabs" role="tablist" aria-label="Item collections">
        {['custom', 'global'].map(tab => <button type="button" key={tab} id={`compendium-tab-${tab}`} role="tab" aria-selected={activeTab === tab} aria-controls="compendium-panel" tabIndex={activeTab === tab ? 0 : -1} disabled={deleting} onClick={() => changeTab(tab)} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 'custom' : event.key === 'End' ? 'global' : tab === 'custom' ? 'global' : 'custom';
            changeTab(next);
            document.getElementById(`compendium-tab-${next}`)?.focus();
          }
        }}>{tab === 'custom' ? 'My custom items' : 'Global compendium'}<span>{tab === 'custom' ? customItems.length : globalItems.length}</span></button>)}
      </div>
      <div id="compendium-panel" className="compendium__panel" role="tabpanel" aria-labelledby={`compendium-tab-${activeTab}`}>
        <CompendiumBrowser entries={entries} selectedKey={selectedKey} onSelect={entry => { setSelectedKey(entry.key); setConfirmDelete(false); setDeleteError(''); }} isLoading={loading[activeTab]} errors={[errors[activeTab]]} onRetry={retry} disabled={deleting} isViewerDM={true}>
          <div className="compendium__detail-actions">
            <button type="button" className="compendium__button" disabled={deleting} onClick={() => { setItemToCustomize({ ...selected.item, id: crypto.randomUUID() }); setShowAddItem(true); }}><DocumentDuplicateIcon aria-hidden="true" />Create custom version</button>
            {activeTab === 'custom' && !confirmDelete && <button type="button" className="compendium__icon-button compendium__danger" aria-label={`Delete ${selected?.item.name}`} title="Delete custom item" onClick={() => setConfirmDelete(true)}><TrashIcon aria-hidden="true" /></button>}
          </div>
          {activeTab === 'custom' && confirmDelete && <div className="compendium__confirmation"><p>Delete "{selected?.item.name}" from your compendium? Existing inventory copies will stay.</p><div className="compendium__detail-actions"><button type="button" className="compendium__button" disabled={deleting} onClick={() => { setConfirmDelete(false); setDeleteError(''); }}>Keep item</button><button type="button" className="compendium__button compendium__danger" disabled={deleting} onClick={handleDelete}><TrashIcon aria-hidden="true" />{deleting ? 'Deleting...' : 'Delete item'}</button></div></div>}
          {deleteError && <p role="alert" className="compendium-browser__error">{deleteError}</p>}
        </CompendiumBrowser>
      </div>
      {showAddItem && <AddItem onAddItem={handleAddItem} onClose={() => { setShowAddItem(false); setItemToCustomize(null); }} isDM={true} itemToEdit={itemToCustomize ? { item: itemToCustomize } : null} />}
    </div>
  );
}