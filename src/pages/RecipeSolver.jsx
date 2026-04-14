import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../store';
import solver from 'javascript-lp-solver';
import * as XLSX from 'xlsx';
import { Calculator, Download, AlertTriangle, CheckCircle, Save, LayoutTemplate, Activity, Sliders, Search, Plus, PieChart, X, Printer, Copy, FilePlus, Edit3, Eye, Trash2, RefreshCw, ArrowLeft } from 'lucide-react';
import { nutrientGroups, aafcoProfiles, allNutrients, formatCurrency } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoSrc from '../assets/logo.png';

export default function RecipeSolver() {
    const { ingredients, priceLists, recipes, saveRecipe, deleteRecipe, currentUser } = useAppContext();
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
        addedIngredients: [],
        remarks: ''
    });

    const [selectedSearchIng, setSelectedSearchIng] = useState('');
    const [activeTab, setActiveTab] = useState('Settings');
    const [manualCost, setManualCost] = useState(0);
    const [result, setResult] = useState(null);
    const [contextMenu, setContextMenu] = useState(null); // { x, y, code }
    const [localPctValues, setLocalPctValues] = useState({}); // raw string while typing
    
    // Nutrition Display System States
    const [nutDisplayMode, setNutDisplayMode] = useState('as-fed'); // 'as-fed', 'dm', 'reference'
    const [refDMValue, setRefDMValue] = useState(90); // default 90%
    const [selectedNutrientKey, setSelectedNutrientKey] = useState(null);

    const handleProfileChange = (e) => {
        const val = e.target.value;
        setRecipe({
            ...recipe,
            referenceProfile: val,
            constraints: JSON.parse(JSON.stringify(aafcoProfiles[val] || {}))
        });
    };

    const currentPrices = useMemo(() => priceLists[recipe.priceMonth] || {}, [priceLists, recipe.priceMonth]);

    // Recalculate cost whenever price month changes (avoids stale closure in manualCost)
    useEffect(() => {
        if (!result || !result.isManual) return; // only for manual recipes, optimizer handles its own cost
        if (!recipe.manualIngredients || Object.keys(recipe.manualIngredients).length === 0) return;
        let totalCost = 0;
        Object.keys(recipe.manualIngredients).forEach(code => {
            // Only calculate cost for ingredients that are actively added to the recipe
            if (!(recipe.addedIngredients || []).includes(code)) return;
            if (!ingredients.some(i => i.code === code)) return;
            
            if (recipe.activeIngredients?.[code] !== false) {
                const percent = Number(recipe.manualIngredients[code]) || 0;
                if (percent > 0) {
                    const amt = (percent / 100) * recipe.targetWeight;
                    const price = currentPrices[code] || 0;
                    totalCost += amt * price;
                }
            }
        });
        setManualCost(totalCost);
    }, [currentPrices]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const getPct = (code, mIngs = recipe.manualIngredients) => {
        if (result && result.feasible && !result.isManual && result[code] !== undefined) {
            return (result[code] / recipe.targetWeight) * 100;
        }
        return mIngs[code] || 0;
    };


    const runManualCalculation = (manualIngs, activeIngs, targetWt, skipBalance = false, priceMonthOverride = null, addedIngs = null) => {
        const res = { feasible: true, result: 0, isManual: true };
        let totalCost = 0;
        let ings = manualIngs || { ...recipe.manualIngredients } || {};
        const actives = activeIngs || recipe.activeIngredients || {};
        const wt = targetWt !== undefined ? targetWt : recipe.targetWeight;
        const currentAdded = addedIngs || recipe.addedIngredients || [];

        // Auto-balance logic: Set the ingredient with the highest % to (100 - sum of others)
        if (!skipBalance) {
            let maxCode = null;
            let maxVal = -1;
            let sumOthers = 0;
            
            const validCodes = Object.keys(ings).filter(c => currentAdded.includes(c) && actives[c] !== false && ingredients.some(i => i.code === c));
            
            validCodes.forEach(code => {
                const val = Number(ings[code]) || 0;
                if (val > maxVal) {
                    maxVal = val;
                    maxCode = code;
                }
            });

            if (maxCode) {
                validCodes.forEach(code => {
                    if (code !== maxCode) {
                        sumOthers += Number(ings[code]) || 0;
                    }
                });
                const balanceVal = Math.max(0, 100 - sumOthers);
                ings[maxCode] = Number(balanceVal.toFixed(3));
            }
        }

        Object.keys(ings).forEach(code => {
            // Only calculate cost for ingredients that are actively added to the recipe
            // AND actually exist in the current master ingredients list (to avoid ghost deleted elements)
            if (!currentAdded.includes(code)) return;
            if (!ingredients.some(i => i.code === code)) return;

            if (actives[code] !== false) {
                const percent = Number(ings[code]) || 0;
                if (percent > 0) {
                    const amt = (percent / 100) * wt;
                    res[code] = amt;
                    // Use price from override month (e.g. when loading a recipe) or current month
                    const effectivePrices = priceMonthOverride ? (priceLists[priceMonthOverride] || {}) : currentPrices;
                    const price = effectivePrices[code] || 0;
                    totalCost += amt * price;
                }
            }
        });

        res.result = totalCost;
        setResult(res);
        setManualCost(totalCost);
        setActiveTab('Results');
        if (!skipBalance) {
            setRecipe(prev => ({ ...prev, manualIngredients: ings }));
        }
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

        // Special handling for Ca/P Ratio (should be total Ca / total P, not weighted average of ratios)
        if (totals['P'] > 0) {
            totals['Ca_P_Ratio'] = totals['Ca'] / totals['P'];
        } else {
            totals['Ca_P_Ratio'] = 0;
        }


        return totals;
    }, [result, ingredients, recipe.targetWeight]);

    const exportExcel = () => {
        let currentResult = result;
        if (!currentResult || !currentResult.feasible) {
            const res = { feasible: true, result: 0, isManual: true };
            let totalCost = 0;
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

        const today = new Date();
        const dateStr = today.toLocaleDateString('vi-VN');
        const totalCostResult = currentResult.result || 0;
        const pricePerKg = recipe.targetWeight > 0 ? (totalCostResult / recipe.targetWeight).toFixed(0) : '0';

        // Remove Korean characters and anything following them
        const cleanName = (name) => {
            if (!name) return "";
            const koreanMatch = name.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/);
            return koreanMatch ? name.substring(0, koreanMatch.index).trim() : name;
        };
        const displayName = cleanName(recipe.name);

        // Sheet 1: Composition (Layout matched to PDF)
        const compRows = [
            ["FUSION FORMULA REPORT", "", "", "", ""],
            ["Formula Name:", displayName, "", "Date:", dateStr],
            ["Profile:", recipe.referenceProfile, "", "Site:", "FUSION_VN"],
            ["Price Month:", recipe.priceMonth, "", "Created By:", currentUser?.email || ""],
            ["Batch Weight (kg):", recipe.targetWeight, "", "Batch Price (VND/kg):", Number(pricePerKg).toLocaleString('vi-VN')],
            [""], // Spacer
            ["Code", "Description", "%", "Batch kg", "Accumulated kg"] // Table Header
        ];

        let accumulated = 0;
        let totalPct = 0;
        let totalBatch = 0;

        const sortedAdded = [...(recipe.addedIngredients || [])].sort((a, b) => {
            const getLocalPct = (code) => {
                if (currentResult && !currentResult.isManual && currentResult[code] !== undefined) return (currentResult[code] / recipe.targetWeight) * 100;
                return recipe.manualIngredients[code] || 0;
            };
            return getLocalPct(b) - getLocalPct(a);
        });

        sortedAdded.forEach(code => {
            const ing = ingredients.find(i => i.code === code);
            if (!ing) return;
            const amt = currentResult[ing.code] || 0;
            if (amt <= 0) return;
            const pct = (amt / recipe.targetWeight) * 100;
            accumulated += amt;
            totalPct += pct;
            totalBatch += amt;
            compRows.push([
                ing.code,
                ing.name,
                Number(pct.toFixed(3)),
                Number(amt.toFixed(3)),
                Number(accumulated.toFixed(3))
            ]);
        });

        compRows.push(["TOTAL:", "", Number(totalPct.toFixed(3)), Number(totalBatch.toFixed(3)), Number(accumulated.toFixed(3))]);
        compRows.push([""]);
        compRows.push(["Remarks:", recipe.remarks || ""]);

        const ws1 = XLSX.utils.aoa_to_sheet(compRows);

        // Sheet 2: Nutrient Analysis
        const nutRows = [
            ["NUTRIENT ANALYSIS", "", "", "", "", ""],
            ["Formula:", recipe.name],
            ["Date:", dateStr],
            [""],
            ["Nutrient", "Unit", "Value", "Lower limit", "Upper limit", "Status"]
        ];

        allNutrients.forEach(n => {
            const val = calculatedNutrients[n.key];
            const bound = recipe.constraints[n.key] || {};
            let status = 'OK';
            if (bound.min && val < parseFloat(bound.min)) status = 'Below Min';
            if (bound.max && val > parseFloat(bound.max)) status = 'Exceeds Max';
            nutRows.push([
                n.label,
                n.unit,
                Number(val.toFixed(3)),
                bound.min || '-',
                bound.max || '-',
                status
            ]);
        });

        const ws2 = XLSX.utils.aoa_to_sheet(nutRows);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws1, "Formula Composition");
        XLSX.utils.book_append_sheet(wb, ws2, "Nutrient Analytics");
        XLSX.writeFile(wb, `Formula_${displayName.replace(/\s+/g, '_')}.xlsx`);
    };

    const exportPDF = () => {
        // Build current result data
        let currentResult = result;
        if (!currentResult || !currentResult.feasible) {
            const res = { feasible: true, result: 0, isManual: true };
            let totalCost = 0;
            Object.keys(recipe.manualIngredients || {}).forEach(code => {
                if (recipe.activeIngredients?.[code] !== false) {
                    const percent = recipe.manualIngredients[code];
                    if (percent > 0) {
                        const amt = (percent / 100) * recipe.targetWeight;
                        res[code] = amt;
                        totalCost += amt * (currentPrices[code] || 0);
                    }
                }
            });
            res.result = totalCost;
            currentResult = res;
        }

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        const today = new Date();
        const dateStr = `${today.getDate().toString().padStart(2,'0')}/${(today.getMonth()+1).toString().padStart(2,'0')}/${today.getFullYear()}`;

        // ── Fusion Group logo (top-left) ───────────────────────────────
        // logo.png is square, display proportionally
        doc.addImage(logoSrc, 'PNG', margin, 4, 18, 18);

        // ── Top-right info ────────────────────────────────────────────
        const userEmail = currentUser?.email || '';
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(60, 60, 60);
        doc.text(dateStr, pageW - margin, 10, { align: 'right' });
        doc.text(userEmail, pageW - margin, 14.5, { align: 'right' });
        doc.text('Version:   1', pageW - margin, 19, { align: 'right' });

        // ── Horizontal rule ───────────────────────────────────────────
        doc.setDrawColor(180, 30, 30);
        doc.setLineWidth(0.4);
        doc.line(margin, 24, pageW - margin, 24);

        // ── Formula title ─────────────────────────────────────────────
        const priceMonth = recipe.priceMonth || '';
        const profile = recipe.referenceProfile || '';
        
        // Remove Korean characters and anything following them
        const cleanName = (name) => {
            if (!name) return "";
            const koreanMatch = name.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\uA960-\uA97F\uD7B0-\uD7FF]/);
            return koreanMatch ? name.substring(0, koreanMatch.index).trim() : name;
        };
        const displayName = cleanName(recipe.name);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.setTextColor(180, 30, 30);
        doc.text(`${displayName} - ${profile}`, margin, 33);

        // ── Summary grid ──────────────────────────────────────────────
        const totalCostResult = currentResult.result || 0;
        const pricePerKg = recipe.targetWeight > 0
            ? (totalCostResult / recipe.targetWeight).toFixed(0)
            : '0';

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(30, 30, 30);

        const col1x = margin;
        const col2x = margin + 65;
        const col3x = margin + 110;
        const col4x = margin + 148;
        let sy = 38;
        const rowH = 5.5;

        // Row 1
        doc.setFont('helvetica', 'bold'); doc.text('Price list:', col1x, sy); doc.setFont('helvetica', 'normal'); doc.text(priceMonth, col1x + 22, sy);
        doc.setFont('helvetica', 'bold'); doc.text('Site:', col3x, sy); doc.setFont('helvetica', 'normal'); doc.text('FUSION_VN', col3x + 18, sy);
        sy += rowH;
        // Row 2
        doc.setFont('helvetica', 'bold'); doc.text('Price:', col1x, sy); doc.setFont('helvetica', 'normal'); doc.text(`${Number(pricePerKg).toLocaleString('vi-VN')} VND/kg`, col1x + 22, sy);
        doc.setFont('helvetica', 'bold'); doc.text('Customer:', col3x, sy); doc.setFont('helvetica', 'normal'); doc.text('/', col3x + 25, sy);
        sy += rowH;
        // Row 3
        doc.setFont('helvetica', 'bold'); doc.text('Batch weight:', col1x, sy);
        doc.setFont('helvetica', 'normal'); doc.text(`${recipe.targetWeight.toFixed(3)}    kg`, col1x + 28, sy);
        doc.setFont('helvetica', 'bold'); doc.text('Animal Type:', col3x, sy); doc.setFont('helvetica', 'normal'); doc.text(profile, col3x + 27, sy);
        sy += rowH + 2;

        // ── Composition table ─────────────────────────────────────────
        // Build rows with accumulated kg
        const rows = [];
        let accumulated = 0;
        let totalPct = 0;
        let totalBatch = 0;

        const sortedAddedForPdf = [...(recipe.addedIngredients || [])].sort((a, b) => {
            const getLocalPct = (code) => {
                if (currentResult && !currentResult.isManual && currentResult[code] !== undefined) return (currentResult[code] / recipe.targetWeight) * 100;
                return recipe.manualIngredients[code] || 0;
            };
            return getLocalPct(b) - getLocalPct(a);
        });

        sortedAddedForPdf.forEach(code => {
            const ing = ingredients.find(i => i.code === code);
            if (!ing) return;
            const amt = currentResult[ing.code] || 0;
            if (amt <= 0) return;
            const pct = (amt / recipe.targetWeight) * 100;
            accumulated += amt;
            totalPct += pct;
            totalBatch += amt;
            rows.push([
                ing.code,
                ing.name,
                pct.toFixed(3),
                amt.toFixed(3),
                accumulated.toFixed(3)
            ]);
        });

        // totals row
        const totalsRow = [
            '', '',
            totalPct.toFixed(3),
            totalBatch.toFixed(3),
            accumulated.toFixed(3)
        ];

        // Draw section header bar
        doc.setFillColor(80, 80, 90);
        doc.rect(margin, sy, pageW - margin * 2, 7, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text('Composition', margin + 3, sy + 5);
        sy += 7;

        autoTable(doc, {
            startY: sy,
            head: [[
                { content: 'Code', styles: { halign: 'left' } },
                { content: 'Discription', styles: { halign: 'left' } },
                { content: '%', styles: { halign: 'right' } },
                { content: 'Batch\nkg', styles: { halign: 'right' } },
                { content: 'Accumulated\nkg', styles: { halign: 'right' } }
            ]],
            body: rows,
            foot: [[
                { content: '', colSpan: 2, styles: { halign: 'left', fontStyle: 'bold' } },
                { content: totalsRow[2], styles: { halign: 'right', fontStyle: 'bold' } },
                { content: totalsRow[3], styles: { halign: 'right', fontStyle: 'bold' } },
                { content: totalsRow[4], styles: { halign: 'right', fontStyle: 'bold' } },
            ]],
            showFoot: 'lastPage',
            margin: { left: margin, right: margin },
            styles: {
                fontSize: 8.5,
                cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
                textColor: [30, 30, 30],
                lineColor: [220, 220, 220],
                lineWidth: 0.2,
            },
            headStyles: {
                fillColor: [248, 248, 248],
                textColor: [30, 30, 30],
                fontStyle: 'bold',
                halign: 'center',
                lineColor: [200, 200, 200],
                lineWidth: 0.3,
            },
            footStyles: {
                fillColor: [255, 255, 255],
                textColor: [30, 30, 30],
                fontStyle: 'bold',
                lineColor: [200, 200, 200],
                lineWidth: 0.4,
            },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            columnStyles: {
                0: { halign: 'left', cellWidth: 38, textColor: [180, 100, 20], fontStyle: 'bold' },
                1: { halign: 'left', cellWidth: 'auto' },
                2: { halign: 'right', cellWidth: 20 },
                3: { halign: 'right', cellWidth: 22 },
                4: { halign: 'right', cellWidth: 28 },
            },
            didParseCell: (data) => {
                // Make even rows slightly off-white to mimic the sample
                if (data.section === 'body' && data.row.index % 2 === 1) {
                    data.cell.styles.fillColor = [250, 250, 250];
                }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 6;

        let currentY = finalY;

        // ── Remarks (bold) below composition ─────────────────────────
        const rawRemarks = (recipe.remarks || '').trim();
        if (rawRemarks) {
            const remarksText = `Remarks: ${rawRemarks}`;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 30, 30);
            // Wrap long remarks text to page width
            const maxLineWidth = pageW - margin * 2;
            const lines = doc.splitTextToSize(remarksText, maxLineWidth);
            doc.text(lines, margin, currentY);
        }

        doc.save(`Formula_${displayName.replace(/\s+/g, '_')}.pdf`);
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
            let nextManual = { ...recipe.manualIngredients, [selectedSearchIng]: 0 };
            const nextActive = { ...recipe.activeIngredients, [selectedSearchIng]: true };
            
            setRecipe({ ...recipe, addedIngredients: nextAdded, manualIngredients: nextManual, activeIngredients: nextActive });
            setSelectedSearchIng('');
            runManualCalculation(nextManual, nextActive);
        }
    };

    const removeIngredient = (code) => {
        const nextAdded = (recipe.addedIngredients || []).filter(c => c !== code);
        let nextManual = { ...recipe.manualIngredients };
        delete nextManual[code];
        const nextActive = { ...recipe.activeIngredients };
        delete nextActive[code];
        
        setRecipe({ ...recipe, addedIngredients: nextAdded, manualIngredients: nextManual, activeIngredients: nextActive });
        runManualCalculation(nextManual, nextActive);
    };

    const sum = (recipe.addedIngredients || []).reduce((a, code) => {
        const ing = ingredients.find(i => i.code === code);
        if (!ing) return a;
        
        const isUsed = recipe.activeIngredients?.[code] !== false;
        if (!isUsed) return a;

        let calcPct = recipe.manualIngredients[code] || 0;
        if (result && result[code] !== undefined) {
             calcPct = (result[code] / recipe.targetWeight) * 100;
        }
        
        return Math.round((a + calcPct) * 1000) / 1000;
    }, 0);
    const displayCost = result && result.feasible ? formatCurrency(result.result) : formatCurrency(manualCost);
    const displayPricePerKg = result && result.feasible ? formatCurrency(result.result / recipe.targetWeight) : formatCurrency(manualCost / recipe.targetWeight);

    const handleSave = () => {
        // Sort addedIngredients before saving based on usage percent (descending)
        const sortedAdded = [...(recipe.addedIngredients || [])].sort((a, b) => getPct(b) - getPct(a));
        const finalRecipe = { ...recipe, addedIngredients: sortedAdded };
        
        saveRecipe(finalRecipe);
        setRecipe(finalRecipe);
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
            // Pass priceMonthOverride to avoid stale closure: currentPrices is still from old recipe's month
            runManualCalculation(toEdit.manualIngredients, toEdit.activeIngredients, toEdit.targetWeight, true, toEdit.priceMonth, toEdit.addedIngredients);
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

    const handleGridKeyDown = (e, row, col) => {
        const key = e.key;
        if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return;

        let nextRow = row;
        let nextCol = col;

        if (key === 'ArrowUp') nextRow--;
        else if (key === 'ArrowDown' || key === 'Enter') nextRow++;
        else if (key === 'ArrowLeft') nextCol--;
        else if (key === 'ArrowRight') nextCol++;

        const getCellId = (r, c) => {
            if (c === 0) return `comp-pct-${r}`;
            if (c === 1) return `comp-min-${r}`;
            if (c === 2) return `comp-max-${r}`;
            if (c === 3) return `analysis-min-${r}`;
            if (c === 4) return `analysis-max-${r}`;
            return null;
        };

        // Horizontal wrap/limit
        if (nextCol < 0) nextCol = 0;
        if (nextCol > 4) nextCol = 4;

        // Row boundaries depend on column
        const maxCompRow = (recipe.addedIngredients || []).length - 1;
        const maxAnalysisRow = allNutrients.length - 1;

        const targetMaxRow = nextCol <= 2 ? maxCompRow : maxAnalysisRow;
        if (nextRow < 0) nextRow = 0;
        if (nextRow > targetMaxRow) nextRow = targetMaxRow;

        const nextId = getCellId(nextRow, nextCol);
        if (nextId) {
            e.preventDefault();
            const el = document.getElementById(nextId);
            if (el) {
                el.focus();
                if (el.select) el.select();
            }
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
                            <input type="number" value={recipe.targetWeight} onChange={e => {
                                const nextWt = Number(e.target.value);
                                setRecipe({ ...recipe, targetWeight: nextWt });
                                if (!result || result.isManual) {
                                    runManualCalculation(recipe.manualIngredients, recipe.activeIngredients, nextWt, true);
                                }
                            }} style={{ border: 'none', borderBottom: '1px solid #ccc', width: '50px', background: 'transparent', textAlign: 'right', fontSize: '12px', outline: 'none' }} />
                            <span style={{ marginLeft: '4px' }}>kg</span>
                        </div>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '150px' }}>
                        <strong>Standard DM:</strong>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                            <input type="number" value={refDMValue} onChange={e => setRefDMValue(Number(e.target.value))} style={{ border: 'none', borderBottom: '1px solid #ccc', width: '40px', background: 'transparent', textAlign: 'right', fontSize: '12px', outline: 'none' }} />
                            <span style={{ marginLeft: '4px' }}>%</span>
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

                    {/* Remarks bar */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '5px 10px', background: '#fffde7', borderBottom: '1px solid #e5c800' }}>
                        <strong style={{ fontSize: '11px', color: '#6b5900', whiteSpace: 'nowrap', paddingTop: '3px' }}>Remarks:</strong>
                        <textarea
                            value={recipe.remarks || ''}
                            onChange={e => setRecipe({ ...recipe, remarks: e.target.value })}
                            placeholder="Enter remarks / notes for this formula..."
                            rows={2}
                            style={{
                                flex: 1,
                                fontSize: '11px',
                                border: '1px solid #e5c800',
                                borderRadius: '3px',
                                padding: '3px 6px',
                                resize: 'vertical',
                                outline: 'none',
                                background: '#fffff0',
                                color: '#333',
                                fontFamily: 'Arial, sans-serif',
                                lineHeight: '1.4'
                            }}
                        />
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

                                    let isAlert = false;
                                    const minVal = recipe.ingredientMin?.[ing.code];
                                    const maxVal = recipe.ingredientMax?.[ing.code];
                                    if (isUsed) {
                                        if (minVal !== undefined && minVal !== '' && calcPct < parseFloat(minVal)) isAlert = true;
                                        if (maxVal !== undefined && maxVal !== '' && calcPct > parseFloat(maxVal)) isAlert = true;
                                    }

                                    return (
                                        <tr key={ing.code}
                                            style={{ background: isUsed ? (isAlert ? '#fee2e2' : (idx % 2 === 0 ? '#fff' : '#f8f9fa')) : '#f1f5f9', opacity: isUsed ? 1 : 0.6, borderBottom: '1px solid #f3f4f6', cursor: 'context-menu' }}
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
                                                        
                                                        setRecipe({ ...recipe, activeIngredients: nextActive, manualIngredients: nextManual });
                                                        runManualCalculation(nextManual, nextActive);
                                                    }} style={{ margin: 0, cursor: 'pointer' }} />
                                                </div>
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: isUsed ? '#fff9c4' : 'transparent' }}>
                                                <input
                                                    id={`comp-pct-${idx}`}
                                                    type="text"
                                                    inputMode="decimal"
                                                    disabled={!isUsed}
                                                    value={
                                                        localPctValues[ing.code] !== undefined
                                                            ? localPctValues[ing.code]
                                                            : (recipe.manualIngredients[ing.code] !== undefined ? Number(recipe.manualIngredients[ing.code]).toFixed(3) : '0.000')
                                                    }
                                                    onFocus={e => {
                                                        // When focused, seed local value from recipe
                                                        const cur = recipe.manualIngredients[ing.code];
                                                        setLocalPctValues(prev => ({ ...prev, [ing.code]: cur !== undefined ? String(cur) : '0' }));
                                                        e.target.select();
                                                    }}
                                                    onKeyDown={e => handleGridKeyDown(e, idx, 0)}
                                                    onChange={e => {
                                                        // Allow typing freely (including '5.' or '5.2')
                                                        let raw = e.target.value.replace(',', '.'); // convert comma -> period
                                                        // Only allow digits and one period
                                                        if (/^\d*\.?\d*$/.test(raw)) {
                                                            setLocalPctValues(prev => ({ ...prev, [ing.code]: raw }));
                                                        }
                                                    }}
                                                    onBlur={() => {
                                                        // Commit parsed value to recipe on blur
                                                        const raw = localPctValues[ing.code] ?? String(recipe.manualIngredients[ing.code] || 0);
                                                        let val = Math.round((parseFloat(raw) || 0) * 1000) / 1000;
                                                        
                                                        const mVal = recipe.ingredientMax?.[ing.code];
                                                        if (mVal !== undefined && mVal !== '' && val > parseFloat(mVal)) {
                                                            val = parseFloat(mVal);
                                                        }

                                                        if (val > 100) val = 100;

                                                        let next = { ...recipe.manualIngredients };
                                                        next[ing.code] = val;
                                                        
                                                        // Run calculation which will handle auto-balancing
                                                        runManualCalculation(next, recipe.activeIngredients, recipe.targetWeight);
                                                        
                                                        // Clear local so display reverts to balanced recipe value
                                                        setLocalPctValues(prev => { const n = { ...prev }; delete n[ing.code]; return n; });
                                                    }}
                                                    style={{ width: '60px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none', color: isUsed ? '#b45309' : '#9ca3af', fontWeight: 'bold' }}
                                                    placeholder="0.000"
                                                />
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: 'transparent' }}>
                                                <input id={`comp-min-${idx}`} type="number" value={recipe.ingredientMin?.[ing.code] ?? ''} onFocus={e => e.target.select()} onKeyDown={e => handleGridKeyDown(e, idx, 1)} onChange={e => {
                                                    const next = { ...(recipe.ingredientMin || {}) };
                                                    next[ing.code] = e.target.value;
                                                    setRecipe({ ...recipe, ingredientMin: next });
                                                }} style={{ width: '60px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none' }} placeholder="" />
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: 'transparent' }}>
                                                <input id={`comp-max-${idx}`} type="number" value={recipe.ingredientMax?.[ing.code] ?? ''} onFocus={e => e.target.select()} onKeyDown={e => handleGridKeyDown(e, idx, 2)} onChange={e => {
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
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', textAlign: 'left', fontWeight: 'bold', color: '#495057' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span>Type</span>
                                            <select 
                                                value={nutDisplayMode} 
                                                onChange={e => setNutDisplayMode(e.target.value)}
                                                style={{ fontSize: '10px', padding: '1px', borderRadius: '3px', border: '1px solid #ccc', background: '#fff' }}
                                            >
                                                <option value="as-fed">As-fed</option>
                                                <option value="dm">On DM</option>
                                                <option value="reference">Reference</option>
                                            </select>
                                        </div>
                                    </th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Value</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Lower limit</th>
                                    <th style={{ resize: 'horizontal', overflow: 'hidden', borderBottom: '1px solid #ccc', borderRight: '1px solid #e5e7eb', padding: '6px 8px', fontWeight: 'bold', color: '#495057' }}>Upper limit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allNutrients.map((n, idx) => {
                                    const asFedVal = calculatedNutrients[n.key];
                                    const recipeMoisture = calculatedNutrients['Moisture'] || 0;
                                    const recipeDM = calculatedNutrients['DM'] || (100 - recipeMoisture);
                                    
                                    let displayVal = asFedVal;
                                    let typeLabel = 'On Product';

                                    if (nutDisplayMode === 'dm') {
                                        typeLabel = 'On DM';
                                        displayVal = recipeDM > 0 ? (asFedVal / recipeDM) * 100 : 0;
                                    } else if (nutDisplayMode === 'reference') {
                                        typeLabel = `On ${refDMValue}% DM`;
                                        displayVal = recipeDM > 0 ? (asFedVal / recipeDM) * refDMValue : 0;
                                    }

                                    // Moisture and DM themselves should probably always show as-fed or be handled specially
                                    if (n.key === 'Moisture' || n.key === 'DM') {
                                        displayVal = asFedVal;
                                        typeLabel = 'Base';
                                    }

                                    const bound = recipe.constraints[n.key] || { min: '', max: '' };

                                    let alertMin = false;
                                    let alertMax = false;
                                    if (bound.min && asFedVal < parseFloat(bound.min)) alertMin = true;
                                    if (bound.max && asFedVal > parseFloat(bound.max)) alertMax = true;
                                    const alert = alertMin || alertMax;

                                    return (
                                        <tr 
                                            key={n.key} 
                                            onDoubleClick={() => setSelectedNutrientKey(n.key)}
                                            style={{ 
                                                background: selectedNutrientKey === n.key ? '#bae6fd' : (alert ? '#f8d7da' : (idx % 2 === 0 ? '#fff' : '#f8f9fa')), 
                                                borderBottom: '1px solid #f3f4f6', 
                                                color: alert ? '#721c24' : 'inherit',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: alert ? '#721c24' : '#4b5563' }}>FS_{n.key.substring(0, 4).toUpperCase()}</td>
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: alert ? '#721c24' : '#111827' }}>{n.label} <span style={{ opacity: 0.6 }}>({n.unit})</span></td>
                                            <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: alert ? '#721c24' : '#6b7280', fontSize: '10px' }}>{typeLabel}</td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', fontWeight: 'bold', color: alert ? '#721c24' : '#111827' }}>
                                                {displayVal !== undefined && displayVal !== null && !isNaN(displayVal) ? displayVal.toFixed(3) : '-'}
                                                {alertMin && ' ↓'}
                                                {alertMax && ' ↑'}
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: (bound.min !== undefined && bound.min !== null && bound.min !== '') ? '#fdf8f5' : 'transparent' }}>
                                                <input id={`analysis-min-${idx}`} type="number" value={bound.min === null ? '' : bound.min} step="0.01" onFocus={e => e.target.select()} onKeyDown={e => handleGridKeyDown(e, idx, 3)} onChange={e => handleConstraintChange(n.key, 'min', e.target.value)} style={{ width: '50px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none' }} placeholder="" />
                                            </td>
                                            <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', background: (bound.max !== undefined && bound.max !== null && bound.max !== '') ? '#fdf8f5' : 'transparent' }}>
                                                <input id={`analysis-max-${idx}`} type="number" value={bound.max === null ? '' : bound.max} step="0.01" onFocus={e => e.target.select()} onKeyDown={e => handleGridKeyDown(e, idx, 4)} onChange={e => handleConstraintChange(n.key, 'max', e.target.value)} style={{ width: '50px', border: 'none', background: 'transparent', textAlign: 'right', fontSize: '11px', outline: 'none' }} placeholder="" />
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Nutrient Detail Pane (Only visible when a nutrient is selected) */}
                {selectedNutrientKey && (() => {
                    const selectedNutrientInfo = allNutrients.find(n => n.key === selectedNutrientKey);
                    const finalNutrientValue = calculatedNutrients[selectedNutrientKey] || 0;
                    
                    const details = (recipe.addedIngredients || [])
                        .filter(code => recipe.activeIngredients?.[code] !== false)
                        .map(code => {
                            const ing = ingredients.find(i => i.code === code);
                            if (!ing) return null;
                            let amt = 0;
                            if (result && result[code] !== undefined) {
                                 amt = result[code];
                            } else {
                                 const pct = recipe.manualIngredients[code] || 0;
                                 amt = (pct / 100) * recipe.targetWeight;
                            }
                            if (amt <= 0) return null;
                            
                            const pct = (amt / recipe.targetWeight) * 100;
                            const analysis = ing.nutrients[selectedNutrientKey] || 0;
                            const contributionAbs = analysis * (amt / recipe.targetWeight);
                            const contributionPct = finalNutrientValue > 0 ? (contributionAbs / finalNutrientValue) * 100 : 0;
                            
                            return { code, name: ing.name, weight: amt, pct, analysis, contributionAbs, contributionPct };
                        })
                        .filter(Boolean)
                        .sort((a, b) => b.contributionAbs - a.contributionAbs); // Sort by highest contribution

                    return (
                        <>
                            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1040 }} onClick={() => setSelectedNutrientKey(null)} />
                            <div style={{ position: 'fixed', top: '10vh', left: '15vw', right: '15vw', bottom: '10vh', background: '#fff', zIndex: 1050, borderRadius: '8px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <div style={{ background: '#f8f9fa', padding: '16px 20px', fontWeight: 'bold', fontSize: '15px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#111827' }}>
                                    <span>Nutrient Control: FS_{selectedNutrientKey.substring(0,4).toUpperCase()} - {selectedNutrientInfo.label} <span style={{ color: '#059669', marginLeft: '8px' }}>({finalNutrientValue.toFixed(3)} {selectedNutrientInfo.unit})</span></span>
                                    <X size={20} style={{ cursor: 'pointer', color: '#6b7280' }} onClick={() => setSelectedNutrientKey(null)} />
                                </div>
                                <div style={{ overflowY: 'auto', flex: 1, background: '#fff', padding: '16px' }}>
                                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', textAlign: 'right' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, boxShadow: '0 1px 0 #ccc' }}>
                                        <tr>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Code</th>
                                            <th style={{ padding: '6px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Description</th>
                                            <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Weight (kg)</th>
                                            <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>%</th>
                                            <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Analysis</th>
                                            <th style={{ padding: '6px 8px', borderRight: '1px solid #e5e7eb', color: '#495057' }}>Contribution (abs)</th>
                                            <th style={{ padding: '6px 8px', color: '#495057' }}>Contribution (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {details.map((d, idx) => (
                                            <tr key={d.code} style={{ background: idx % 2 === 0 ? '#fff' : '#f8f9fa', borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: '#d97706', fontWeight: 'bold' }}>{d.code}</td>
                                                <td style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #e5e7eb', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px' }}>{d.name}</td>
                                                <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', color: '#4b5563' }}>{d.weight.toFixed(3)}</td>
                                                <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', color: '#4b5563' }}>{d.pct.toFixed(3)}</td>
                                                <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', color: '#4b5563' }}>{d.analysis.toFixed(2)}</td>
                                                <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', color: '#4b5563' }}>{d.contributionAbs.toFixed(5)}</td>
                                                <td style={{ padding: '4px 8px', color: '#4b5563' }}>{d.contributionPct.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                        {details.length === 0 && (
                                            <tr><td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#9ca3af' }}>No contributing ingredients</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        </>
                    );
                })()}
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
                            Remove ingredient
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

