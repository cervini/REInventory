import React from 'react';

export default function CookiePolicy({ onClose }) {
  return (
    <div className="w-full max-w-2xl mx-auto bg-surface p-8 rounded-lg shadow-lg border border-accent/20 text-text-muted">
      <div className="flex justify-between items-center mb-4">
        <button onClick={onClose} className="p-2 rounded-full hover:bg-background transition-colors duration-200" aria-label="Back to main page">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-text-base" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-3xl font-fantasy text-accent">Cookie Policy</h1>
        <div className="w-10"></div> 
      </div>
      <p className="text-sm mb-4">Last updated: August 16, 2025</p>

      <div className="space-y-4 text-text-base/90">
        <p>This policy explains how REInventory ("we," "us," and "our") uses cookies and similar local storage technologies. By using our application, you consent to the use of these technologies as described below.</p>
        
        <h2 className="text-xl font-fantasy text-accent pt-2">What are Cookies and Local Storage?</h2>
        <p>Cookies are small data files placed on your device. We use modern browser technologies like <strong>Local Storage</strong> and <strong>IndexedDB</strong> which serve a similar purpose, allowing us to store small amounts of information directly in your browser to make the application function correctly.</p>

        <h2 className="text-xl font-fantasy text-accent pt-2">How We Use These Technologies</h2>
        <p>We use these technologies for essential, functional purposes only. We **do not** use them for advertising, analytics, or tracking.</p>
        <ul className="list-disc list-inside pl-4 space-y-1">
          <li><strong>Authentication:</strong> When you sign in, Google Firebase Authentication uses <strong>IndexedDB</strong> to create a secure session and keep you logged in. This is strictly necessary for the application to work.</li>
          <li><strong>Cookie Consent:</strong> To remember your choice about this policy, we use <strong>Local Storage</strong> to store a simple "true" value once you accept. This prevents us from showing you the banner on every visit.</li>
        </ul>

        <h2 className="text-xl font-fantasy text-accent pt-2">How to Control Your Data</h2>
        <p>You have full control over the data stored in your browser. You can clear your browser's site data at any time through your browser's settings. Please note that clearing this data will log you out of the application and will reset your cookie consent choice.</p>
      </div>
    </div>
  );
}