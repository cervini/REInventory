import React, { useState } from 'react';
import { iconList } from '../../icon-list';
import DynamicIcon from './DynamicIcon';
import styles from './IconPicker.module.scss';

const IconPicker = ({ onSelectIcon, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = iconList.filter(iconName =>
    iconName.toLowerCase().replace(/_/g, ' ').includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Choose an Icon</h3>
        <input
          type="text"
          placeholder="Search icons..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className={styles.searchInput}
          autoFocus
        />
        <div className={styles.grid}>
          {filteredIcons.map((iconName) => (
            <button
              key={iconName}
              onClick={() => onSelectIcon(iconName)}
              className={styles.iconButton}
              title={iconName.replace(/_/g, ' ')}
            >
              <DynamicIcon iconName={iconName} />
            </button>
          ))}
        </div>
        <div className={styles.footer}>
          <button type="button" onClick={onClose} className={styles.cancelButton}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default IconPicker;