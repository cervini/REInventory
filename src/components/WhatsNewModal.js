import React from 'react';

// --- CONFIGURATION ---
// To show a new "What's New" message:
// 1. Update the 'version' to a new unique value (e.g., the date).
// 2. Set the 'expiryDate' for when the message should stop appearing.
// 3. Update the 'title' and 'content'.
export const whatsNewConfig = {
  version: '2025-12-07', // Updated for the Merchant release
  expiryDate: '2025-12-21', // Show for 2 weeks
  title: "Version 2.13.0: Open for Business!",
  content: (
    <div className="space-y-4 text-text-base/90 text-sm">
      <p>The economy has arrived! This update introduces a full Merchant system, making shopping trips faster and easier than ever.</p>
      
      <h2 className="text-lg font-fantasy text-accent pt-2">Merchants & Shops</h2>
      <p>DMs can now create <strong>Merchant Inventories</strong> (like a Blacksmith or General Store). When players drag an item from a shop to their inventory, the gold cost is automatically deducted from their wallet!</p>
      
      <h2 className="text-lg font-fantasy text-accent pt-2">Loot Pile Upgrades</h2>
      <p>The Loot Pile has been redesigned with a cleaner look. It now clearly shows when it is empty and blends seamlessly into the game board.</p>

      <h2 className="text-lg font-fantasy text-accent pt-2">DM Tools</h2>
      <p>Dungeon Masters have new controls to manage the world economy:</p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Create and Delete Shops on the fly.</li>
        <li>Rename the Loot Pile (e.g., "Dragon's Hoard").</li>
        <li>Toggle Loot Pile visibility for players.</li>
      </ul>

      <h2 className="text-lg font-fantasy text-accent pt-2">Bug Fixes</h2>
      <p>Fixed issues with item duplication when moving equipped gear and improved container interactions for the DM.</p>
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