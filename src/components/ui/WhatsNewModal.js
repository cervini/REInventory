import React from 'react';
import './WhatsNewModal.css';

// --- CONFIGURATION ---
// To show a new "What's New" message:
// 1. Update the 'version' to a new unique value (e.g., the date).
// 2. Set the 'expiryDate' for when the message should stop appearing.
// 3. Update the 'title' and 'content'.
export const whatsNewConfig = {
  version: '2026-06-11-floating-bags', // Updated for the Floating Bags & Merchant release
  expiryDate: '2026-08-01', // Show through the summer
  title: "Version 2.14.0: Floating Bags!",
  content: (
    <div className="whats-new-modal__content">
      <h2 className="whats-new-modal__heading">Floating Inventory Containers</h2>
      <p>Inventory containers have been completely refactored! They now <strong>float and can be freely moved around</strong> inside your character's inventory for ultimate organization and control.</p>
      <blockquote className="whats-new-modal__tip">
        <strong>Mobile Tip:</strong> If the new floating layout feels cramped on your phone, try switching your device to <strong>landscape mode</strong> to easily view and manage your entire inventory!
      </blockquote>

      <hr className="whats-new-modal__divider" />

      <h2 className="whats-new-modal__heading whats-new-modal__heading--upcoming">🔮 Coming Soon: The Next Generation Overhaul!</h2>
      <p className="whats-new-modal__outlook">
        Over the next few months, work is beginning on a massive system overhaul. The app is going to become <strong>even more customizable, effortless to use, and seamless to manage</strong>. Stay tuned for a whole new level of control over your campaigns!
      </p>
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