import React, { useState } from 'react';
import { useAppContext } from '../store';
import { Plus, Save, CalendarIcon, Search } from 'lucide-react';
import { formatCurrency } from '../constants';

export default function PriceList() {
    const { ingredients, priceLists, updatePriceList } = useAppContext();
    const [selectedMonth, setSelectedMonth] = useState('2026-02');
    const [currentPrices, setCurrentPrices] = useState(priceLists['2026-02'] || {});
    const [searchTerm, setSearchTerm] = useState('');

    const handleMonthChange = (e) => {
        const month = e.target.value;
        setSelectedMonth(month);
        setCurrentPrices(priceLists[month] || {});
    };

    const handlePriceChange = (code, value) => {
        setCurrentPrices({
            ...currentPrices,
            [code]: Number(value)
        });
    };

    const handleSave = () => {
        updatePriceList(selectedMonth, currentPrices);
        alert(`Price list for ${selectedMonth} saved successfully!`);
    };

    const currentYear = selectedMonth.split('-')[0] || '2026';
    const currentMonth = selectedMonth.split('-')[1] || '02';
    const months = [
        { value: '01', label: 'January' }, { value: '02', label: 'February' }, { value: '03', label: 'March' },
        { value: '04', label: 'April' }, { value: '05', label: 'May' }, { value: '06', label: 'June' },
        { value: '07', label: 'July' }, { value: '08', label: 'August' }, { value: '09', label: 'September' },
        { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' }
    ];

    return (
        <div className="animate-fade-in">
            <div className="flex" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 className="title" style={{ marginBottom: '0.5rem' }}>Ingredients Price List</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Manage raw material costs by month.</p>
                </div>
            </div>

            <div className="glass-panel" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CalendarIcon size={16} /> Select Month / Year</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <select
                            className="form-input"
                            value={currentMonth}
                            onChange={(e) => handleMonthChange({ target: { value: `${currentYear}-${e.target.value}` } })}
                            style={{ width: '150px' }}
                        >
                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select
                            className="form-input"
                            value={currentYear}
                            onChange={(e) => handleMonthChange({ target: { value: `${e.target.value}-${currentMonth}` } })}
                            style={{ width: '100px' }}
                        >
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                            <option value="2028">2028</option>
                        </select>
                    </div>
                </div>
                <div className="form-group" style={{ margin: 0, marginLeft: 'auto', display: 'flex', flexDirection: 'column' }}>
                    <label className="form-label">Search</label>
                    <div style={{ position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} />
                        </div>
                        <input
                            type="text"
                            placeholder="Search code or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="form-input"
                            style={{ paddingLeft: '32px', width: '250px' }}
                        />
                    </div>
                </div>

                <button className="btn btn-primary" onClick={handleSave} style={{ marginLeft: '1rem' }}>
                    <Save size={18} /> Save Prices
                </button>
            </div>

            <div className="glass-panel table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th width="10%">Code</th>
                            <th width="40%">Ingredient Name</th>
                            <th width="20%">Group</th>
                            <th width="30%">Price / kg (VND)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {ingredients
                            .filter(ing => {
                                if (!searchTerm) return true;
                                const term = searchTerm.toLowerCase();
                                return ing.name.toLowerCase().includes(term) || ing.code.toLowerCase().includes(term);
                            })
                            .map(ing => (
                                <tr key={ing.code}>
                                    <td><span className="badge badge-warning">{ing.code}</span></td>
                                    <td style={{ fontWeight: 500 }}>{ing.name}</td>
                                    <td><span className="badge badge-success">{ing.group}</span></td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <input
                                                type="number"
                                                className="form-input"
                                                style={{ padding: '0.4rem', width: '150px' }}
                                                value={currentPrices[ing.code] === undefined ? '' : currentPrices[ing.code]}
                                                onChange={(e) => handlePriceChange(ing.code, e.target.value)}
                                                placeholder="0.00"
                                            />
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {formatCurrency(currentPrices[ing.code] || 0)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
