import React, { useId, useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import useDialog from '../../hooks/useDialog';
import { iconList } from '../../icon-list';
import DynamicIcon from './DynamicIcon';
import './IconPicker.css';

const IconPicker = ({ onSelectIcon, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const formId = useId();
  const dialogRef = useDialog({ onClose });

  const filteredIcons = iconList.filter(iconName =>
    iconName.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="icon-picker" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="icon-picker__dialog" role="dialog" aria-modal="true" aria-labelledby={`${formId}-title`} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="icon-picker__header"><h2 id={`${formId}-title`} className="icon-picker__title">Choose an Icon</h2><button type="button" onClick={onClose} className="icon-picker__close" aria-label="Close icon picker" title="Close"><XMarkIcon aria-hidden="true" /></button></div>
        <input
          data-dialog-autofocus
          aria-label="Search icons"
          type="text"
          placeholder="Search icons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="icon-picker__search"
          autoFocus
        />
        <div className="icon-picker__grid">
          {filteredIcons.map((iconName) => (
            <button
              key={iconName}
              type="button"
              onClick={() => onSelectIcon(iconName)}
              className="icon-picker__option"
              title={iconName.replace(/_/g, ' ')}
              aria-label={iconName.replace(/_/g, ' ')}
            >
              <DynamicIcon iconName={iconName} className="icon-picker__icon" />
            </button>
          ))}
        </div>
        <div className="icon-picker__footer">
          <button type="button" onClick={onClose} className="icon-picker__cancel">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconPicker;