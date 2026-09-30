import React from 'react';
import './Policy.css';

export default function PrivacyPolicy({ onClose }) {
  return (
    <div className="policy-page">
      <div className="policy-page__header">
        <button onClick={onClose} className="policy-page__back" aria-label="Back to main page">
          <svg xmlns="http://www.w3.org/2000/svg" className="policy-page__back-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="policy-page__title">Privacy Policy</h1>
        <div className="policy-page__spacer"></div> 
      </div>
      <p className="policy-page__date">Last updated: September 29, 2026</p>

      <div className="policy-page__content policy-page__content--compact">
        <p>This Privacy Policy explains how REInventory ("we," "us," and "our") collects, uses, and discloses your information when you use our application.</p>
        
        <h2>1. Information We Collect</h2>
        <p>To provide our service, we collect and store the following information:</p>
        <ul>
          <li><strong>Account Information:</strong> When you sign up, we store your email address and associate it with a unique User ID provided by Firebase Authentication.</li>
          <li><strong>Profile Data:</strong> We store your chosen display name and application preferences, such as your inventory grid size.</li>
          <li><strong>User-Generated Content:</strong> We store all data you create within the application. This includes, but is not limited to, campaigns you create or join, characters you create, all inventory items, containers, and their properties, and your custom item compendium.</li>
          <li><strong>Previous Interaction Data:</strong> Earlier versions stored trade offers between players. Existing records may remain until separately deleted from Firestore.</li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <p>Your information is used exclusively to provide the core functionality of the application. We do not use your data for advertising, marketing, analytics, or profiling.</p>
        <ul>
          <li>Authenticating your account and maintaining your session.</li>
          <li>Saving, retrieving, and displaying your inventory data in real-time.</li>
          <li>Allowing you to collaborate with other users in shared campaigns.</li>
        </ul>

        <h2>3. Data Storage and Security</h2>
        <p>All your data is stored on Google's Firebase platform (Firestore and Realtime Database). We rely on Google's industry-standard security measures to protect your information from unauthorized access.</p>

        <h2>4. Your Rights and Data Control</h2>
        <p>You have full control over your data. At any time, you can:</p>
        <ul>
            <li>Access and update your profile information via the "Profile Settings" menu.</li>
            <li>Modify and delete any campaign, character, or item data you have created.</li>
            <li>Permanently leave a campaign, which will delete your inventory for that campaign.</li>
            <li>Permanently delete your entire account and all associated data using the "Delete My Account" feature in your profile settings. This action is irreversible.</li>
        </ul>

        <h2>5. Contact Us</h2>
        <p>If you have any questions about this Privacy Policy, please contact us at simonecervini99+reinventory@gmail.com.</p>
      </div>
    </div>
  );
}