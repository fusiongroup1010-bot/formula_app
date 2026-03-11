import React, { useState, useMemo } from 'react';
import { useAppContext } from '../store';
import solver from 'javascript-lp-solver';
import * as XLSX from 'xlsx';
import { Calculator, Download, AlertTriangle, CheckCircle, Save, LayoutTemplate, Activity, Sliders, Search, Plus, PieChart, X, Printer, Copy, FilePlus, Edit3, Eye, Trash2, RefreshCw, ArrowLeft } from 'lucide-react';
import { nutrientGroups, aafcoProfiles, allNutrients, formatCurrency } from '../constants';

export default function RecipeSolver() {
    const { ingredients, priceLists, recipes, saveRecipe, deleteRecipe } = useAppContext();
    const availableMonths = Object.keys(priceLists).sort().reverse();
    const defaultMonth = availableMonths[0] || '2026-02';

    const [viewMode, setViewMode] = useState('list');
    const [selectedRecipeId, setSelectedRecipeId] = useState(null);

    const [recipe, setRecipe] = useState({
        name: 'New Formula 01',
        targetWeight: 1000, // kg
        referenceProfile: 'Dog - Growth',
        priceMonth: defaultMonth,
        constraints: JSON.parse(JSON.stringify(aafcoProfiles['Dog - Growth'])),
        manualIngredients: {},
        activeIngredients: {},
        ingredientMin: {},
        ingredientMax: {},
        addedIngredients: []
    });

    const [selectedSearchIng, setSelectedSearchIng] = useState('');
    const [activeTab, setActiveTab] = useState('Settings'); // Settings, Constraints, Results, Nutrients
    const [manualCost, setManualCost] = useState(0);
    const [result, setResult] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, code }

    const handleProfileChange = (e) => {
        const val = e.target.value;
        setRecipe({
            ...recipe,
            referenceProfile: val,
            constraints: JSON.parse(JSON.stringify(aafcoProfiles[val] || {}))
        });
    };

    const currentPrices = useMemo(() => priceLists[recipe.priceMonth] || {}, [priceLists, recipe.priceMonth]);

    const runOptimization = () => {
        const model = {
            optimize: "cost",
            opType: "min",
            constraints: {
                weight: { equal: recipe.targetWeight },
            },
            variables: {},
            ints: {}
        };

        // Add nutrient constraints
        Object.keys(recipe.constraints).forEach(nut => {
            const bound = recipe.constraints[nut];
            if (bound.min !== null && bound.min !== undefined && bound.min !== "") {
                if (!model.constraints[nut]) model.constraints[nut] = {};
                model.constraints[nut].min = (Number(bound.min) / 100) * recipe.targetWeight;
                // Exception: Vitamins/Micro are usually per kg, not %, so we don't divide by 100 IF unit is not %
                const nutInfo = allNutrients.find(n => n.key === nut);
                if (nutInfo && nutInfo.unit !== '%') {
                    model.constraints[nut].min = Number(bound.min) * recipe.targetWeight;
                }
            }
            if (bound.max !== null && bound.max !== undefined && bound.max !== "" && Number(bound.max) > 0) {
                if (!model.constraints[nut]) model.constraints[nut] = {};
                const nutInfo = allNutrients.find(n => n.key === nut);
                if (nutInfo && nutInfo.unit !== '%') {
                    model.constraints[nut].max = Number(bound.max) * recipe.targetWeight;
                } else {
                    model.constraints[nut].max = (Number(bound.max) / 100) * recipe.targetWeight;
                }
            }
        });

        // Populate variables
        ingredients.forEach(ing => {
            if (!(recipe.addedIngredients || []).includes(ing.code)) return;
            if (recipe.activeIngredients?.[ing.code] === false) return;

            const price = currentPrices[ing.code] || 0;
            model.variables[ing.code] = {
                cost: price,
                weight: 1,
            };

            // Inject all nutrients for optimization
            allNutrients.forEach(n => {
                let val = ing.nutrients[n.key] || 0;
                if (n.unit === '%') val = val / 100;
                model.variables[ing.code][n.key] = val;
            });

            // Fixed inclusion or Min/Max constraints
            const forcedPct = recipe.manualIngredients && recipe.manualIngredients[ing.code];
            const minPct = recipe.ingredientMin && recipe.ingredientMin[ing.code];
            const maxPct = recipe.ingredientMax && recipe.ingredientMax[ing.code];

            if (forcedPct !== undefined && forcedPct !== "") {
                const requiredAmount = (forcedPct / 100) * recipe.targetWeight;
                model.constraints[`fixed_${ing.code}`] = { equal: requiredAmount };
                model.variables[ing.code][`fixed_${ing.code}`] = 1;
            } else {
                if (minPct !== undefined && minPct !== "") {
                    model.constraints[`min_${ing.code}`] = { min: (parseFloat(minPct) / 100) * recipe.targetWeight };
                    model.variables[ing.code][`min_${ing.code}`] = 1;
                }
                if (maxPct !== undefined && maxPct !== "") {
                    model.constraints[`max_${ing.code}`] = { max: (parseFloat(maxPct) / 100) * recipe.targetWeight };
                    model.variables[ing.code][`max_${ing.code}`] = 1;
                }
            }
        });

        const res = solver.Solve(model);
        setResult(res);
        setActiveTab('Results');
    };

    const runManualCalculation = (manualIngs, activeIngs, targetWt) => {
        const res = { feasible: true, result: 0, isManual: true };
        let totalCost = 0;
        const ings = manualIngs || recipe.manualIngredients || {};
        const actives = activeIngs || recipe.activeIngredients || {};
        const wt = targetWt !== undefined ? targetWt : recipe.targetWeight;

        Object.keys(ings).forEach(code => {
            if (actives[code] !== false) {
                const percent = ings[code];
                if (percent > 0) {
                    const amt = (percent / 100) * wt;
                    res[code] = amt;
                    const price = currentPrices[code] || 0;
                    totalCost += amt * price;
                }
            }
        });

        res.result = totalCost;
        setResult(res);
        setManualCost(totalCost);
        setActiveTab('Results');
        return totalCost;
    };

    // Calculate actual nutrient values of the result
    const calculatedNutrients = useMemo(() => {
        if (!result || !result.feasible) return {};
        const totals = {};
        allNutrients.forEach(n => totals[n.key] = 0);

        ingredients.forEach(ing => {
            const amt = result[ing.code] || 0;
            if (amt > 0) {
                allNutrients.forEach(n => {
                    totals[n.key] += (ing.nutrients[n.key] || 0) * (amt / recipe.targetWeight);
                });
            }
        });
        return totals;
    }, [result, ingredients, recipe.targetWeight]);

    const exportExcel = () => {
        let currentResult = result;
        if (!currentResult || !currentResult.feasible) {
            let totalCost = 0;
            const res = { feasible: true, result: 0, isManual: true };
            Object.keys(recipe.manualIngredients || {}).forEach(code => {
                if (recipe.activeIngredients?.[code] !== false) {
                    const percent = recipe.manualIngredients[code];
                    if (percent > 0) {
                        const amt = (percent / 100) * recipe.targetWeight;
                        res[code] = amt;
                        const price = currentPrices[code] || 0;
                        totalCost += amt * price;
                    }
                }
            });
            res.result = totalCost;
            currentResult = res;
        }

        const data = [];
        ingredients.forEach(ing => {
            const amt = currentResult[ing.code] || 0;
            if (amt > 0) {
                const price = currentPrices[ing.code] || 0;
                data.push({
                    Code: ing.code,
                    Ingredient: ing.name,
                    Group: ing.group,
                    'Amount (kg)': amt.toFixed(2),
                    'Ratio (%)': ((amt / recipe.targetWeight) * 100).toFixed(2),
                    'Unit Price (VND)': price.toLocaleString('en-US'),
                    'Cost (VND)': Math.round(amt * price).toLocaleString('en-US')
                });
            }
        });

        const totalCost = currentResult.result;
        data.push({ Code: 'TOTAL', Ingredient: '', Group: '', 'Amount (kg)': recipe.targetWeight.toFixed(2), 'Ratio (%)': '100%', 'Unit Price (VND)': '', 'Cost (VND)': Math.round(totalCost).toLocaleString('en-US') });

        const ws1 = XLSX.utils.json_to_sheet(data);

        const tempNutrients = {};
        allNutrients.forEach(n => tempNutrients[n.key] = 0);
        ingredients.forEach(ing => {
            const amt = currentResult[ing.code] || 0;
            if (amt > 0) {
                allNutrients.forEach(n => {
                    tempNutrients[n.key] += (ing.nutrients[n.key] || 0) * (amt / recipe.targetWeight);
                });
            }
        });

        // Nutrients Sheet
        const nutData = allNutrients.map(n => {
            const val = tempNutrients[n.key];
            const bound = recipe.constraints[n.key] || {};
            let status = 'OK';
            if (bound.min && val < parseFloat(bound.min)) status = 'Below Min';
            if (bound.max && val > parseFloat(bound.max)) status = 'Exceeds Max';
            return {
                Nutrient: n.label,
                Unit: n.unit,
                Value: val.toFixed(3),
                Min: bound.min || '-',
                Max: bound.max || '-',
                Status: status
            };
        });
        const ws2 = XLSX.utils.json_to_sheet(nutData);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, "Recipe Composition");
        XLSX.utils.book_append_sheet(wb, ws2, "Nutrient Analytics");
        XLSX.writeFile(wb, `Formula_${recipe.name.replace(/\s+/g, '_')}.xlsx`);
    };

    const exportPDF = () => {
        window.print();
    };

    const handleConstraintChange = (key, type, val) => {
        const updated = { ...recipe.constraints };
        if (!updated[key]) updated[key] = { min: "", max: "" };
        updated[key][type] = val;
        setRecipe({ ...recipe, constraints: updated });
    };

    const addIngredient = () => {
        if (selectedSearchIng && !recipe.addedIngredients?.includes(selectedSearchIng)) {
            const isValid = ingredients.some(i => i.code === selectedSearchIng);
            if (!isValid) return;
            const nextAdded = [...(recipe.addedIngredients || []), selectedSearchIng];
            const nextManual = { ...recipe.manualIngredients, [selectedSearchIng]: 0 };
            const nextActive = { ...recipe.activeIngredients, [selectedSearchIng]: true };
            setRecipe({ ...recipe, addedIngredients: nextAdded, manualIngredients: nextManual, activeIngredients: nextActive });
            setSelectedSearchIng('');
        }
    };

    const removeIngredient = (code) => {
        const nextAdded = (recipe.addedIngredients || []).filter(c => c !== code);
        const nextManual = { ...recipe.manualIngredients };
        delete nextManual[code];
        const nextActive = { ...recipe.activeIngredients };
        delete nextActive[code];
        setRecipe({ ...recipe, addedIngredients: nextAdded, manualIngredients: nextManual, activeIngredients: nextActive });
        runManualCalculation(nextManual, nextActive);
    };

    const sum = Object.keys(recipe.manualIngredients || {}).reduce((a, code) => {
        return recipe.activeIngredients?.[code] !== false ? a + (Number(recipe.manualIngredients[code]) || 0) : a;
    }, 0);
    const displayCost = result && result.feasible ? formatCurrency(result.result) : formatCurrency(manualCost);
    const displayPricePerKg = result && result.feasible ? formatCurrency(result.result / recipe.targetWeight) : formatCurrency(manualCost / recipe.targetWeight);

    const handleSave = () => {
        saveRecipe(recipe);
        alert('Recipe saved successfully!');
    };

    const handleCopy = () => {
        const newRecipe = JSON.parse(JSON.stringify(recipe));
        newRecipe.name = recipe.name + ' (Copy)';
        delete newRecipe.id;
        saveRecipe(newRecipe);
        setRecipe(newRecipe);
        alert('Recipe copied successfully!');
    };

    const handleCreateNew = () => {
        setRecipe({
            name: 'New Formula',
            targetWeight: 1000,
            referenceProfile: 'Dog - Growth',
            priceMonth: defaultMonth,
            constraints: JSON.parse(JSON.stringify(aafcoProfiles['Dog - Growth'])),
            manualIngredients: {},
            activeIngredients: {},
            ingredientMin: {},
            ingredientMax: {},
            addedIngredients: []
        });
        setResult(null);
        setManualCost(0);
        setViewMode('editor');
    };

    const handleEditSelected = () => {
        if (!selectedRecipeId) return;
        const toEdit = recipes.find(r => r.id === selectedRecipeId);
        if (toEdit) {
            setRecipe(JSON.parse(JSON.stringify(toEdit)));
            setResult(null);
            setViewMode('editor');
            runManualCalculation(toEdit.manualIngredients, toEdit.activeIngredients, toEdit.targetWeight);
        }
    };

    const handleCopySelected = () => {
        if (!selectedRecipeId) return;
        const toCopy = recipes.find(r => r.id === selectedRecipeId);
        if (toCopy) {
            const newRecipe = JSON.parse(JSON.stringify(toCopy));
            delete newRecipe.id;
            newRecipe.name = newRecipe.name + ' (Copy)';
            saveRecipe(newRecipe);
        }
    };

    const handleDeleteSelected = () => {
        if (!selectedRecipeId) return;
        if (window.confirm("Are you sure you want to delete this recipe?")) {
            deleteRecipe(selectedRecipeId);
            setSelectedRecipeId(null);
        }
    };

    if (viewMode === 'list') {
        return (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', background: '#fff', color: '#333', overflow: 'hidden', margin: '-2rem', fontFamily: 'Arial, sans-serif' }}>
                <div style={{ display: 'flex', gap: '4px', padding: '8px 16px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                    <button className="btn" style={{ background: 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '4px' }} onClick={handleCreateNew}>
                        <FilePlus size={20} color="#059669" />
                        <span style={{ fontSize: '11px' }}>Create new</span>
                    </button>
                    <button className="btn" style={{ background: 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '4px', opacity: selectedRecipeId ? 1 : 0.5 }} disabled={!selectedRecipeId} onClick={handleCopySelected}>
                        <Copy size={20} color="#4b5563" />
                        <span style={{ fontSize: '11px' }}>Copy</span>
                    </button>
                    <button className="btn" style={{ background: 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '4px', opacity: selectedRecipeId ? 1 : 0.5 }} disabled={!selectedRecipeId} onClick={handleEditSelected}>
                        <Edit3 size={20} color="#d97706" />
                        <span style={{ fontSize: '11px' }}>Edit</span>
                    </button>
                    <button className="btn" style={{ background: 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '4px', opacity: selectedRecipeId ? 1 : 0.5 }} disabled={!selectedRecipeId} onClick={handleDeleteSelected}>
                        <Trash2 size={20} color="#ef4444" />
                        <span style={{ fontSize: '11px' }}>Delete</span>
                    </button>
                    <button className="btn" style={{ background: 'transparent', border: 'none', padding: '4px 12px', borderRadius: '4px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '4px', marginLeft: 'auto' }} onClick={() => { setSelectedRecipeId(null); }}>
                        <RefreshCw size={20} color="#3b82f6" />
                        <span style={{ fontSize: '11px' }}>Refresh</span>
                    </button>
                </div>

                <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead style={{ background: '#f1f5f9', position: 'sticky', top: 0, boxShadow: '0 1px 0 #ccc' }}>
                            <tr>
                                <th style={{ width: '40px', padding: '6px 8px', borderRight: '1px solid #e5e7eb' }}></th>
                                <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Code / Name</th>
                                <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Profile</th>
                                <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Price Month</th>
                                <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Target Weight</th>
                                <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Last Modified</th>
                            </tr>
                        </thead>
                        <tbody>
                            {recipes.map((r, idx) => (
                                <tr key={r.id} style={{ background: selectedRecipeId === r.id ? '#bae6fd' : (idx % 2 === 0 ? '#fff' : '#f8f9fa'), cursor: 'pointer', borderBottom: '1px solid #e5e7eb' }} onClick={() => setSelectedRecipeId(r.id)} onDoubleClick={() => { setSelectedRecipeId(r.id); handleEditSelected(); }}>
                                    <td style={{ padding: '6px 8px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                                        <input type="checkbox" checked={selectedRecipeId === r.id} readOnly style={{ cursor: 'pointer', margin: 0 }} />
                                    </td>
                                    <td style={{ padding: '6px 8px', fontWeight: 'bold', color: '#0f172a', borderRight: '1px solid #e5e7eb' }}>{r.name}</td>
                                    <td style={{ padding: '6px 8px', color: '#475569', borderRight: '1px solid #e5e7eb' }}>{r.referenceProfile}</td>
                                    <td style={{ padding: '6px 8px', color: '#475569', borderRight: '1px solid #e5e7eb' }}>{r.priceMonth}</td>
                                    <td style={{ padding: '6px 8px', color: '#475569', borderRight: '1px solid #e5e7eb' }}>{r.targetWeight} kg</td>
                                    <td style={{ padding: '6px 8px', color: '#475569', borderRight: '1px solid #e5e7eb' }}>{r.lastModified || 'N/A'}</td>
                                </tr>
                            ))}
                            {recipes.length === 0 && (
                                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#9ca3af' }}>No recipes found. Click "Create new" to start.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    return (
        <div className="spreadsheet-layout animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', background: '#fff', color: '#333', overflow: 'hidden', margin: '-2rem', fontFamily: 'Arial, sans-serif' }}>
            {/* Top Summary Header */}
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #d1d5db', fontSize: '12px', display: 'flex', justifyContent: 'space-between', background: '#f8f9fa' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'min-content min-content min-content min-content', gap: '8px 40px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '150px' }}><strong>Total weight:</strong> <span>{recipe.targetWeight.toFixed(3)} kg</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '180px' }}><strong>Price:</strong> <strong>{displayPricePerKg}/kg</strong></div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '150px' }}><strong>Total:</strong> <span style={{ color: sum > 100.001 ? 'red' : 'inherit', fontWeight: sum > 100.001 ? 'bold' : 'normal' }}>{sum.toFixed(3)} %</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '180px' }}><strong>Cost:</strong> <span>{displayCost}</span></div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '150px' }}>
                        <strong>Price list:</strong>
                        <select value={recipe.priceMonth} onChange={e => setRecipe({ ...recipe, priceMonth: e.target.value })} style={{ border: 'none', background: 'transparent', padding: '0', fontSize: '12px', outline: 'none' }}>
                            {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '180px' }}>
                        <strong>Profile:</strong>
                        <select value={recipe.referenceProfile} onChange={handleProfileChange} style={{ border: 'none', background: 'transparent', padding: '0', fontSize: '12px', outline: 'none' }}>
                            {Object.keys(aafcoProfiles).map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '220px' }}><strong>Optimization status:</strong> <span>{result ? (result.feasible ? 'Optimal Solution' : 'Infeasible') : 'Loaded'}</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '160px' }}>
                        <strong>Batch weight:</strong>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input type="number" value={recipe.targetWeight} onChange={e => setRecipe({ ...recipe, targetWeight: Number(e.target.value) })} style={{ border: 'none', borderBottom: '1px solid #ccc', width: '50px', background: 'transparent', textAlign: 'right', fontSize: '12px', outline: 'none' }} />
                            <span style={{ marginLeft: '4px' }}>kg</span>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '350px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', marginBottom: '4px' }}>
                        <ArrowLeft size={16} style={{ cursor: 'pointer', color: '#4b5563' }} onClick={() => setViewMode('list')} title="Back to recipes" />
                        <strong style={{ fontSize: '11px', color: '#666' }}>Name:</strong>
                        <input type="text" value={recipe.name} onChange={e => setRecipe({ ...recipe, name: e.target.value })} style={{ flex: 1, padding: '4px', fontSize: '12px', border: '1px solid #ccc', borderRadius: '4px', minWidth: '100px' }} />
                    </div>
                    <button className="btn" style={{ padding: '6px 10px', fontSize: '12px', background: '#3b82f6', color: '#fff', border: '1px solid #2563eb', cursor: 'pointer', borderRadius: '4px' }} onClick={runOptimization}>Optimize</button>
                    <button className="btn" style={{ padding: '6px 8px', fontSize: '12px', background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer', borderRadius: '4px' }} title="Export to Excel" onClick={exportExcel}><Download size={14} /></button>
                    <button className="btn" style={{ padding: '6px 8px', fontSize: '12px', background: '#e5e7eb', color: '#374151', border: '1px solid #d1d5db', cursor: 'pointer', borderRadius: '4px' }} title="Export to PDF" onClick={exportPDF}><Printer size={14} /></button>
                    <button className="btn" style={{ padding: '6px 8px', fontSize: '12px', background: '#10b981', color: '#fff', border: '1px solid #059669', cursor: 'pointer', borderRadius: '4px' }} title="Save Recipe" onClick={handleSave}><Save size={14} /></button>
                    <button className="btn" style={{ padding: '6px 8px', fontSize: '12px', background: '#f59e0b', color: '#fff', border: '1px solid #d97706', cursor: 'pointer', borderRadius: '4px' }} title="Copy Recipe" onClick={handleCopy}><Copy size={14} /></button>
                </div>
            </div>

            {/* Split View */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                {/* Composition Left */}
                <div style={{ borderRight: '2px solid #ccc', display: 'flex', flexDirection: 'column', minHeight: 0, resize: 'horizontal', overflow: 'hidden', width: '50%', minWidth: '25%', maxWidth: '75%' }}>
                    <div style={{ background: '#e9ecef', padding: '8px 12px', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#495057' }}>
                        Composition
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <input
                                    list="ingredient-search-list"
                                    value={selectedSearchIng}
                                    onChange={e => setSelectedSearchIng(e.target.value)}
                                    placeholder="-- Select Ingredients --"
                                    style={{ padding: '2px 4px', fontSize: '11px', outline: 'none', border: '1px solid #ccc', borderRadius: '2px', width: '200px' }}
                                />
                                <datalist id="ingredient-search-list">
                                    {ingredients.filter(i => !(recipe.addedIngredients || []).includes(i.code)).map(i => (
                                        <option key={i.code} value={i.code}>{i.name}</option>
                                    ))}
                                </datalist>
                            </div>
                            <Plus size={16} onClick={addIngredient} style={{ cursor: 'pointer', color: '#059669', background: '#fff', borderRadius: '50%', padding: '2px' }} />
                        </div>
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, background: '#fff' }}>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'right' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, boxShadow: '0 1px 0 #ccc' }}>
                                <tr>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#495057' }}>Code</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#495057' }}>Description</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 4px', textAlign: 'center', fontWeight: 'bold', color: '#495057' }}>Use</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>%</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Minimum</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Maximum</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(recipe.addedIngredients || []).map((code, idx) => {
                                    const ing = ingredients.find(i => i.code === code);
                                    if (!ing) return null;
                                    const price = currentPrices[ing.code] || 0;
                                    const isUsed = recipe.activeIngredients?.[ing.code] !== false;

                                    let calcPct = recipe.manualIngredients[ing.code] || 0;
                                    if (result && result[ing.code]) {
                                        calcPct = (result[ing.code] / recipe.targetWeight) * 100;
                                    } else {
                                        calcPct = recipe.manualIngredients[ing.code];
                                    }

                                    return (
                                        <tr key={ing.code}
                                            style={{ background: isUsed ? (idx % 2 === 0 ? '#fff' : '#f8f9fa') : '#f1f5f9', opacity: isUsed ? 1 : 0.6, borderBottom: '1px solid #f3f4f6', cursor: 'context-menu' }}
                                            onContextMenu={e => {
                                                e.preventDefault();
                                                setContextMenu({ x: e.clientX, y: e.clientY, code: ing.code });
                                            }}
                                        >
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: '#d97706', fontWeight: 'bold' }}>
                                                {ing.code}
                                            </td>
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>{ing.name}</td>
                                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #e5e7eb' }}>
                                                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                                                    <input type="checkbox" checked={isUsed} onChange={e => {
                                                        const nextActive = { ...recipe.activeIngredients, [ing.code]: e.target.checked };
                                                        let nextManual = { ...recipe.manualIngredients };
                                                        if (e.target.checked) {
                                                            const curSum = Object.keys(nextManual).reduce((acc, c) => (c !== ing.code && nextActive[c] !== false) ? acc + (Number(nextManual[c]) || 0) : acc, 0);
                                                            if (curSum + (Number(nextManual[ing.code]) || 0) > 100) {
                                                                nextManual[ing.code] = Math.max(0, 100 - curSum);
                                                            }
                                                        }
                                                        setRecipe({ ...recipe, activeIngredients: nextActive, manualIngredients: nextManual });
                                                        runManualCalculation(nextManual, nextActive);
                                                    }} style={{ margin: 0, cursor: 'pointer' }} />
                                                </div>
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: isUsed ? '#fff9c4' : 'transparent' }}>
                                                <input type="number" disabled={!isUsed}
                                                    value={recipe.manualIngredients[ing.code] !== undefined ? recipe.manualIngredients[ing.code] : 0}
                                                    onChange={e => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        const curSum = Object.keys(recipe.manualIngredients || {}).reduce((a, c) => {
                                                            if (c === ing.code || recipe.activeIngredients?.[c] === false) return a;
                                                            return a + (Number(recipe.manualIngredients[c]) || 0);
                                                        }, 0);
                                                        let finalVal = val;
                                                        if (curSum + val > 100) {
                                                            finalVal = Math.max(0, 100 - curSum);
                                                        }
                                                        const next = { ...recipe.manualIngredients };
                                                        next[ing.code] = finalVal;
                                                        setRecipe({ ...recipe, manualIngredients: next });
                                                        runManualCalculation(next);
                                                    }}
                                                    style={{ width: '60px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none', color: isUsed ? '#b45309' : '#9ca3af', fontWeight: 'bold' }}
                                                    step="0.001"
                                                    placeholder="0.000"
                                                />
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: (recipe.ingredientMin && recipe.ingredientMin[ing.code]) ? '#fff9c4' : 'transparent' }}>
                                                <input type="number" value={recipe.ingredientMin?.[ing.code] ?? ''} onChange={e => {
                                                    const next = { ...(recipe.ingredientMin || {}) };
                                                    next[ing.code] = e.target.value;
                                                    setRecipe({ ...recipe, ingredientMin: next });
                                                }} style={{ width: '60px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none' }} placeholder="" />
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: (recipe.ingredientMax && recipe.ingredientMax[ing.code]) ? '#fff9c4' : 'transparent' }}>
                                                <input type="number" value={recipe.ingredientMax?.[ing.code] ?? ''} onChange={e => {
                                                    const next = { ...(recipe.ingredientMax || {}) };
                                                    next[ing.code] = e.target.value;
                                                    setRecipe({ ...recipe, ingredientMax: next });
                                                }} style={{ width: '60px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none' }} placeholder="" />
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', color: '#4b5563' }}>{formatCurrency(price)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Analysis Right */}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, minWidth: '30%' }}>
                    <div style={{ background: '#e9ecef', padding: '8px 12px', fontWeight: 'bold', fontSize: '13px', borderBottom: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#495057' }}>
                        Nutrient Analysis
                    </div>
                    <div style={{ overflowY: 'auto', flex: 1, background: '#fff' }}>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'right' }}>
                            <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, boxShadow: '0 1px 0 #ccc' }}>
                                <tr>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#495057' }}>Code</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#495057' }}>Description</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#495057' }}>Type</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Value</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Lower limit</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Upper limit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allNutrients.map((n, idx) => {
                                    const val = calculatedNutrients[n.key];
                                    const bound = recipe.constraints[n.key] || { min: '', max: '' };

                                    let alertMin = false;
                                    let alertMax = false;
                                    if (bound.min && val < parseFloat(bound.min)) alertMin = true;
                                    if (bound.max && val > parseFloat(bound.max)) alertMax = true;
                                    const alert = alertMin || alertMax;

                                    return (
                                        <tr key={n.key} style={{ background: alert ? '#f8d7da' : (idx % 2 === 0 ? '#fff' : '#f8f9fa'), borderBottom: '1px solid #f3f4f6', color: alert ? '#721c24' : 'inherit' }}>
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: alert ? '#721c24' : '#4b5563' }}>FS_{n.key.substring(0, 4).toUpperCase()}</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: alert ? '#721c24' : '#111827' }}>{n.label} <span style={{ opacity: 0.6 }}>({n.unit})</span></td>
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: alert ? '#721c24' : '#6b7280' }}>On product</td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', fontWeight: 'bold', color: alert ? '#721c24' : '#111827' }}>
                                                {val !== undefined && val !== null && !isNaN(val) ? val.toFixed(3) : '-'}
                                                {alertMin && ' ↓'}
                                                {alertMax && ' ↑'}
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: (bound.min !== undefined && bound.min !== null && bound.min !== '') ? '#fdf8f5' : 'transparent' }}>
                                                <input type="number" value={bound.min === null ? '' : bound.min} step="0.01" onChange={e => handleConstraintChange(n.key, 'min', e.target.value)} style={{ width: '50px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none' }} placeholder="" />
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: (bound.max !== undefined && bound.max !== null && bound.max !== '') ? '#fdf8f5' : 'transparent' }}>
                                                <input type="number" value={bound.max === null ? '' : bound.max} step="0.01" onChange={e => handleConstraintChange(n.key, 'max', e.target.value)} style={{ width: '50px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none' }} placeholder="" />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right-click Context Menu */}
            {contextMenu && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 999 }}
                        onClick={() => setContextMenu(null)}
                        onContextMenu={e => { e.preventDefault(); setContextMenu(null); }}
                    />
                    <div style={{
                        position: 'fixed',
                        top: contextMenu.y,
                        left: contextMenu.x,
                        zIndex: 1000,
                        background: '#fff',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                        overflow: 'hidden',
                        minWidth: '180px',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '12px'
                    }}>
                        <div style={{ padding: '6px 12px', background: '#f8f9fa', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 'bold', fontSize: '11px' }}>
                            {ingredients.find(i => i.code === contextMenu.code)?.name || contextMenu.code}
                        </div>
                        <div
                            style={{ padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}
                            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            onClick={() => {
                                removeIngredient(contextMenu.code);
                                setContextMenu(null);
                            }}
                        >
                            <span style={{ fontSize: '14px' }}>🗑</span>
                            Xóa nguyên liệu này
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

