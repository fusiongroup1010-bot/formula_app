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
            { key: 'Cystine', label: 'Cystine', unit: '%' },
            { key: 'MET_CYS', label: 'MET+CYS', unit: '%' },
            { key: 'Threonine', label: 'Threonine', unit: '%' },
            { key: 'Tryptophan', label: 'Tryptophan', unit: '%' },
            { key: 'Arginine', label: 'Arginine', unit: '%' },
            { key: 'Isoleucine', label: 'Isoleucine', unit: '%' },
            { key: 'Leucine', label: 'Leucine', unit: '%' },
            { key: 'Valine', label: 'Valine', unit: '%' },
            { key: 'Histidine', label: 'Histidine', unit: '%' },
            { key: 'Phenylalanine', label: 'Phenylalanine', unit: '%' },
            { key: 'Tyrosine', label: 'Tyrosine', unit: '%' },
            { key: 'PHE_TYR', label: 'PHE+TYR', unit: '%' },
            { key: 'Taurine', label: 'Taurine', unit: '%' },
        ]
    },
    {
        name: 'Fibers',
        items: [
            { key: 'Cellulose', label: 'Cellulose', unit: '%' },
            { key: 'NDF', label: 'NDF', unit: '%' },
            { key: 'ADF', label: 'ADF', unit: '%' },
            { key: 'Lignine', label: 'Lignine', unit: '%' },
            { key: 'Hemicellulose', label: 'Hemicellulose', unit: '%' },
        ]
    },
    {
        name: 'Fatty Acids',
        items: [
            { key: 'Omega_6', label: 'Omega 6', unit: '%' },
            { key: 'Omega_3', label: 'Omega 3', unit: '%' },
            { key: 'Omega_6_3_Ratio', label: 'Omega 6/3 Ratio', unit: 'Ratio' },
            { key: 'Linoleic_Acid', label: 'Linoleic Acid', unit: '%' },
            { key: 'Alpha_Linolenic_Acid', label: 'Alpha Linolenic Acid', unit: '%' },
            { key: 'Arachidonic_Acid', label: 'Arachidonic Acid', unit: '%' },
            { key: 'DHA', label: 'DHA', unit: '%' },
            { key: 'EPA', label: 'EPA', unit: '%' },
            { key: 'EDA', label: 'EDA', unit: '%' },
            { key: 'Fatty_acid', label: 'Other Fatty Acids', unit: '%' },
        ]
    },
    {
        name: 'Minerals',
        items: [
            { key: 'Ca', label: 'Calcium (Ca)', unit: '%' },
            { key: 'P', label: 'Phosphorus (P)', unit: '%' },
            { key: 'Ca_P_Ratio', label: 'Ca/P Ratio', unit: 'Ratio' },
            { key: 'Na', label: 'Sodium (Na)', unit: '%' },
            { key: 'K', label: 'Potassium (K)', unit: '%' },
            { key: 'Cl', label: 'Chloride (Cl)', unit: '%' },
            { key: 'Mg', label: 'Magnesium (Mg)', unit: '%' },
            { key: 'S', label: 'Sulfur (S)', unit: '%' },
        ]
    },
    {
        name: 'Micro Minerals & Heavy Metals',
        items: [
            { key: 'Fe', label: 'Iron (Fe)', unit: 'mg/kg' },
            { key: 'Mn', label: 'Manganese (Mn)', unit: 'mg/kg' },
            { key: 'Zn', label: 'Zinc (Zn)', unit: 'mg/kg' },
            { key: 'Cu', label: 'Copper (Cu)', unit: 'mg/kg' },
            { key: 'I', label: 'Iodine (I)', unit: 'mg/kg' },
            { key: 'Se', label: 'Selenium (Se)', unit: 'mg/kg' },
            { key: 'Co', label: 'Cobalt (Co)', unit: 'mg/kg' },
            { key: 'Lead', label: 'Lead', unit: 'ppm' },
            { key: 'Arsenic', label: 'Arsenic', unit: 'ppm' },
            { key: 'Cadmium', label: 'Cadmium', unit: 'ppm' },
            { key: 'Mercury', label: 'Mercury', unit: 'ppm' },
            { key: 'Choline', label: 'Choline', unit: 'mg/kg' },
            { key: 'Flour', label: 'Flour', unit: 'ppm' },
            { key: 'Histamin', label: 'Histamin', unit: 'ppm' },
            { key: 'Potassium_sorbate', label: 'Potassium Sorbate', unit: 'ppm' },
            { key: 'Alumium', label: 'Alumium', unit: 'ppm' },
            { key: 'Acid_citric', label: 'Acid Citric', unit: 'ppm' },
            { key: 'BHA', label: 'BHA', unit: 'ppm' },
            { key: 'BHT', label: 'BHT', unit: 'ppm' },
            { key: 'Aflatoxin_B1', label: 'Aflatoxin B1', unit: 'ppb' },
            { key: 'Propyl_Gallate', label: 'Propyl Gallate', unit: 'ppm' },
            { key: 'Ethoxyquin', label: 'Ethoxyquin', unit: 'ppm' },
            { key: 'TVBN', label: 'TVBN', unit: 'mg/100g' },
        ]
    },
    {
        name: 'Vitamins',
        items: [
            { key: 'Vitamin_A', label: 'Vitamin A', unit: 'IU/kg' },
            { key: 'Vitamin_D', label: 'Vitamin D3', unit: 'IU/kg' },
            { key: 'Vitamin_E', label: 'Vitamin E', unit: 'IU/kg' },
            { key: 'Vitamin_K', label: 'Vitamin K', unit: 'mg/kg' },
            { key: 'Vitamin_B1', label: 'Vitamin B1', unit: 'mg/kg' },
            { key: 'Vitamin_B2', label: 'Vitamin B2', unit: 'mg/kg' },
            { key: 'Vitamin_B3', label: 'Vitamin B3', unit: 'mg/kg' },
            { key: 'Vitamin_B5', label: 'Vitamin B5', unit: 'mg/kg' },
            { key: 'Vitamin_B6', label: 'Vitamin B6', unit: 'mg/kg' },
            { key: 'Vitamin_B7', label: 'Vitamin B7', unit: 'mg/kg' },
            { key: 'Vitamin_B9', label: 'Vitamin B9', unit: 'mg/kg' },
            { key: 'Vitamin_B12', label: 'Vitamin B12', unit: 'mg/kg' },
            { key: 'Vitamin_C', label: 'Vitamin C', unit: 'mg/kg' },
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
export const formatCurrency = (value) => {
    if (value === undefined || value === null || isNaN(value)) return '0 VND';
    return Math.round(Number(value)).toLocaleString('en-US') + ' VND';
};
