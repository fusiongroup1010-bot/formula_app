import React, { useState } from 'react';
import { AppProvider, useAppContext } from './store';
import Ingredients from './pages/Ingredients';
import PriceList from './pages/PriceList';
import RecipeSolver from './pages/RecipeSolver';
import Login from './pages/Login';
import { Database, LayoutDashboard, DollarSign, LogOut, User } from 'lucide-react';
import logo from './assets/logo.png';

function AppContent() {
  const { currentUser, logout } = useAppContext();
  const [activeTab, setActiveTab] = useState('recipes');

  if (!currentUser) {
    return <Login />;
  }

  return (
    <div style={{ display: 'flex', width: '100%' }}>
      <div className="sidebar animate-fade-in">
        <div className="sidebar-logo" style={{ paddingLeft: 0, justifyContent: 'center', marginBottom: '1rem' }}>
          <img src={logo} alt="Fusion Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
          Fusion Formula
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

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
          <div className="nav-item" style={{ cursor: 'default' }}>
            <User size={20} />
            <span style={{ fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentUser.username}
            </span>
          </div>
          <div className="nav-item" onClick={logout} style={{ color: 'var(--danger-color)' }}>
            <LogOut size={20} />
            Logout
          </div>
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'recipes' && <RecipeSolver />}
        {activeTab === 'ingredients' && <Ingredients />}
        {activeTab === 'pricelist' && <PriceList />}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
