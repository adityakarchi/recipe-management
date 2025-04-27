-- SQL statements to create the tables for the Recipe Management database.
-- Run this in your MySQL database (e.g., named 'recipe_db').

-- Optional: Users Table (If implementing user accounts)
-- CREATE TABLE Users (
--     user_id INT AUTO_INCREMENT PRIMARY KEY,
--     username VARCHAR(100) NOT NULL UNIQUE,
--     email VARCHAR(255) UNIQUE,
--     password_hash VARCHAR(255) NOT NULL, -- Store hashed passwords, never plain text!
--     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );

-- Recipes Table
CREATE TABLE Recipes (
    recipe_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    prep_time_minutes INT,
    cook_time_minutes INT,
    servings INT,
    image_url VARCHAR(512) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    -- user_id INT NULL, -- Uncomment if using Users table
    -- FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE SET NULL -- Or ON DELETE CASCADE
);

-- Ingredients Table
CREATE TABLE Ingredients (
    ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

-- RecipeIngredients Junction Table
CREATE TABLE RecipeIngredients (
    recipe_ingredient_id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity VARCHAR(50) NOT NULL,
    unit VARCHAR(50) NULL,
    FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES Ingredients(ingredient_id) ON DELETE CASCADE
);

-- Steps Table
CREATE TABLE Steps (
    step_id INT AUTO_INCREMENT PRIMARY KEY,
    recipe_id INT NOT NULL,
    step_number INT NOT NULL,
    instruction TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE
);

-- Optional: Categories Table
-- CREATE TABLE Categories (
--     category_id INT AUTO_INCREMENT PRIMARY KEY,
--     name VARCHAR(100) NOT NULL UNIQUE
-- );

-- Optional: RecipeCategories Junction Table
-- CREATE TABLE RecipeCategories (
--     recipe_category_id INT AUTO_INCREMENT PRIMARY KEY,
--     recipe_id INT NOT NULL,
--     category_id INT NOT NULL,
--     FOREIGN KEY (recipe_id) REFERENCES Recipes(recipe_id) ON DELETE CASCADE,
--     FOREIGN KEY (category_id) REFERENCES Categories(category_id) ON DELETE CASCADE
-- );

-- --- INDEXES for Performance ---
-- CREATE INDEX idx_recipe_user ON Recipes(user_id); -- If using users
CREATE INDEX idx_ri_recipe ON RecipeIngredients(recipe_id);
CREATE INDEX idx_ri_ingredient ON RecipeIngredients(ingredient_id);
CREATE INDEX idx_step_recipe ON Steps(recipe_id);
-- CREATE INDEX idx_rc_recipe ON RecipeCategories(recipe_id); -- If using categories
-- CREATE INDEX idx_rc_category ON RecipeCategories(category_id); -- If using categories
CREATE INDEX idx_recipe_name ON Recipes(name);
CREATE INDEX idx_ingredient_name ON Ingredients(name);
-- CREATE INDEX idx_category_name ON Categories(name); -- If using categories
