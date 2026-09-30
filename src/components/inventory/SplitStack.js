import React, { useState } from 'react';
import toast from 'react-hot-toast';
import './SplitStack.css';

export default function SplitStack({ item, onClose, onSplit }) {
  // Default split amount is half the stack, rounded down.
  const [splitAmount, setSplitAmount] = useState(Math.floor(item.quantity / 2));

  /**
   * Validates the desired split amount and, if valid, calls the `onSplit`
   * callback with the amount for the new stack.
   */
  const handleSplit = () => {
    const amount = parseInt(splitAmount, 10);
    // Validate the amount
    if (isNaN(amount) || amount <= 0 || amount >= item.quantity) {
      toast.error(`Please enter a number between 1 and ${item.quantity - 1}.`);
      return;
    }
    onSplit(amount);
    onClose();
  };

  return (
    <div className="split-stack">
      <div className="split-stack__panel">
        <h3 className="split-stack__title">Split Stack</h3>
        <div className="split-stack__details">
            <p className="split-stack__detail">
              Item: <span className="split-stack__value">{item.name}</span>
            </p>
            <p className="split-stack__detail">
              Current Quantity: <span className="split-stack__value">{item.quantity}</span>
            </p>
        </div>
        
        <div className="split-stack__field">
            <label className="split-stack__label">Amount for NEW stack:</label>
            <input
              type="number"
              min="1"
              max={item.quantity - 1}
              value={splitAmount}
              onChange={(e) => setSplitAmount(e.target.value)}
              className="split-stack__input"
            />
        </div>

        <div className="split-stack__actions">
            <button type="button" onClick={onClose} className="split-stack__button split-stack__button--cancel">Cancel</button>
            <button type="button" onClick={handleSplit} className="split-stack__button split-stack__button--confirm">Split</button>
        </div>
      </div>
    </div>
  );
}