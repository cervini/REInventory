import React, { useState } from 'react';
import { iconList } from '../../icon-list';
import DynamicIcon from './DynamicIcon';
import './IconPicker.css';

const IconPicker = ({ onSelectIcon, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = iconList.filter(iconName =>
    iconName.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase())
  );

  return (
    <div className="icon-picker" onClick={onClose}>
      <div className="icon-picker__dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="icon-picker__title">Choose an Icon</h3>
        <input
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
              onClick={() => onSelectIcon(iconName)}
              className="icon-picker__option"
              title={iconName.replace(/_/g, ' ')}
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