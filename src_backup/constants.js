export const nutrientGroups = [
    {
        name: 'General',
        items: [
            { key: 'Moisture', label: 'Moisture', unit: '%' },
            { key: 'DM', label: 'DM', unit: '%' },
            { key: 'Crude_protein', label: 'Crude Protein', unit: '%' },
            { key: 'Crude_fat', label: 'Crude Fat', unit: '%' },
            { key: 'Crude_ash', label: 'Crude Ash', unit: '%' },
            { key: 'Crude_fiber', label: 'Crude Fiber', unit: '%' },
            { key: 'NFE', label: 'NFE', unit: '%' },
            { key: 'Starch', label: 'Starch', unit: '%' },
        ]
    },
    {
        name: 'Energy',
        items: [
            { key: 'Energy', label: 'Energy', unit: 'kcal/kg' },
            { key: 'GE', label: 'GE', unit: 'kcal/kg' },
            { key: 'ME_NRC_06', label: 'ME NRC 06', unit: 'kcal/kg' },
            { key: 'Atwater_Modified', label: 'Atwater Modified', unit: 'kcal/kg' },
            { key: 'PD', label: 'PD', unit: 'kcal/kg' }
        ]
    },
    {
        name: 'Amino Acids',
        items: [
            { key: 'Lysine', label: 'Lysine', unit: '%' },
            { key: 'Methionine', label: 'Methionine', unit: '%' },
            { key: 'MET_CYS', label: 'MET+CYS', unit: '%' },
            { key: 'Histidine', label: 'Histidine', unit: '%' },
            { key: 'Threonine', label: 'Threonine', unit: '%' },
            { key: 'Tryptophan', label: 'Tryptophan', unit: '%' },
            { key: 'Arginine', label: 'Arginine', unit: '%' },
            { key: 'Valine', label: 'Valine', unit: '%' },
            { key: 'Taurine', label: 'Taurine', unit: '%' },
        ]
    },
    {
        name: 'Fibers',
        items: [
            { key: 'Cellulose', label: 'Cellulose', unit: '%' },
        ]
    },
    {
        name: 'Fatty Acids',
        items: [
            { key: 'Omega_6', label: 'Omega 6', unit: '%' },
            { key: 'Omega_3', label: 'Omega 3', unit: '%' },
            { key: 'Fatty_acid', label: 'Other Fatty Acids', unit: '%' },
        ]
    },
    {
        name: 'Minerals',
        items: [
            { key: 'Ca', label: 'Calcium (Ca)', unit: '%' },
            { key: 'P', label: 'Phosphorus (P)', unit: '%' },
            { key: 'Na', label: 'Sodium (Na)', unit: '%' },
            { key: 'K', label: 'Potassium (K)', unit: '%' },
            { key: 'Cl', label: 'Chloride (Cl)', unit: '%' },
            { key: 'Mg', label: 'Magnesium (Mg)', unit: '%' },
        ]
    },
    {
        name: 'Micro Minerals & Heavy Metals',
        items: [
            { key: 'Heavy_metals', label: 'Heavy Metals', unit: 'ppm' },
            { key: 'Micro_minerals', label: 'Micro Minerals', unit: 'mg/kg' }
        ]
    },
    {
        name: 'Vitamins',
        items: [
            { key: 'Vitamin_A', label: 'Vitamin A', unit: 'IU/kg' },
            { key: 'Vitamin_D', label: 'Vitamin D', unit: 'IU/kg' },
            { key: 'Vitamin_E', label: 'Vitamin E', unit: 'IU/kg' },
        ]
    }
];

export const allNutrients = nutrientGroups.flatMap(g => g.items);

export const aafcoProfiles = {
    'Dog - Growth': { Crude_protein: { min: 22.5, max: null }, Crude_fat: { min: 8.5, max: null }, Ca: { min: 1.2, max: 2.5 }, P: { min: 1.0, max: 1.6 }, Vitamin_A: { min: 5000, max: 250000 } },
    'Dog - Maintenance': { Crude_protein: { min: 18.0, max: null }, Crude_fat: { min: 5.5, max: null }, Ca: { min: 0.5, max: 2.5 }, P: { min: 0.4, max: 1.6 }, Vitamin_A: { min: 5000, max: 250000 } },
    'Cat - Growth': { Crude_protein: { min: 30.0, max: null }, Crude_fat: { min: 9.0, max: null }, Taurine: { min: 0.1, max: null }, Ca: { min: 1.0, max: null }, P: { min: 0.8, max: null }, Vitamin_A: { min: 9000, max: 750000 } },
    'Cat - Maintenance': { Crude_protein: { min: 26.0, max: null }, Crude_fat: { min: 9.0, max: null }, Taurine: { min: 0.1, max: null }, Ca: { min: 0.6, max: null }, P: { min: 0.5, max: null }, Vitamin_A: { min: 9000, max: 750000 } },
};
