import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Plus, Edit2, Trash2, X, Check, Search } from 'lucide-react';
import { nutrientGroups, allNutrients } from '../constants';

export default function Ingredients() {
    const { ingredients, addIngredient, updateIngredient, deleteIngredient } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingIng, setEditingIng] = useState(null);
    const [activeGroup, setActiveGroup] = useState(0);

    const defaultNutrients = {};
    allNutrients.forEach(n => defaultNutrients[n.key] = 0);
    const emptyIng = { code: '', name: '', group: '', nutrients: defaultNutrients };

    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState(emptyIng);

    const handleOpen = (ing = null) => {
        setEditingIng(ing);
        if (ing) {
            // Merge defined nutrients with all available to prevent undefined errors
            const mergedNutrients = { ...defaultNutrients, ...ing.nutrients };
            setFormData({ ...ing, nutrients: mergedNutrients });
        } else {
            setFormData(emptyIng);
        }
        setActiveGroup(0);
        setModalOpen(true);
    };

    const handleSave = () => {
        if (!formData.code || !formData.name) return alert('Ingredient Code and Name are required!');
        // Check duplicate code
        if (!editingIng && ingredients.some(i => i.code === formData.code)) {
            return alert('An ingredient with this code already exists!');
        }
        if (editingIng) updateIngredient(formData);
        else addIngredient(formData);
        setModalOpen(false);
    };

    const handleNutrientChange = (key, value) => {
        const numVal = value ? Number(value) : 0;
        const newNutrients = { ...formData.nutrients, [key]: numVal };

        // Auto calculate DM/Moisture
        if (key === 'Moisture') {
            newNutrients['DM'] = 100 - numVal;
        } else if (key === 'DM') {
            newNutrients['Moisture'] = 100 - numVal;
        }

        setFormData({
            ...formData,
            nutrients: newNutrients
        });
    };

    return (
        <div className="animate-fade-in">
            <div className="flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ marginBottom: '0.5rem' }}>Ingredients Database</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage raw materials and comprehensive nutrition profiles.</p>
                </div>
                <button className="btn btn-primary" onClick={() => handleOpen()}>
                    <Plus size={18} /> Add Ingredient
                </button>
            </div>

            <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '0.8rem 1rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                <Search size={18} color="var(--text-secondary)" />
                <input
                    type="text"
                    placeholder="Search by ingredient code or name..."
                    style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', outline: 'none', fontSize: '1rem' }}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                />
            </div>

            <div className="glass-panel table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Name</th>
                            <th>Group</th>
                            <th>Protein %</th>
                            <th>Fat %</th>
                            <th>Fiber %</th>
                            <th>Ash %</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ingredients.filter(ing => {
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            return ing.code.toLowerCase().includes(query) || ing.name.toLowerCase().includes(query);
                        }).map(ing => (
                            <tr key={ing.code}>
                                <td><span className="badge badge-warning">{ing.code}</span></td>
                                <td style={{ fontWeight: 500 }}>{ing.name}</td>
                                <td><span className="badge badge-success">{ing.group}</span></td>
                                <td>{ing.nutrients.Crude_protein || 0}%</td>
                                <td>{ing.nutrients.Crude_fat || 0}%</td>
                                <td>{ing.nutrients.Crude_fiber || 0}%</td>
                                <td>{ing.nutrients.Crude_ash || 0}%</td>
                                <td>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn btn-secondary" style={{ padding: '0.4rem' }} onClick={() => handleOpen(ing)}><Edit2 size={16} /></button>
                                        <button className="btn btn-danger" style={{ padding: '0.4rem' }} onClick={() => deleteIngredient(ing.code)}><Trash2 size={16} /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in">
                        <div className="modal-header">
                            <h3>{editingIng ? 'Edit' : 'Add'} Ingredient</h3>
                            <button className="close-btn" onClick={() => setModalOpen(false)}><X size={24} /></button>
                        </div>

                        <div className="grid-3">
                            <div className="form-group">
                                <label className="form-label">Ingredient Code</label>
                                <input className="form-input" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} disabled={!!editingIng} placeholder="e.g. ING01" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ingredient Name</label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Corn Gluten Meal" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ingredient Group</label>
                                <select className="form-input" value={formData.group} onChange={e => setFormData({ ...formData, group: e.target.value })}>
                                    <option value="">Select Group...</option>
                                    <option value="Grains">Grains</option>
                                    <option value="Protein">Protein Meal</option>
                                    <option value="Plant Protein">Plant Protein</option>
                                    <option value="Fats">Fats & Oils</option>
                                    <option value="Vitamins">Vitamins</option>
                                    <option value="Minerals">Minerals</option>
                                    <option value="Additives">Additives</option>
                                </select>
                            </div>
                        </div>

                        <h4 style={{ margin: '1.5rem 0 1rem', color: 'var(--accent-color)' }}>Nutrition Profile (As-fed)</h4>

                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                            {nutrientGroups.map((group, idx) => (
                                <button
                                    key={group.name}
                                    className={`btn ${activeGroup === idx ? 'btn-primary' : 'btn-secondary'}`}
                                    style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem' }}
                                    onClick={() => setActiveGroup(idx)}
                                >
                                    {group.name}
                                </button>
                            ))}
                        </div>

                        <div className="grid-3" style={{ background: 'rgba(0,0,0,0.05)', padding: '1.5rem', borderRadius: 'var(--border-radius)' }}>
                            {nutrientGroups[activeGroup].items.map(nut => (
                                <div className="form-group" style={{ marginBottom: '0.5rem' }} key={nut.key}>
                                    <label className="form-label">{nut.label} <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>({nut.unit})</span></label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={formData.nutrients[nut.key] === undefined ? '' : formData.nutrients[nut.key]}
                                        onChange={e => handleNutrientChange(nut.key, e.target.value)}
                                    />
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave}><Check size={18} /> Save Ingredient</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
