import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import './CampaignSettings.css';

export default function CampaignSettings({ campaign, onClose }) {
  const [campaignName, setCampaignName] = useState(campaign.name || '');
  const [defaultBackpackSize, setDefaultBackpackSize] = useState({
    width: 10,
    height: 5,
  });
  const [loading, setLoading] = useState(false);

  /**
   * Handles the form submission to update the campaign settings in Firestore.
   * This includes the campaign name and the default backpack size for new characters.
   * @param {React.FormEvent} e - The form submission event.
   */
  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const campaignDocRef = doc(db, 'campaigns', campaign.id);
      await updateDoc(campaignDocRef, {
        name: campaignName,
        defaultBackpackSize: {
          width: Number(defaultBackpackSize.width),
          height: Number(defaultBackpackSize.height),
        },
      });
      toast.success('Campaign settings updated!');
      onClose();
    } catch (error) {
      toast.error('Failed to update campaign settings.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campaign-settings" onClick={onClose}>
      <div className="campaign-settings__dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="campaign-settings__title">Campaign Settings</h3>
        <form onSubmit={handleSave} className="campaign-settings__form">
          <div>
            <label className="campaign-settings__label">Campaign Name</label>
            <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="campaign-settings__input campaign-settings__input--name" />
          </div>
          <div>
            <label className="campaign-settings__label">Default Backpack Size</label>
            <div className="campaign-settings__dimensions">
              <div>
                <label className="campaign-settings__label campaign-settings__label--small">Width</label>
                <input type="number" value={defaultBackpackSize.width} onChange={(e) => setDefaultBackpackSize({ ...defaultBackpackSize, width: e.target.value })} className="campaign-settings__input campaign-settings__input--dimension" />
              </div>
              <div>
                <label className="campaign-settings__label campaign-settings__label--small">Height</label>
                <input type="number" value={defaultBackpackSize.height} onChange={(e) => setDefaultBackpackSize({ ...defaultBackpackSize, height: e.target.value })} className="campaign-settings__input campaign-settings__input--dimension" />
              </div>
            </div>
          </div>
          <div className="campaign-settings__actions">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="campaign-settings__button campaign-settings__button--cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="campaign-settings__button campaign-settings__button--save"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}