// server.js

// Load environment variables from .env file
require('dotenv').config();

// Import required modules
const express = require('express');
const mysql = require('mysql2/promise'); // Using promise-based version for async/await
const cors = require('cors');
const path = require('path'); // Import path module

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing for frontend requests
app.use(express.json()); // Parse incoming JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request bodies

// --- Serve Static Frontend Files ---
// Serve files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// --- Database Connection Pool ---
const dbPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// --- Helper Function for Database Operations ---
async function executeQuery(sql, params = []) {
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [results] = await connection.query(sql, params);
        return results;
    } catch (error) {
        console.error("Database Query Error:", error);
        throw new Error('Database operation failed');
    } finally {
        if (connection) connection.release();
    }
}

// --- API Routes ---

// GET /api/recipes - Fetch all recipes (simplified version)
app.get('/api/recipes', async (req, res) => {
    try {
        const recipes = await executeQuery(
            'SELECT recipe_id, name, description, prep_time_minutes, cook_time_minutes, servings, image_url, updated_at FROM Recipes ORDER BY updated_at DESC'
        );
        const formattedRecipes = recipes.map(r => ({
             id: r.recipe_id,
             name: r.name,
             description: r.description,
             prepTime: r.prep_time_minutes,
             cookTime: r.cook_time_minutes,
             servings: r.servings,
             imageUrl: r.image_url,
             updatedAt: r.updated_at
        }));
        res.json(formattedRecipes);
    } catch (error) {
        console.error("Error fetching recipes:", error);
        res.status(500).json({ message: "Failed to fetch recipes" });
    }
});

// GET /api/recipes/:id - Fetch a single recipe with details
app.get('/api/recipes/:id', async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
        return res.status(400).json({ message: "Invalid recipe ID" });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const [recipeRows] = await connection.query('SELECT * FROM Recipes WHERE recipe_id = ?', [recipeId]);
        if (recipeRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Recipe not found" });
        }
        const dbRecipe = recipeRows[0];

        const [ingredientRows] = await connection.query(
            `SELECT ri.quantity, ri.unit, i.name
             FROM RecipeIngredients ri
             JOIN Ingredients i ON ri.ingredient_id = i.ingredient_id
             WHERE ri.recipe_id = ?`,
            [recipeId]
        );

        const [stepRows] = await connection.query(
            'SELECT instruction FROM Steps WHERE recipe_id = ? ORDER BY step_number ASC',
            [recipeId]
        );

        await connection.commit();

        const recipeDetails = {
            id: dbRecipe.recipe_id,
            name: dbRecipe.name,
            description: dbRecipe.description,
            prepTime: dbRecipe.prep_time_minutes,
            cookTime: dbRecipe.cook_time_minutes,
            servings: dbRecipe.servings,
            imageUrl: dbRecipe.image_url,
            ingredients: ingredientRows.map(ing => ({ quantity: ing.quantity, unit: ing.unit, name: ing.name })),
            steps: stepRows.map(step => step.instruction),
            createdAt: dbRecipe.created_at,
            updatedAt: dbRecipe.updated_at
        };
        res.json(recipeDetails);

    } catch (error) {
        console.error(`Error fetching recipe ${recipeId}:`, error);
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Failed to fetch recipe details" });
    } finally {
        if (connection) connection.release();
    }
});

// POST /api/recipes - Create a new recipe
app.post('/api/recipes', async (req, res) => {
    const { name, description, prepTime, cookTime, servings, imageUrl, ingredients, steps } = req.body;

    if (!name || !ingredients || ingredients.length === 0 || !steps || steps.length === 0) {
        return res.status(400).json({ message: "Missing required fields (name, ingredients, steps)" });
    }
    if (!Array.isArray(ingredients) || !Array.isArray(steps)) {
         return res.status(400).json({ message: "Ingredients and steps must be arrays" });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const recipeSql = `INSERT INTO Recipes (name, description, prep_time_minutes, cook_time_minutes, servings, image_url) VALUES (?, ?, ?, ?, ?, ?)`;
        const [recipeResult] = await connection.query(recipeSql, [name, description || null, prepTime || null, cookTime || null, servings || null, imageUrl || null]);
        const newRecipeId = recipeResult.insertId;

        for (const ing of ingredients) {
            if (!ing.name) continue;
            let [[existingIngredient]] = await connection.query('SELECT ingredient_id FROM Ingredients WHERE name = ?', [ing.name]);
            let ingredientId;
            if (existingIngredient) {
                ingredientId = existingIngredient.ingredient_id;
            } else {
                const [newIngResult] = await connection.query('INSERT INTO Ingredients (name) VALUES (?)', [ing.name]);
                ingredientId = newIngResult.insertId;
            }
            const linkSql = `INSERT INTO RecipeIngredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)`;
            await connection.query(linkSql, [newRecipeId, ingredientId, ing.quantity || '', ing.unit || null]);
        }

        for (let i = 0; i < steps.length; i++) {
            if (!steps[i]) continue;
            const stepSql = `INSERT INTO Steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)`;
            await connection.query(stepSql, [newRecipeId, i + 1, steps[i]]);
        }

        await connection.commit();
        const [newRecipeDetails] = await connection.query('SELECT recipe_id, name, description, prep_time_minutes, cook_time_minutes, servings, image_url, updated_at FROM Recipes WHERE recipe_id = ?', [newRecipeId]);

        res.status(201).json({
            id: newRecipeId,
            message: "Recipe created successfully",
            recipe: {
                id: newRecipeDetails[0].recipe_id,
                name: newRecipeDetails[0].name,
                description: newRecipeDetails[0].description,
                prepTime: newRecipeDetails[0].prep_time_minutes,
                cookTime: newRecipeDetails[0].cook_time_minutes,
                servings: newRecipeDetails[0].servings,
                imageUrl: newRecipeDetails[0].image_url,
                updatedAt: newRecipeDetails[0].updated_at
            }
         });

    } catch (error) {
        console.error("Error creating recipe:", error);
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Failed to create recipe" });
    } finally {
        if (connection) connection.release();
    }
});

// PUT /api/recipes/:id - Update an existing recipe
app.put('/api/recipes/:id', async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
        return res.status(400).json({ message: "Invalid recipe ID" });
    }
    const { name, description, prepTime, cookTime, servings, imageUrl, ingredients, steps } = req.body;

    if (!name || !ingredients || ingredients.length === 0 || !steps || steps.length === 0) {
        return res.status(400).json({ message: "Missing required fields (name, ingredients, steps)" });
    }
     if (!Array.isArray(ingredients) || !Array.isArray(steps)) {
         return res.status(400).json({ message: "Ingredients and steps must be arrays" });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const recipeSql = `UPDATE Recipes SET name = ?, description = ?, prep_time_minutes = ?, cook_time_minutes = ?, servings = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE recipe_id = ?`;
        const [recipeResult] = await connection.query(recipeSql, [name, description || null, prepTime || null, cookTime || null, servings || null, imageUrl || null, recipeId]);

        if (recipeResult.affectedRows === 0) {
             await connection.rollback();
             return res.status(404).json({ message: "Recipe not found for update" });
        }

        await connection.query('DELETE FROM RecipeIngredients WHERE recipe_id = ?', [recipeId]);
        await connection.query('DELETE FROM Steps WHERE recipe_id = ?', [recipeId]);

        for (const ing of ingredients) {
             if (!ing.name) continue;
             let [[existingIngredient]] = await connection.query('SELECT ingredient_id FROM Ingredients WHERE name = ?', [ing.name]);
             let ingredientId;
             if (existingIngredient) {
                 ingredientId = existingIngredient.ingredient_id;
             } else {
                 const [newIngResult] = await connection.query('INSERT INTO Ingredients (name) VALUES (?)', [ing.name]);
                 ingredientId = newIngResult.insertId;
             }
             const linkSql = `INSERT INTO RecipeIngredients (recipe_id, ingredient_id, quantity, unit) VALUES (?, ?, ?, ?)`;
             await connection.query(linkSql, [recipeId, ingredientId, ing.quantity || '', ing.unit || null]);
        }

        for (let i = 0; i < steps.length; i++) {
             if (!steps[i]) continue;
             const stepSql = `INSERT INTO Steps (recipe_id, step_number, instruction) VALUES (?, ?, ?)`;
             await connection.query(stepSql, [recipeId, i + 1, steps[i]]);
        }

        await connection.commit();
        const [updatedRecipeDetails] = await connection.query('SELECT recipe_id, name, description, prep_time_minutes, cook_time_minutes, servings, image_url, updated_at FROM Recipes WHERE recipe_id = ?', [recipeId]);
        res.json({
             id: recipeId,
             message: "Recipe updated successfully",
             recipe: {
                id: updatedRecipeDetails[0].recipe_id,
                name: updatedRecipeDetails[0].name,
                description: updatedRecipeDetails[0].description,
                prepTime: updatedRecipeDetails[0].prep_time_minutes,
                cookTime: updatedRecipeDetails[0].cook_time_minutes,
                servings: updatedRecipeDetails[0].servings,
                imageUrl: updatedRecipeDetails[0].image_url,
                updatedAt: updatedRecipeDetails[0].updated_at
             }
         });

    } catch (error) {
        console.error(`Error updating recipe ${recipeId}:`, error);
        if (connection) await connection.rollback();
        res.status(500).json({ message: "Failed to update recipe" });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE /api/recipes/:id - Delete a recipe
app.delete('/api/recipes/:id', async (req, res) => {
    const recipeId = parseInt(req.params.id);
    if (isNaN(recipeId)) {
        return res.status(400).json({ message: "Invalid recipe ID" });
    }

    try {
        const sql = 'DELETE FROM Recipes WHERE recipe_id = ?';
        const result = await executeQuery(sql, [recipeId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Recipe not found for deletion" });
        }
        res.status(200).json({ message: "Recipe deleted successfully" });

    } catch (error) {
        console.error(`Error deleting recipe ${recipeId}:`, error);
        res.status(500).json({ message: "Failed to delete recipe" });
    }
});

// --- Fallback for non-API routes (serve index.html) ---
// This ensures that refreshing the page on a frontend route still works
app.get('*', (req, res, next) => {
  // If the request is not for an API route, serve the index.html
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    // If it is an API route but didn't match above, let it 404 or be handled by error handler
    next();
  }
});


// --- Global Error Handler ---
app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack || err);
    // Avoid sending stack trace in production
    res.status(500).json({ message: 'Something went wrong on the server!' });
});

// --- Start Server ---
app.listen(port, () => {
    console.log(`Backend server running at http://localhost:${port}`);
    dbPool.query('SELECT 1')
        .then(() => console.log('Database connected successfully.'))
        .catch(err => console.error('Database connection failed:', err));
});