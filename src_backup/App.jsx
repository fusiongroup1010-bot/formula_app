import React, { useState } from 'react';
import { AppProvider } from './store';
import Ingredients from './pages/Ingredients';
import PriceList from './pages/PriceList';
import RecipeSolver from './pages/RecipeSolver';
import { Database, FlaskConical, LayoutDashboard, DollarSign } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('recipes');

  return (
    <AppProvider>
      <div className="sidebar animate-fade-in">
        <div className="sidebar-logo">
          <FlaskConical size={28} color="var(--accent-color)" />
          Fusion Formula App
        </div>

        <div
          className={`nav-item ${activeTab === 'recipes' ? 'active' : ''}`}
          onClick={() => setActiveTab('recipes')}
        >
          <LayoutDashboard size={20} />
          Recipe Optimization
        </div>

        <div
          className={`nav-item ${activeTab === 'ingredients' ? 'active' : ''}`}
          onClick={() => setActiveTab('ingredients')}
        >
          <Database size={20} />
          Ingredients Management
        </div>

        <div
          className={`nav-item ${activeTab === 'pricelist' ? 'active' : ''}`}
          onClick={() => setActiveTab('pricelist')}
        >
          <DollarSign size={20} />
          Price List
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'recipes' && <RecipeSolver />}
        {activeTab === 'ingredients' && <Ingredients />}
        {activeTab === 'pricelist' && <PriceList />}
      </div>
    </AppProvider>
  );
}
