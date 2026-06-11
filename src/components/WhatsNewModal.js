import React from 'react';

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
    <div className="space-y-4 text-text-base/90 text-sm">
      <h2 className="text-lg font-fantasy text-accent pt-2">Floating Inventory Containers</h2>
      <p>Inventory containers have been completely refactored! They now <strong>float and can be freely moved around</strong> inside your character's inventory for ultimate organization and control.</p>
      <blockquote className="border-l-2 border-accent/40 pl-3 italic text-text-base/70 text-xs">
        <strong>Mobile Tip:</strong> If the new floating layout feels cramped on your phone, try switching your device to <strong>landscape mode</strong> to easily view and manage your entire inventory!
      </blockquote>

      <hr className="border-accent/10 my-4" />

      <h2 className="text-lg font-fantasy text-primary pt-1">🔮 Coming Soon: The Next Generation Overhaul!</h2>
      <p className="text-text-base/80">
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
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="bg-gradient-to-b from-surface to-background border border-accent/20 p-6 rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-2xl font-bold mb-4 font-fantasy text-accent text-center">{whatsNewConfig.title}</h3>
        
        <div className="flex-grow overflow-auto pr-2">
          {whatsNewConfig.content}
        </div>

        <div className="flex justify-end pt-6">
          <button 
            type="button" 
            onClick={onClose} 
            className="bg-primary hover:bg-accent hover:text-background text-text-base font-bold py-2 px-4 rounded transition-colors duration-200"
          >
            Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
}