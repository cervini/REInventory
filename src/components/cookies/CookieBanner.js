import React from 'react';
import './CookieBanner.css';

export default function CookieBanner({ isVisible, onAccept, onShowPolicy }) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="cookie-banner">
      <p className="cookie-banner__message">
        We use essential local storage to manage your login session. 
        <button onClick={onShowPolicy} className="cookie-banner__link">
          Learn More
        </button>.
      </p>
      <button 
        onClick={onAccept}
        className="cookie-banner__accept"
      >
        Okay, I understand
      </button>
    </div>
  );
}