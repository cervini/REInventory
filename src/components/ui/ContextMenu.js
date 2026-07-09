import React, { useState, useRef } from 'react';
import styles from './ContextMenu.module.scss';

export default function ContextMenu({ menuPosition, actions, onClose }) {
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const closeTimer = useRef(null);

  if (!menuPosition) return null;

  const menuStyle = {
    top: `${menuPosition.y}px`,
    left: `${menuPosition.x}px`,
  };

  /**
   * Handles the mouse entering a menu item. If the item has a submenu,
   * it sets that submenu as active, making it visible.
   * @param {number} index - The index of the action item being hovered over.
   */
  const handleMouseEnter = (index) => {
    // If there's a pending timer to close a submenu, cancel it
    clearTimeout(closeTimer.current);
    if (actions[index].submenu) {
      setActiveSubmenu(index);
    }
  };

  /**
   * Handles the mouse leaving the main context menu area. It sets a short
   * timer to close any active submenu, giving the user a moment to move their
   * cursor from the main menu to the submenu without it disappearing.
   */
  const handleMouseLeave = () => {
    // Set a short timer to close the submenu, giving the user time to move their cursor
    closeTimer.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 200); // 200 milliseconds delay
  };


  return (
    <>
      <div 
        className={styles.overlay} 
        onClick={onClose} 
        onContextMenu={(e) => { e.preventDefault(); onClose(); }}
      />
      
      <div
        style={menuStyle}
        className={styles.menu}
        onMouseLeave={handleMouseLeave} // Close submenu when leaving the entire menu area
      >
        <ul>
          {actions.map((action, index) => (
            <li 
              key={index} 
              className={styles.menuItem}
              onMouseEnter={() => handleMouseEnter(index)}
            >
              <button
                onClick={() => {
                  if (!action.submenu) {
                    action.onClick();
                    onClose();
                  }
                }}
                className={styles.actionButton}
              >
                <span>{action.label}</span>
                {action.submenu && <span>&raquo;</span>}
              </button>

              {/* The Submenu */}
              {action.submenu && activeSubmenu === index && (
                <div 
                  className={styles.submenu}
                  // Also manage hover state on the submenu itself to keep it open
                  onMouseEnter={() => clearTimeout(closeTimer.current)}
                >
                  <ul>
                    {action.submenu.map((subAction, subIndex) => (
                      <li key={subIndex}>
                        <button
                          onClick={() => {
                            subAction.onClick();
                            onClose();
                          }}
                          className={styles.actionButton}
                        >
                          {subAction.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}