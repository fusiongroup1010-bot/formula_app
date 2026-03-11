import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Plus, Edit2, Trash2, X, Check, Search } from 'lucide-react';
import { nutrientGroups, allNutrients } from '../constants';

export default function Ingredients() {
    const { ingredients, addIngredient, updateIngredient, deleteIngredient } = useAppContext();
    const [isModalOpen, setModalOpen] = useState(false);
    const [viewingNutrients, setViewingNutrients] = useState(null);
    const [editingIng, setEditingIng] = useState(null);
    const [activeGroup, setActiveGroup] = useState(0);

    const [columnWidths, setColumnWidths] = useState({
        code: 120,
        name: 250,
        group: 150,
        protein: 100,
        fat: 100,
        fiber: 100,
        ash: 100,
        others: 80,
        actions: 100
    });

    const handleResize = (col, e) => {
        const startX = e.pageX;
        const startWidth = columnWidths[col];

        const onMouseMove = (moveE) => {
            const newWidth = Math.max(50, startWidth + (moveE.pageX - startX));
            setColumnWidths(prev => ({ ...prev, [col]: newWidth }));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const defaultNutrients = {};
    allNutrients.forEach(n => defaultNutrients[n.key] = 0);
    const emptyIng = { code: '', name: '', group: '', nutrients: defaultNutrients };

    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState(emptyIng);

    const calculateDerivedNutrients = (nutrients, triggerKey = null) => {
        const newNutrients = { ...nutrients };
        const num = (k) => parseFloat(newNutrients[k]) || 0;

        const sourceKeys = ['Moisture', 'DM', 'Crude_protein', 'Crude_fat', 'Crude_fiber', 'Crude_ash'];

        // Recalculate NFE only when source fields change OR initial load
        if (triggerKey === null || sourceKeys.includes(triggerKey)) {
            const moisture = num('Moisture');
            const protein = num('Crude_protein');
            const fat = num('Crude_fat');
            const fiber = num('Crude_fiber');
            const ash = num('Crude_ash');

            const nfe = Math.max(0, 100 - (moisture + protein + fat + fiber + ash));
            newNutrients['NFE'] = String(Math.round(nfe * 100) / 100);
        }

        // Recalculate Energies when sources OR NFE change OR initial load
        if (triggerKey === null || [...sourceKeys, 'NFE'].includes(triggerKey)) {
            const protein = num('Crude_protein');
            const fat = num('Crude_fat');
            const fiber = num('Crude_fiber');
            const nfe = num('NFE');

            // GE formula from 111.docx: (5.7 * CP) + (9.4 * EE) + (4.11 * Total Carbs)
            // Total Carbs = NFE + Fiber
            const totalCarbs = nfe + fiber;
            const ge = 10 * ((protein * 5.7) + (fat * 9.4) + (totalCarbs * 4.11));
            newNutrients['GE'] = String(Math.round(ge * 100) / 100);

            // ME / Atwater = 10 * [(3.5 * CP) + (8.5 * Fat) + (3.5 * NFE)]
            const me_atwater = 10 * ((protein * 3.5) + (fat * 8.5) + (nfe * 3.5));
            const val = String(Math.round(me_atwater * 100) / 100);
            newNutrients['ME_NRC_06'] = val;
            newNutrients['Atwater_Modified'] = val;
            newNutrients['Energy'] = val;
        }

        return newNutrients;
    };

    const handleOpen = (ing = null) => {
        setEditingIng(ing);
        if (ing) {
            // Merge defined nutrients with all available and convert to strings for the input fields
            const mergedNutrients = { ...defaultNutrients, ...ing.nutrients };
            const stringNutrients = {};
            Object.keys(mergedNutrients).forEach(key => {
                stringNutrients[key] = String(mergedNutrients[key]);
            });
            // Recalculate on open to ensure derived values are up to date
            const recalculated = calculateDerivedNutrients(stringNutrients);
            setFormData({ ...ing, nutrients: recalculated });
        } else {
            const stringDefaultNutrients = {};
            Object.keys(defaultNutrients).forEach(key => {
                stringDefaultNutrients[key] = String(defaultNutrients[key]);
            });
            setFormData({ ...emptyIng, nutrients: stringDefaultNutrients });
        }
        setActiveGroup(0);
        setModalOpen(true);
    };

    const handleSave = () => {
        if (!formData.code || !formData.name) return alert('Ingredient Code and Name are required!');
        // Check duplicate code
        const isCodeChanged = editingIng && formData.code !== editingIng.code;
        if ((!editingIng || isCodeChanged) && ingredients.some(i => i.code === formData.code)) {
            return alert('An ingredient with this code already exists!');
        }

        // Convert all nutrients to numbers before saving
        const finalNutrients = {};
        Object.keys(formData.nutrients).forEach(key => {
            finalNutrients[key] = parseFloat(formData.nutrients[key]) || 0;
        });

        const finalData = { ...formData, nutrients: finalNutrients };

        if (editingIng) updateIngredient(editingIng.code, finalData);
        else addIngredient(finalData);
        setModalOpen(false);
    };

    const handleNutrientChange = (key, value) => {
        let tempNutrients = { ...formData.nutrients, [key]: value };

        const numVal = parseFloat(value) || 0;
        // Sync DM/Moisture
        if (key === 'Moisture') {
            tempNutrients['DM'] = String(Math.round((100 - numVal) * 100) / 100);
        } else if (key === 'DM') {
            tempNutrients['Moisture'] = String(Math.round((100 - numVal) * 100) / 100);
        }

        // Smart calculation: only updates dependent fields
        const newNutrients = calculateDerivedNutrients(tempNutrients, key);

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
                            <th style={{ width: columnWidths.code, position: 'relative' }}>
                                Code
                                <div className="resizer" onMouseDown={(e) => handleResize('code', e)} />
                            </th>
                            <th style={{ width: columnWidths.name, position: 'relative' }}>
                                Name
                                <div className="resizer" onMouseDown={(e) => handleResize('name', e)} />
                            </th>
                            <th style={{ width: columnWidths.group, position: 'relative' }}>
                                Group
                                <div className="resizer" onMouseDown={(e) => handleResize('group', e)} />
                            </th>
                            <th style={{ width: columnWidths.protein, position: 'relative' }}>
                                Protein %
                                <div className="resizer" onMouseDown={(e) => handleResize('protein', e)} />
                            </th>
                            <th style={{ width: columnWidths.fat, position: 'relative' }}>
                                Fat %
                                <div className="resizer" onMouseDown={(e) => handleResize('fat', e)} />
                            </th>
                            <th style={{ width: columnWidths.fiber, position: 'relative' }}>
                                Fiber %
                                <div className="resizer" onMouseDown={(e) => handleResize('fiber', e)} />
                            </th>
                            <th style={{ width: columnWidths.ash, position: 'relative' }}>
                                Ash %
                                <div className="resizer" onMouseDown={(e) => handleResize('ash', e)} />
                            </th>
                            <th style={{ width: columnWidths.others, position: 'relative' }}>
                                Others
                                <div className="resizer" onMouseDown={(e) => handleResize('others', e)} />
                            </th>
                            <th style={{ width: columnWidths.actions, position: 'relative' }}>
                                Actions
                                <div className="resizer" onMouseDown={(e) => handleResize('actions', e)} />
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {ingredients.filter(ing => {
                            if (!searchQuery) return true;
                            const query = searchQuery.toLowerCase();
                            return ing.code.toLowerCase().includes(query) || ing.name.toLowerCase().includes(query);
                        })
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(ing => (
                                <tr key={ing.code}>
                                    <td><span className="badge badge-warning">{ing.code}</span></td>
                                    <td style={{ fontWeight: 500 }}>{ing.name}</td>
                                    <td><span className="badge badge-success">{ing.group}</span></td>
                                    <td>{ing.nutrients.Crude_protein || 0}%</td>
                                    <td>{ing.nutrients.Crude_fat || 0}%</td>
                                    <td>{ing.nutrients.Crude_fiber || 0}%</td>
                                    <td>{ing.nutrients.Crude_ash || 0}%</td>
                                    <td>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}
                                            onClick={() => setViewingNutrients(ing)}
                                        >
                                            View
                                        </button>
                                    </td>
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
                        {/* ... existing modal content ... */}
                        <div className="grid-3">
                            <div className="form-group">
                                <label className="form-label">Ingredient Code</label>
                                <input className="form-input" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} placeholder="e.g. ING01" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ingredient Name</label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Corn Gluten Meal" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Ingredient Group</label>
                                <select className="form-input" value={formData.group} onChange={e => setFormData({ ...formData, group: e.target.value })}>
                                    <option value="">Select Group...</option>
                                    <option value="Protein Plant">Protein Plant</option>
                                    <option value="Protein Animal">Protein Animal</option>
                                    <option value="Starch">Starch</option>
                                    <option value="Fat">Fat</option>
                                    <option value="Fiber">Fiber</option>
                                    <option value="Premix">Premix</option>
                                    <option value="Probiotics">Probiotics</option>
                                    <option value="Additives">Additives</option>
                                    <option value="Axit amin">Axit amin</option>
                                    <option value="Minerals">Minerals</option>
                                    <option value="Enhancers">Enhancers</option>
                                    <option value="Funtional">Funtional</option>
                                    <option value="Antioxidants">Antioxidants</option>
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
                                        type="text"
                                        className="form-input"
                                        value={formData.nutrients[nut.key] === undefined ? '' : formData.nutrients[nut.key]}
                                        onChange={e => {
                                            const val = e.target.value.replace(',', '.');
                                            // Validate if it's a valid number part (digits, one dot, or empty)
                                            if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
                                                handleNutrientChange(nut.key, val);
                                            }
                                        }}
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

            {viewingNutrients && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in" style={{ maxWidth: '800px', minHeight: 'auto' }}>
                        <div className="modal-header">
                            <div>
                                <h3 style={{ margin: 0 }}>Full Nutrition Profile</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{viewingNutrients.name} ({viewingNutrients.code})</p>
                            </div>
                            <button className="close-btn" onClick={() => setViewingNutrients(null)}><X size={24} /></button>
                        </div>

                        <div style={{ maxHeight: '60vh', overflowY: 'auto', marginTop: '1rem' }}>
                            {nutrientGroups.map(group => {
                                const groupItems = group.items.filter(item => viewingNutrients.nutrients[item.key] > 0);
                                if (groupItems.length === 0) return null;
                                return (
                                    <div key={group.name} style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.8rem', color: 'var(--accent-color)' }}>{group.name}</h4>
                                        <div className="grid-3">
                                            {groupItems.map(item => (
                                                <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem', background: 'rgba(0,0,0,0.02)', borderRadius: '4px' }}>
                                                    <span style={{ fontSize: '0.85rem' }}>{item.label}</span>
                                                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{viewingNutrients.nutrients[item.key]} {item.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <button className="btn btn-primary" onClick={() => setViewingNutrients(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                th {
                    position: relative;
                    min-width: 50px;
                }
                .resizer {
                    position: absolute;
                    right: 0;
                    top: 0;
                    height: 100%;
                    width: 5px;
                    cursor: col-resize;
                    z-index: 10;
                }
                .resizer:hover {
                    background: var(--accent-color);
                }
                .data-table {
                    table-layout: fixed;
                }
                .data-table td {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
        </div>
    );
}
