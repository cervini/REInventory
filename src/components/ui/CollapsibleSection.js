import React, { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/solid';
import styles from './CollapsibleSection.module.scss';

/**
 * A reusable component that creates a collapsible section with a title.
 * The section can be toggled open or closed by clicking the header.
 * @param {object} props - The component props.
 * @param {string} props.title - The title to display in the section header.
 * @param {React.ReactNode} props.children - The content to be displayed inside the collapsible area.
 * @param {boolean} [props.defaultOpen=false] - Whether the section should be open by default.
 * @returns {JSX.Element}
 */
const CollapsibleSection = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={styles.section}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={styles.header}
      >
        <span>{title}</span>
        <ChevronDownIcon
          className={`${styles.icon} ${isOpen ? styles.open : ''}`}
        />
      </button>
      {isOpen && <div className={styles.content}>{children}</div>}
    </div>
  );
};

export default CollapsibleSection;