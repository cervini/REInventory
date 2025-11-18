# REInventory

*A modern, visual inventory management system for tabletop RPGs*

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Available-brightgreen)](https://re-inventory-v2.web.app/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosted-orange)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/React-19+-blue)](https://reactjs.org/)

## Overview

REInventory transforms tedious inventory management into an engaging, visual experience for tabletop RPG players and Dungeon Masters. Drawing inspiration from classic video game inventory systems, it provides an intuitive drag-and-drop interface that makes organizing loot as satisfying as finding it.

This tool is perfect for **D&D 5e** and other TTRPG systems, whether you're playing online with platforms like Roll20 and Discord, or using digital tools to enhance in-person sessions.

![Demo GIF](./files/demo2.gif)

## Key Features

- **Visual Grid Inventory:** Organize items on a customizable, Tetris-style grid. The smart placement system automatically finds available slots.
- **Intuitive Drag & Drop:** Effortlessly manage your inventory with a smooth, responsive drag-and-drop interface, complete with collision detection to prevent item overlap.
- **Real-Time Multiplayer:** Share a campaign with your party using a unique join code. All inventory changes, including item transfers between players, are synchronized in real-time.
- **Advanced Item Management:** Create detailed custom items, split item stacks, duplicate items as a DM, and use a temporary item tray for easy sorting.
- **Rich Item Details:** Define items with types, rarity, weight, cost, icon and detailed descriptions. Track weapon stats, attunement, and more with hover-over tooltips.
- **Item Compendium:** Speed up game prep by adding items from a global database or building your own library of frequently used custom items.
- **Modern, Responsive UI:** A clean interface that works beautifully on desktop and mobile devices, with context menus for quick actions.

## How It Works

### For Players & Dungeon Masters

1.  **Visit the App:** Go to **[re-inventory-v2.web.app](https://re-inventory-v2.web.app/)**.
2.  **Create a Campaign (DMs):** As a DM, create a new campaign to receive a unique join code to share with your players.
3.  **Join a Campaign (Players):** As a player, use the join code to enter the campaign.
4.  **Manage Inventory:** Everyone gets their own inventory grid. DMs can view and manage all player inventories, distribute loot, and create custom items for the party.

## Progressive Web App (PWA)

For a native app-like experience, you can install REInventory on your device's home screen. This provides faster loading, a full-screen interface, and better offline access.

#### **On Android (with Chrome)**
1.  Open the site and tap the **menu (⋮)**.
2.  Select **"Install app"** or **"Add to Home screen"**.

#### **On iOS (with Safari)**
1.  Open the site and tap the **Share** icon (a square with an arrow).
2.  Scroll down and select **"Add to Home Screen"**.

## Technical Stack

- **Frontend:** React 19
- **Backend & Hosting:** Firebase (Firestore, Authentication, Hosting)
- **Drag & Drop:** @dnd-kit
- **Styling:** Tailwind CSS
- **Notifications:** React Hot Toast

The application is built with real-time data synchronization using Firestore, offline capabilities through local state management, and a touch-friendly, accessible interface.

## Contributing

We welcome contributions from the TTRPG community! Whether you're fixing bugs, adding features, or improving documentation, your help is appreciated. Please check the [issues](https://github.com/Cervini/REInventory/issues) for tasks.

For detailed instructions on how to contribute, please read our **[CONTRIBUTING.md](CONTRIBUTING.md)**.

### Quick Development Setup
```bash
# Clone the repository
git clone https://github.com/Cervini/REInventory.git
cd REInventory

# Install dependencies
npm install

# Start development server
npm start
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Live Application**: [re-inventory-v2.web.app](https://re-inventory-v2.web.app/)
- **GitHub Repository**: [github.com/Cervini/REInventory](https://github.com/Cervini/REInventory)
- **Bug Reports**: [GitHub Issues](https://github.com/Cervini/REInventory/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/Cervini/REInventory/discussions)

## Support & Community

- **Found a bug?** Please [open an issue](https://github.com/Cervini/REInventory/issues) on GitHub
- **Have a feature idea?** We'd love to hear it in our [discussions](https://github.com/Cervini/REInventory/discussions)

---

**Made with 🍬🍬🍬 by [Simone Cervini](https://github.com/Cervini)**