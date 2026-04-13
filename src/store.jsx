import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from './firebase';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    setPersistence,
    browserSessionPersistence
} from 'firebase/auth';
import {
    doc,
    setDoc,
    getDoc,
    onSnapshot
} from 'firebase/firestore';

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
    const [ingredients, setIngredients] = useState([]);
    const [priceLists, setPriceLists] = useState({});
    const [recipes, setRecipes] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Listen to Auth State
    useEffect(() => {
        setPersistence(auth, browserSessionPersistence)
            .then(() => {
                const unsubscribe = onAuthStateChanged(auth, (user) => {
                    setCurrentUser(user);
                    if (!user) {
                        setIngredients(defaultIngredients);
                        setPriceLists(defaultPrices);
                        setRecipes([]);
                        setLoading(false);
                    }
                });
                return unsubscribe;
            })
            .catch((error) => {
                console.error("Auth persistence error:", error);
                setLoading(false);
            });
    }, []);

    // Listen to Firestore Data when user is logged in
    useEffect(() => {
        if (!currentUser) return;

        const docRef = doc(db, 'users_data', currentUser.uid);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setIngredients(data.ingredients || defaultIngredients);
                setPriceLists(data.priceLists || defaultPrices);
                setRecipes(data.recipes || []);
            } else {
                // Initialize default data for new user
                saveToCloud(defaultIngredients, defaultPrices, []);
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [currentUser]);

    const saveToCloud = async (newIng, newPrices, newRecipes) => {
        if (!currentUser) return;
        try {
            await setDoc(doc(db, 'users_data', currentUser.uid), {
                ingredients: newIng || ingredients,
                priceLists: newPrices || priceLists,
                recipes: newRecipes || recipes,
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error saving data to cloud:", error);
        }
    };

    const addIngredient = (ing) => {
        const updated = [...ingredients, ing];
        setIngredients(updated);
        saveToCloud(updated, null, null);
    };

    const updateIngredient = (oldCode, updatedIng) => {
        const updated = ingredients.map(i => i.code === oldCode ? updatedIng : i);
        setIngredients(updated);
        saveToCloud(updated, null, null);
    };

    const deleteIngredient = (code) => {
        const updated = ingredients.filter(i => i.code !== code);
        setIngredients(updated);
        saveToCloud(updated, null, null);
    };

    const updatePriceList = (month, pricesObj) => {
        const updated = { ...priceLists, [month]: pricesObj };
        setPriceLists(updated);
        saveToCloud(null, updated, null);
    };

    const saveRecipe = (recipe) => {
        const timestamp = new Date().toLocaleString();
        let updatedRecipes;
        if (recipe.id) {
            updatedRecipes = recipes.map(r => r.id === recipe.id ? { ...recipe, lastModified: timestamp } : r);
        } else {
            updatedRecipes = [...recipes, { ...recipe, id: 'RCP' + Date.now().toString().slice(-4), lastModified: timestamp }];
        }
        setRecipes(updatedRecipes);
        saveToCloud(null, null, updatedRecipes);
    };

    const deleteRecipe = (id) => {
        const updated = recipes.filter(r => r.id !== id);
        setRecipes(updated);
        saveToCloud(null, null, updated);
    };

    const login = async (email, password) => {
        try {
            // Firebase requires an email format. If user enters 'admin', we'll treat it as email if needed or just use as is
            const userEmail = email.includes('@') ? email : `${email}@formula.app`;
            await signInWithEmailAndPassword(auth, userEmail, password);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    const register = async (email, password) => {
        try {
            const userEmail = email.includes('@') ? email : `${email}@formula.app`;
            await createUserWithEmailAndPassword(auth, userEmail, password);
            return { success: true };
        } catch (error) {
            return { success: false, message: error.message };
        }
    };

    const logout = () => signOut(auth);

    return (
        <AppContext.Provider value={{
            ingredients, addIngredient, updateIngredient, deleteIngredient,
            priceLists, updatePriceList,
            recipes, saveRecipe, deleteRecipe,
            currentUser, login, register, logout,
            loading
        }}>
            {!loading && children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => useContext(AppContext);
