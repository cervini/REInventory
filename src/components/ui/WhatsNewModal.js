import React from 'react';
import './WhatsNewModal.css';

// --- CONFIGURATION ---
// To show a new "What's New" message:
// 1. Update the 'version' to a new unique value (e.g., the date).
// 2. Set the 'expiryDate' for when the message should stop appearing.
// 3. Update the 'title' and 'content'.
export const whatsNewConfig = {
  version: '2026-09-30-fantasy-modern-refresh',
  expiryDate: '2026-10-31',
  title: 'Version 3.6.0: A Refreshed Adventure',
  content: (
    <div className="whats-new-modal__content">
      <p>A <strong>fantasy-modern refresh</strong> brings clearer controls, more room for your inventory, and layouts that adapt to smaller screens.</p>

      <h2 className="whats-new-modal__heading">Campaigns &amp; Accounts</h2>
      <p>Refreshed sign-in, signup, password reset, and profile settings. Campaign selection now includes <strong>search and retry controls</strong>, with clearer create and join flows and a redesigned account menu.</p>

      <hr className="whats-new-modal__divider" />

      <h2 className="whats-new-modal__heading">A More Flexible Inventory</h2>
      <p>A roomier character workspace groups your equipment, wallet, and carried weight, while item actions stay in the <strong>top Inventory bar</strong>. Bags now live on an open-ended canvas with <strong>Move and Interact modes</strong>, touch panning, reset view, and automatic bag arrangement.</p>

      <h2 className="whats-new-modal__heading">Loot &amp; Merchants</h2>
      <p>Shared loot and merchant sections have clearer layouts and controls. DMs can <strong>hide the shared loot pile</strong> in campaign layout settings without deleting its contents.</p>

      <hr className="whats-new-modal__divider" />

      <h2 className="whats-new-modal__heading">Character &amp; Item Settings</h2>
      <p>Settings and item forms now scroll while their actions stay visible. Character settings include improved weight-unit handling, bag reordering, and confirmed removals. Item editing and icon selection have clearer fields and <strong>keep your draft when a save fails</strong>.</p>

      <h2 className="whats-new-modal__heading">A Better Compendium</h2>
      <p><strong>Always-visible search, type and rarity filters, item icons, and detailed previews</strong> make browsing easier. Customization and deletion now have direct controls. Add from Compendium includes inventory and quantity selection, waits for saves, and keeps your selection available for retry if adding fails.</p>
    </div>
  ),
};

/**
 * A modal component to display "What's New" information to the user.
 * It's designed to be shown only once per version until an expiry date.
 * @param {object} props - The component props.
 * @param {Function} props.onClose - Callback function to close the modal.
 */
export default function WhatsNewModal({ onClose }) {
  return (
    <div className="whats-new-modal" onClick={onClose}>
      <div 
        className="whats-new-modal__dialog" 
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="whats-new-modal__title">{whatsNewConfig.title}</h3>
        
        <div className="whats-new-modal__body">
          {whatsNewConfig.content}
        </div>

        <div className="whats-new-modal__footer">
          <button 
            type="button" 
            onClick={onClose} 
            className="whats-new-modal__close"
          >
            Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
}