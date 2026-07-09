import React from 'react';
import { icons } from '../../assets/icons';
import { QuestionMarkCircleIcon } from '@heroicons/react/24/solid';

const DynamicIcon = ({ iconName, className }) => {
  if (!iconName) {
    return null;
  }
  
  // Look up the icon component from our central `icons` object
  const IconComponent = icons[iconName];

  if (!IconComponent) {
    // This can happen if an icon name is saved that no longer exists.
    // We'll return a placeholder to avoid breaking the UI.
    console.error(`Custom icon not found: ${iconName}`);
    return <QuestionMarkCircleIcon className={className} />;
  }

  return (
    <IconComponent
      className={className}
      width="100%"
      height="100%"
      style={{}}
    />
  );
};

export default DynamicIcon;