import React, { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../../firebase';
import { collection, onSnapshot, addDoc, doc, deleteDoc } from 'firebase/firestore';
import AddItem from '../items/AddItem';
import Spinner from '../ui/Spinner';
import ContextMenu from '../ui/ContextMenu';
import { getColorForItemType, itemTypeOptions, generateItemTooltip } from '../../utils/itemUtils';
import './Compendium.css';

const rarityOptions = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

export default function Compendium({ onClose }) {
  const [globalItems, setGlobalItems] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  const [activeTab, setActiveTab] = useState('custom');
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeType, setActiveType] = useState(null);
  const [activeRarity, setActiveRarity] = useState(null);
  const [contextMenu, setContextMenu] = useState({ visible: false, position: null, actions: [] });
  const [itemToCustomize, setItemToCustomize] = useState(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    setIsLoading(true);

    /**
     * Subscribes to real-time updates for both the global compendium and the user's
     * personal custom item collection from Firestore.
     */
    const globalUnsubscribe = onSnapshot(collection(db, 'globalCompendium'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setGlobalItems(items);
    });

    const customUnsubscribe = onSnapshot(collection(db, 'compendiums', currentUser.uid, 'masterItems'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        ...doc.data(),
        docId: doc.id
      }));
      setCustomItems(items);
      setIsLoading(false);
    });

    return () => {
      globalUnsubscribe();
      customUnsubscribe();
    };
  }, [currentUser]);

  const filteredItems = useMemo(() => {
    const sourceItems = activeTab === 'custom' ? customItems : globalItems;
    
    // 2. Apply search and filters to the selected list
    /**
     * Filters the items from the active tab (Custom or Global) based on the
     * current search term and selected type/rarity filters.
     */
    return sourceItems.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const typeMatch = !activeType || item.type === activeType;
      const rarityMatch = !activeRarity || item.rarity === activeRarity;
      return nameMatch && typeMatch && rarityMatch;
    });
  }, [activeTab, customItems, globalItems, searchTerm, activeType, activeRarity]);
  
  /**
   * Handles the right-click event on an item in the "Global Compendium" tab.
   * It displays a context menu with an option to create a customizable version of the selected item.
   * @param {React.MouseEvent} event - The mouse event.
   * @param {object} item - The global item that was right-clicked.
   */
  const handleContextMenu = (event, item) => {
    event.preventDefault();
    // This feature should only work on the "Global Compendium" tab
    if (activeTab !== 'global') return;

    // Prevent the "ghost click" that immediately closes the menu on mobile.
    const preventGhostClick = (e) => {
      e.preventDefault();
      event.currentTarget.removeEventListener('touchend', preventGhostClick);
    };
    event.currentTarget.addEventListener('touchend', preventGhostClick);

    setContextMenu({
      visible: true,
      position: { x: event.clientX, y: event.clientY },
      actions: [
        {
          label: 'Create Custom Version',
          onClick: () => {
            // Set the item to customize and show the AddItem modal
            setItemToCustomize(item);
            setShowAddItem(true);
          },
        },
      ],
    });
  };

  /**
   * Adds a new item to the user's personal custom item compendium in Firestore.
   * @param {object} itemData - The data for the new custom item.
   */
  const handleAddItem = async (itemData) => {
    const customItemsRef = collection(db, 'compendiums', currentUser.uid, 'masterItems');
    try {
      await addDoc(customItemsRef, itemData);
      toast.success("Custom item saved.");
    } catch (error) {
      toast.error("Failed to save custom item.");
    }
  };

  /**
   * Deletes an item from the user's custom item compendium after a confirmation.
   * @param {string} itemId - The ID of the custom item to delete.
   */
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm("Are you sure?")) return;
    
    if (!auth.currentUser) {
      toast.error("You must be logged in to delete items.");
      return;
    }

    try {
      console.log("Attempting to delete item. ID received:", itemId);
      
      if (!itemId || typeof itemId !== 'string') {
          console.error("Invalid itemId passed to delete function:", itemId);
          toast.error("Error: Invalid item ID.");
          return; 
      }

      const itemRef = doc(db, 'compendiums', auth.currentUser.uid, 'masterItems', itemId);
      
      console.log("Target Path:", itemRef.path);

      await deleteDoc(itemRef);
      toast.success("Custom item deleted.");
    } catch (error) {
      toast.error('Failed to delete item from database. Error: ' + error.message);
    }
  };

  /**
   * Renders the list of items based on the current filters and active tab.
   * It displays a loading spinner, a "no items" message, or the grid of item cards.
   * @param {Array<object>} items - The array of items to render.
   * @returns {JSX.Element}
   */
  const renderItemList = (items) => {
    if (isLoading) return <Spinner />;
    if (items.length === 0) {
      return <p className="compendium__empty">No items match your filters.</p>;
    }
    return (
      <div className="compendium__grid">
        {items.map(item => {
          return (
            <div 
              key={item.id} 
              className={`${getColorForItemType(item.type)} compendium__item`}
              onContextMenu={(e) => handleContextMenu(e, item)}
              data-tooltip-id="item-tooltip"
              data-tooltip-html={generateItemTooltip(item, true)}
              data-tooltip-place="top"
            >
              <div className="compendium__item-details">
                <h3 className="compendium__item-name" title={item.name}>{item.name}</h3>
                <p className="compendium__item-meta">{item.w}x{item.h} | {item.weight || 'N/A'}</p>
              </div>
              {activeTab === 'custom' && (
                <button 
                  onClick={() => handleDeleteItem(item.docId)} 
                  className="compendium__delete"
                >
                  Delete
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="compendium">
      {showAddItem && (
        <AddItem 
          onAddItem={handleAddItem} 
          onClose={() => {
            setShowAddItem(false);
            setItemToCustomize(null); // Clear the item when closing
          }} 
          isDM={true}
          itemToEdit={itemToCustomize ? { item: itemToCustomize } : null} 
        />
      )}

      {contextMenu.visible && (
        <ContextMenu
          menuPosition={contextMenu.position}
          actions={contextMenu.actions}
          onClose={() => setContextMenu({ ...contextMenu, visible: false })}
        />
      )}

      <div className="compendium__header">
        <h1 className="compendium__title">Item Compendium</h1>
        <button onClick={onClose} className="compendium__back">
          Back to Campaigns
        </button>
      </div>

      <div className="compendium__tabs">
        <button onClick={() => setActiveTab('custom')} className={`compendium__tab ${activeTab === 'custom' ? 'compendium__tab--active' : ''}`}>
          My Custom Items
        </button>
        <button onClick={() => setActiveTab('global')} className={`compendium__tab ${activeTab === 'global' ? 'compendium__tab--active' : ''}`}>
          Global Compendium
        </button>
        <div className="compendium__tools">
            <button 
                onClick={() => setShowFilters(prev => !prev)} 
                className="compendium__filter-toggle"
                aria-label="Toggle Filters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="compendium__filter-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
              </svg>
            </button>
            <button onClick={() => setShowAddItem(true)} className="compendium__add">
                + Add Custom Item
            </button>
        </div>
      </div>

      {/* Conditionally render the filter section */}
      {showFilters && (
        <div className="compendium__filters">
          <input 
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="compendium__search"
          />
          <div className="compendium__filter-groups">
            <div>
              <span className="compendium__filter-label">Type:</span>
              <button onClick={() => setActiveType(null)} className={`compendium__chip ${!activeType ? 'compendium__chip--active' : ''}`}>All</button>
              {itemTypeOptions.map(opt => (
                <button key={opt.type} onClick={() => setActiveType(opt.type)} className={`compendium__chip compendium__chip--option ${activeType === opt.type ? 'compendium__chip--active' : ''}`}>{opt.type}</button>
              ))}
            </div>
            <div>
              <span className="compendium__filter-label">Rarity:</span>
              <button onClick={() => setActiveRarity(null)} className={`compendium__chip ${!activeRarity ? 'compendium__chip--active' : ''}`}>All</button>
              {rarityOptions.map(rarity => (
                <button key={rarity} onClick={() => setActiveRarity(rarity)} className={`compendium__chip compendium__chip--option ${activeRarity === rarity ? 'compendium__chip--active' : ''}`}>{rarity}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="compendium__results">
        {renderItemList(filteredItems)}
      </div>
    </div>
  );
}