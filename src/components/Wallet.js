import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useCampaignStore } from '../stores/useCampaignStore';

// --- Helper Component for Custom Arrows ---
const StyledNumberInput = ({ value, onChange, label }) => {
  const handleIncrement = () => onChange(Number(value) + 1);
  const handleDecrement = () => onChange(Math.max(0, Number(value) - 1));

  return (
    <div className="flex items-center justify-between">
      <label className={`font-bold ${label.color}`}>{label.text}</label>
      <div className="relative flex items-center w-24">
        <input 
          type="number" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full pl-3 pr-8 py-1 bg-background border border-surface/50 rounded text-right focus:outline-none focus:border-accent font-sans"
        />
        {/* Custom Arrows Container */}
        <div className="absolute right-1 top-0 bottom-0 flex flex-col justify-center gap-0.5 my-auto h-full py-1">
          <button 
            type="button" 
            onClick={handleIncrement}
            className="text-text-muted hover:text-accent leading-none flex items-center justify-center h-3 w-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
            </svg>
          </button>
          <button 
            type="button" 
            onClick={handleDecrement}
            className="text-text-muted hover:text-accent leading-none flex items-center justify-center h-3 w-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01-.02-1.06z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default function Wallet({ campaignId, inventoryId, currency, canEdit }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { updateCurrency } = useCampaignStore();

  const safeCurrency = currency || { gp: 0, sp: 0, cp: 0 };
  const [values, setValues] = useState(safeCurrency);

  const handleSave = async (e) => {
    e.preventDefault();

    if (values.gp < 0 || values.sp < 0 || values.cp < 0) {
        toast.error("Currency cannot be negative");
        return; 
    }
    setLoading(true);
    try {
      await updateCurrency(campaignId, inventoryId, {
        gp: Number(values.gp),
        sp: Number(values.sp),
        cp: Number(values.cp)
      });
      setIsOpen(false);
      toast.success("Wallet updated");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update wallet");
    } finally {
      setLoading(false);
    }
  };

  // Sync state when modal opens
  const openModal = () => {
    setValues(safeCurrency);
    setIsOpen(true);
  };

  if (!canEdit) {
    return (
      <div className="flex space-x-2 text-xs font-bold text-accent bg-background/50 px-2 py-1 rounded border border-accent/20">
        <span className="text-yellow-500">{safeCurrency.gp} GP</span>
        <span className="text-gray-400">{safeCurrency.sp} SP</span>
        <span className="text-orange-400">{safeCurrency.cp} CP</span>
      </div>
    );
  }

  return (
    <>
      <button 
        onClick={openModal}
        className="flex items-center space-x-2 text-xs font-bold text-accent hover:bg-background/50 px-2 py-1 rounded border border-transparent hover:border-accent/20 transition-colors"
        title="Edit Wallet"
      >
        <span className="text-yellow-500">{safeCurrency.gp} GP</span>
        <span className="text-gray-400">{safeCurrency.sp} SP</span>
        <span className="text-orange-400">{safeCurrency.cp} CP</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="bg-surface border border-accent/20 p-4 rounded-lg shadow-xl w-64" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4 font-fantasy text-accent text-center">Coin Pouch</h3>
            <form onSubmit={handleSave} className="space-y-3">
              
              <StyledNumberInput 
                label={{ text: "Gold (GP)", color: "text-yellow-500" }}
                value={values.gp}
                onChange={(val) => setValues(prev => ({...prev, gp: val}))}
              />
              <StyledNumberInput 
                label={{ text: "Silver (SP)", color: "text-gray-400" }}
                value={values.sp}
                onChange={(val) => setValues(prev => ({...prev, sp: val}))}
              />
              <StyledNumberInput 
                label={{ text: "Copper (CP)", color: "text-orange-400" }}
                value={values.cp}
                onChange={(val) => setValues(prev => ({...prev, cp: val}))}
              />
              
              <div className="flex justify-end gap-2 pt-4">
                <button type="button" onClick={() => setIsOpen(false)} className="px-3 py-1 text-sm rounded hover:bg-white/10 transition-colors text-text-muted">Cancel</button>
                <button type="submit" disabled={loading} className="px-3 py-1 bg-primary text-background font-bold text-sm rounded hover:bg-accent transition-colors">
                  {loading ? '...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}