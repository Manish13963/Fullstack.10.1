import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged 
} from 'firebase/auth';
import { 
    getFirestore, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    collection,
    setLogLevel
} from 'firebase/firestore';

// --- Firebase Config (pulled from global vars) ---
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// --- Firebase Initialization ---
let app, db, auth;
try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    setLogLevel('Debug'); // Show detailed logs in the console
} catch (e) {
    console.error("Error initializing Firebase:", e);
}

// --- 1. To-Do Item Component ---
// A separate component to render a single todo item
// This keeps the main App component cleaner
function TodoItem({ todo, onToggle, onDelete }) {
    const handleToggle = () => {
        onToggle(todo.id, todo.completed);
    };

    const handleDelete = () => {
        onDelete(todo.id);
    };

    // Use Tailwind classes just like in the HTML
    // Conditionally apply 'completed' class
    const textClasses = `flex-1 ${todo.completed ? 'line-through text-gray-400' : ''}`;

    return (
        <li className="flex items-center justify-between bg-gray-50 p-3 rounded-md shadow-sm">
            <div className="flex items-center">
                <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={handleToggle}
                    className="form-checkbox h-5 w-5 text-blue-600 rounded mr-3 focus:ring-blue-500"
                />
                <span className={textClasses}>
                    {todo.text}
                </span>
            </div>
            <button
                onClick={handleDelete}
                className="px-3 py-1 bg-red-500 text-white text-sm font-semibold rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
                Delete
            </button>
        </li>
    );
}

// --- 2. Main App Component ---
export default function App() {
    // --- React State ---
    const [todos, setTodos] = useState([]); // Stores the list of todos
    const [newTodo, setNewTodo] = useState(''); // Stores the value of the input field
    const [loading, setLoading] = useState(true); // Shows loading message
    const [userId, setUserId] = useState(null); // Stores the user's ID
    const [authReady, setAuthReady] = useState(false); // Tracks if auth has loaded

    // --- 2.1. Authentication Effect ---
    // Runs once on component mount to set up auth
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // User is signed in
                setUserId(user.uid);
                setAuthReady(true);
            } else {
                // User is signed out, let's sign them in
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(auth, initialAuthToken);
                    } else {
                        await signInAnonymously(auth);
                    }
                } catch (e) {
                    console.error("Error signing in:", e);
                    setAuthReady(true); // Auth failed, but we're "ready"
                }
            }
        });

        // Cleanup function
        return () => unsubscribe();
    }, []);

    // --- 2.2. Data Fetching Effect (READ) ---
    // Runs when auth is ready and we have a userId
    useEffect(() => {
        // Don't run until we have a user ID
        if (!authReady || !userId) return;

        const todosCollection = collection(db, 'artifacts', appId, 'users', userId, 'todos');
        
        // onSnapshot creates a real-time listener
        const unsubscribe = onSnapshot(todosCollection, (querySnapshot) => {
            const todosData = [];
            querySnapshot.forEach((doc) => {
                // Get doc data and include the document ID
                todosData.push({ id: doc.id, ...doc.data() });
            });
            setTodos(todosData); // Update React state
            setLoading(false); // Hide loading message
        }, (error) => {
            console.error("Error listening for todos:", error);
            setLoading(false);
        });

        // Cleanup function: Unsubscribe when component unmounts
        // or when userId changes
        return () => unsubscribe();

    }, [authReady, userId]); // Dependencies: Re-run if authReady or userId change

    // --- 2.3. CREATE (C in CRUD) ---
    const handleAddTodo = async (e) => {
        e.preventDefault(); // Stop form from reloading page
        const text = newTodo.trim();

        if (text && userId) {
            try {
                // addDoc creates a new document in the collection
                await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'todos'), {
                    text: text,
                    completed: false
                });
                setNewTodo(''); // Clear the input field
            } catch (e) {
                console.error("Error adding document: ", e);
            }
        }
    };

    // --- 2.4. UPDATE (U in CRUD) ---
    // Use useCallback to prevent re-creating function on every render
    const handleToggleTodo = useCallback(async (id, currentCompleted) => {
        if (!userId) return;
        const docRef = doc(db, 'artifacts', appId, 'users', userId, 'todos', id);
        try {
            // updateDoc modifies an existing document
            await updateDoc(docRef, {
                completed: !currentCompleted // Toggle the value
            });
        } catch (e) {
            console.error("Error updating document: ", e);
        }
    }, [userId]); // Dependency:
    
    // --- 2.5. DELETE (D in CRUD) ---
    const handleDeleteTodo = useCallback(async (id) => {
        if (!userId) return;
        const docRef = doc(db, 'artifacts', appId, 'users', userId, 'todos', id);
        try {
            // deleteDoc removes a document from the database
            await deleteDoc(docRef);
        } catch (e) {
            console.error("Error deleting document: ", e);
        }
    }, [userId]); // Dependency:
    
    // --- 2.6. Render JSX ---
    return (
        <div className="bg-gray-100 min-h-screen py-12 px-4" style={{ fontFamily: 'Inter, sans-serif' }}>
            <div className="max-w-md mx-auto bg-white rounded-lg shadow-xl p-6">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">
                    My Full Stack To-Do List (React)
                </h1>
                
                {/* User ID Display */}
                <div className="mb-4 p-2 bg-gray-50 rounded-md text-center">
                    <span className="text-xs text-gray-500">Your User ID (for demo):</span>
                    <p className="text-sm font-medium text-gray-700 break-all">
                        {userId ? userId : 'Connecting...'}
                    </p>
                </div>

                {/* CREATE Form */}
                <form onSubmit={handleAddTodo} className="flex gap-3 mb-4">
                    <input 
                        type="text" 
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        placeholder="Add a new task..." 
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                    />
                    <button 
                        type="submit" 
                        className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Add
                    </button>
                </form>

                {/* Loading Message */}
                {loading && (
                    <p className="text-center text-gray-500">Loading your tasks...</p>
                )}

                {/* READ List */}
                <ul className="space-y-3">
                    {!loading && todos.length === 0 && (
                         <p className="text-center text-gray-500">No tasks yet. Add one!</p>
                    )}
                    {todos.map((todo) => (
                        <TodoItem 
                            key={todo.id} 
                            todo={todo}
                            onToggle={handleToggleTodo}
                            onDelete={handleDeleteTodo}
                        />
                    ))}
                </ul>
            </div>
        </div>
    );
}
