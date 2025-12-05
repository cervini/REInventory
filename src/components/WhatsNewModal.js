import React from 'react';

// --- CONFIGURATION ---
// To show a new "What's New" message:
// 1. Update the 'version' to a new unique value (e.g., the date).
// 2. Set the 'expiryDate' for when the message should stop appearing.
// 3. Update the 'title' and 'content'.
export const whatsNewConfig = {
  version: '2025-12-05', // Updated version ID
  expiryDate: '2025-12-30', // Show for 2 weeks
  title: "Version 2.11.0: Treasure & Loot Update",
  content: (
    <div className="space-y-4 text-text-base/90 text-sm">
      <p>This update brings some long-awaited features for managing your party's wealth and handling the spoils of war!</p>
      
      <h2 className="text-lg font-fantasy text-accent pt-2">Currency Wallet</h2>
      <p>Every inventory now has a dedicated <strong>Coin Pouch</strong>! You can track Gold (GP), Silver (SP), and Copper (CP) directly from your inventory header. Click on the coins to update your balance.</p>
      
      <h2 className="text-lg font-fantasy text-accent pt-2">The Loot Pile</h2>
      <p>DMs can now add items to a shared <strong>Loot Pile</strong> at the top of the campaign view. It acts as a shared stash where DMs drop items and players can take what they want. DMs can toggle its visibility to "reveal" the loot after a battle!</p>

      <h2 className="text-lg font-fantasy text-accent pt-2">Readable Join Codes</h2>
      <p>No more typing random characters! New campaigns now generate easy-to-read codes (like <em>ancient-red-dragon</em>) to make joining adventures easier for your players.</p>

      <h2 className="text-lg font-fantasy text-accent pt-2">Bug Fixes</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Fixed a critical bug where sending "Equipped" items to another player would duplicate them.</li>
        <li>Improved drag-and-drop interactions around the equipped items tray.</li>
      </ul>
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