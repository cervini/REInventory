import React from 'react';
import { HeartIcon } from '@heroicons/react/24/outline';
import './BuyMeACoffeeButton.css';

export default function BuyMeACoffeeButton() {
  return (
    <a
      href="https://paypal.me/simonecervini"
      target="_blank"
      rel="noopener noreferrer"
      className="buy-me-a-coffee-button"
    >
      <HeartIcon className="buy-me-a-coffee-button__icon" aria-hidden="true" />
      <span>Support the project</span>
    </a>
  );
}