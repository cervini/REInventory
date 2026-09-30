import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useCampaignStore } from '../../stores/useCampaignStore';
import './Wallet.css';

// --- Helper Component for Custom Arrows ---
const StyledNumberInput = ({ value, onChange, label }) => {
  const handleIncrement = () => onChange(Number(value) + 1);
  const handleDecrement = () => onChange(Math.max(0, Number(value) - 1));

  return (
    <div className="wallet__row">
      <label className={`wallet__label ${label.color}`}>{label.text}</label>
      <div className="wallet__number">
        <input 
          type="number" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="wallet__input"
        />
        {/* Custom Arrows Container */}
        <div className="wallet__steppers">
          <button 
            type="button" 
            onClick={handleIncrement}
            className="wallet__step"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="wallet__step-icon">
              <path fillRule="evenodd" d="M14.77 12.79a.75.75 0 01-1.06-.02L10 8.832 6.29 12.77a.75.75 0 11-1.08-1.04l4.25-4.5a.75.75 0 011.08 0l4.25 4.5a.75.75 0 01-.02 1.06z" clipRule="evenodd" />
            </svg>
          </button>
          <button 
            type="button" 
            onClick={handleDecrement}
            className="wallet__step"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="wallet__step-icon">
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
      <div className="wallet__summary wallet__summary--readonly">
        <span className="wallet__coin--gold">{safeCurrency.gp} GP</span>
        <span className="wallet__coin--silver">{safeCurrency.sp} SP</span>
        <span className="wallet__coin--copper">{safeCurrency.cp} CP</span>
      </div>
    );
  }

  return (
    <>
      <button 
        onClick={openModal}
        className="wallet__summary wallet__summary--editable"
        title="Edit Wallet"
      >
        <span className="wallet__coin--gold">{safeCurrency.gp} GP</span>
        <span className="wallet__coin--silver">{safeCurrency.sp} SP</span>
        <span className="wallet__coin--copper">{safeCurrency.cp} CP</span>
      </button>

      {isOpen && (
        <div className="wallet__overlay" onClick={() => setIsOpen(false)}>
          <div className="wallet__dialog" onClick={e => e.stopPropagation()}>
            <h3 className="wallet__title">Coin Pouch</h3>
            <form onSubmit={handleSave} className="wallet__form">
              
              <StyledNumberInput 
                label={{ text: "Gold (GP)", color: "wallet__coin--gold" }}
                value={values.gp}
                onChange={(val) => setValues(prev => ({...prev, gp: val}))}
              />
              <StyledNumberInput 
                label={{ text: "Silver (SP)", color: "wallet__coin--silver" }}
                value={values.sp}
                onChange={(val) => setValues(prev => ({...prev, sp: val}))}
              />
              <StyledNumberInput 
                label={{ text: "Copper (CP)", color: "wallet__coin--copper" }}
                value={values.cp}
                onChange={(val) => setValues(prev => ({...prev, cp: val}))}
              />
              
              <div className="wallet__actions">
                <button type="button" onClick={() => setIsOpen(false)} className="wallet__action wallet__action--cancel">Cancel</button>
                <button type="submit" disabled={loading} className="wallet__action wallet__action--save">
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