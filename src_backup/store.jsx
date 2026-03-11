import { createContext, useContext, useState, useEffect } from 'react';

const defaultIngredients = [
    { code: 'ING01', name: 'Corn', group: 'Grains', nutrients: { Crude_protein: 8.5, Crude_fat: 3.8, Crude_fiber: 2.2, Crude_ash: 1.5, DM: 88, ME_NRC_06: 3300 } },
    { code: 'ING02', name: 'Poultry Meal', group: 'Protein', nutrients: { Crude_protein: 65, Crude_fat: 14, Crude_fiber: 1, Crude_ash: 16, DM: 95, ME_NRC_06: 4100 } },
    { code: 'ING03', name: 'Soybean Meal', group: 'Plant Protein', nutrients: { Crude_protein: 46, Crude_fat: 1.5, Crude_fiber: 6, Crude_ash: 6.5, DM: 89, ME_NRC_06: 2800 } },
];

const defaultPrices = {
    '2026-02': { 'ING01': 200, 'ING02': 800, 'ING03': 500 }
};

const AppContext = createContext();

export const AppProvider = ({ children }) => {
    const [ingredients, setIngredients] = useState(() => {
        const saved = localStorage.getItem('formula_app_ing');
        return saved ? JSON.parse(saved) : defaultIngredients;
    });

    const [priceLists, setPriceLists] = useState(() => {
        const saved = localStorage.getItem('formula_app_prices');
        return saved ? JSON.parse(saved) : defaultPrices;
    });

    const [recipes, setRecipes] = useState(() => {
        const saved = localStorage.getItem('formula_app_recipes');
        return saved ? JSON.parse(saved) : [];
    });

    useEffect(() => {
        localStorage.setItem('formula_app_ing', JSON.stringify(ingredients));
        localStorage.setItem('formula_app_prices', JSON.stringify(priceLists));
        localStorage.setItem('formula_app_recipes', JSON.stringify(recipes));
    }, [ingredients, priceLists, recipes]);

    const addIngredient = (ing) => setIngredients([...ingredients, ing]);
    const updateIngredient = (updated) => setIngredients(ingredients.map(i => i.code === updated.code ? updated : i));
    const deleteIngredient = (code) => setIngredients(ingredients.filter(i => i.code !== code));

    const updatePriceList = (month, pricesObj) => setPriceLists({ ...priceLists, [month]: pricesObj });

    const saveRecipe = (recipe) => {
        const timestamp = new Date().toLocaleString();
        if (recipe.id) {
            setRecipes(recipes.map(r => r.id === recipe.id ? { ...recipe, lastModified: timestamp } : r));
        } else {
            setRecipes([...recipes, { ...recipe, id: 'RCP' + Date.now().toString().slice(-4), lastModified: timestamp }]);
        }
    }

    const deleteRecipe = (id) => setRecipes(recipes.filter(r => r.id !== id));

    return (
        <AppContext.Provider value={{
            ingredients, addIngredient, updateIngredient, deleteIngredient,
            priceLists, updatePriceList,
            recipes, saveRecipe, deleteRecipe
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
