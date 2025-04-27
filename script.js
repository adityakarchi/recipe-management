// public/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_BASE_URL = '/api'; // Use relative path for API calls

    // --- DOM Elements ---
    const recipeListSection = document.getElementById('recipe-list-section');
    const recipeFormSection = document.getElementById('recipe-form-section');
    const recipeDetailsSection = document.getElementById('recipe-details-section');
    const recipeListDiv = document.getElementById('recipe-list');
    const noRecipesMessage = document.getElementById('no-recipes-message');
    const recipeForm = document.getElementById('recipe-form');
    const formTitle = document.getElementById('form-title');
    const editRecipeIdInput = document.getElementById('edit-recipe-id');
    const ingredientsListDiv = document.getElementById('ingredients-list');
    const stepsListDiv = document.getElementById('steps-list');
    const addIngredientBtn = document.getElementById('add-ingredient-btn');
    const addStepBtn = document.getElementById('add-step-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const saveFormBtn = document.getElementById('save-form-btn'); // Get save button
    const addRecipeNavBtn = document.getElementById('add-recipe-btn-nav');
    const recipeDetailsContent = document.getElementById('recipe-details-content');
    const backToListBtn = document.getElementById('back-to-list-btn');
    const editRecipeBtn = document.getElementById('edit-recipe-btn');
    const deleteRecipeBtn = document.getElementById('delete-recipe-btn');
    const searchInput = document.getElementById('search-input');
    const loadingIndicator = document.getElementById('loading-indicator');

    // Modal elements
    const confirmationModal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    let modalConfirmBtn = document.getElementById('modal-confirm-btn'); // Use let for reassignment

    // --- Application State ---
    let allRecipes = []; // Cache for all recipes fetched initially
    let currentRecipeIdToDelete = null;
    let currentRecipeIdToEdit = null; // Store ID for edit/delete in details view

    // --- API Helper Function ---
    async function fetchApi(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: response.statusText }));
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            // Handle responses with no content (e.g., DELETE 204)
            if (response.status === 204 || response.headers.get('content-length') === '0') {
                return null; // Or return an empty object/success indicator
            }
            return await response.json();
        } catch (error) {
            console.error('API Fetch Error:', error);
            showModal("API Error", `Failed to communicate with the server: ${error.message}`, true);
            throw error; // Re-throw to allow specific handling if needed
        }
    }

    // --- Core Functions ---

    // Initialize App
    async function initializeApp() {
        showLoading(true);
        try {
            await loadAndRenderRecipes();
            showSection(recipeListSection);
        } catch (error) {
            // Error already shown by fetchApi or loadAndRenderRecipes
            noRecipesMessage.textContent = "Could not load recipes. Please try again later.";
            noRecipesMessage.classList.remove('hidden');
        } finally {
            showLoading(false);
        }
    }

    // Load recipes from API and render list
    async function loadAndRenderRecipes() {
        try {
            showLoading(true);
            allRecipes = await fetchApi('/recipes'); // Fetch all recipes
            renderRecipeList(allRecipes); // Render the full list initially
        } catch (error) {
            console.error("Failed to load recipes:", error);
            // Optionally show an error message in the list area
             recipeListDiv.innerHTML = '<p class="text-red-500 col-span-full text-center">Failed to load recipes.</p>';
             noRecipesMessage.classList.add('hidden'); // Hide the standard 'no recipes' message
        } finally {
             showLoading(false);
        }
    }

    // Show/Hide Loading Indicator
    function showLoading(isLoading) {
        if (isLoading) {
            loadingIndicator.classList.remove('hidden');
            recipeListDiv.classList.add('hidden'); // Hide list while loading
            noRecipesMessage.classList.add('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
            recipeListDiv.classList.remove('hidden'); // Show list again
        }
    }


    // Render the list of recipes
    function renderRecipeList(recipesToRender) {
        recipeListDiv.innerHTML = ''; // Clear existing list
        if (!recipesToRender || recipesToRender.length === 0) {
            noRecipesMessage.textContent = "No recipes found. Add one!"; // Reset message
            noRecipesMessage.classList.remove('hidden');
            recipeListDiv.classList.remove('grid');
        } else {
            noRecipesMessage.classList.add('hidden');
            recipeListDiv.classList.add('grid');

            // Sort by update date, newest first (assuming updatedAt exists)
             recipesToRender.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));


            recipesToRender.forEach(recipe => {
                const card = document.createElement('div');
                card.className = 'recipe-card'; // Use class from style.css
                card.dataset.id = recipe.id;

                const placeholderBg = stringToColor(recipe.name);
                const placeholderText = recipe.name.split(' ').map(w => w[0]).join('').toUpperCase();
                const fallbackUrl = `https://placehold.co/400x250/${placeholderBg}/ffffff?text=${encodeURIComponent(placeholderText)}`;

                card.innerHTML = `
                    <img src="${escapeHtml(recipe.imageUrl) || fallbackUrl}"
                         alt="${escapeHtml(recipe.name)}"
                         onerror="this.onerror=null; this.src='${fallbackUrl}';"
                         loading="lazy">
                    <div class="recipe-card-content">
                        <h3 class="recipe-card-title">${escapeHtml(recipe.name)}</h3>
                        <p class="recipe-card-description">${escapeHtml(recipe.description) || 'No description.'}</p>
                        <div class="recipe-card-details">
                            ${recipe.prepTime ? `Prep: ${recipe.prepTime}m | ` : ''}
                            ${recipe.cookTime ? `Cook: ${recipe.cookTime}m | ` : ''}
                            ${recipe.servings ? `Serves: ${recipe.servings}` : ''}
                            ${(!recipe.prepTime && !recipe.cookTime && !recipe.servings) ? 'Details n/a' : ''}
                        </div>
                    </div>
                `;
                card.addEventListener('click', () => viewRecipeDetails(recipe.id));
                recipeListDiv.appendChild(card);
            });
        }
    }

    // Fetch and render details of a single recipe
    async function viewRecipeDetails(id) {
        showSection(recipeDetailsSection);
        recipeDetailsContent.innerHTML = '<p class="text-center text-gray-500">Loading recipe details...</p>'; // Show loading state
        currentRecipeIdToEdit = id; // Store ID for edit/delete buttons

        try {
            const recipe = await fetchApi(`/recipes/${id}`);
            if (!recipe) {
                 throw new Error("Recipe data not received from server.");
            }
            renderRecipeDetailsContent(recipe); // Separate function to render content
        } catch (error) {
            recipeDetailsContent.innerHTML = `<p class="text-red-500 text-center">Could not load recipe details: ${error.message}</p>`;
            // Hide edit/delete buttons if loading failed
            editRecipeBtn.classList.add('hidden');
            deleteRecipeBtn.classList.add('hidden');
        }
    }

    // Render the actual content for the details view
    function renderRecipeDetailsContent(recipe) {
         const placeholderBg = stringToColor(recipe.name);
         const placeholderText = recipe.name.split(' ').map(w => w[0]).join('').toUpperCase();
         const fallbackUrl = `https://placehold.co/600x400/${placeholderBg}/ffffff?text=${encodeURIComponent(placeholderText)}`;

         recipeDetailsContent.innerHTML = `
            <h2 class="text-3xl font-bold mb-4 text-gray-800">${escapeHtml(recipe.name)}</h2>
            <img src="${escapeHtml(recipe.imageUrl) || fallbackUrl}"
                 alt="${escapeHtml(recipe.name)}"
                 onerror="this.onerror=null; this.src='${fallbackUrl}';"
                 class="w-full h-64 md:h-80 object-cover rounded-lg mb-6 shadow">

            <div class="grid grid-cols-3 gap-4 mb-6 text-center">
                <div class="detail-stat-box">
                    <span class="detail-stat-label">Prep Time</span>
                    <span class="detail-stat-value">${recipe.prepTime ? `${recipe.prepTime} min` : '-'}</span>
                </div>
                <div class="detail-stat-box">
                    <span class="detail-stat-label">Cook Time</span>
                    <span class="detail-stat-value">${recipe.cookTime ? `${recipe.cookTime} min` : '-'}</span>
                </div>
                 <div class="detail-stat-box">
                    <span class="detail-stat-label">Servings</span>
                    <span class="detail-stat-value">${recipe.servings || '-'}</span>
                </div>
            </div>

            ${recipe.description ? `<p class="text-gray-700 mb-6 text-lg leading-relaxed">${escapeHtml(recipe.description)}</p>` : ''}

            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                    <h3 class="detail-section-title">Ingredients</h3>
                    <ul class="detail-list">
                        ${(recipe.ingredients || []).map(ing => `
                            <li class="detail-list-item">
                                <svg class="detail-list-icon" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>
                                <span><span class="font-medium">${escapeHtml(ing.quantity)} ${escapeHtml(ing.unit) || ''}</span> ${escapeHtml(ing.name)}</span>
                            </li>`).join('')}
                    </ul>
                </div>
                <div>
                    <h3 class="detail-section-title">Steps</h3>
                    <ol class="detail-list">
                        ${(recipe.steps || []).map((step, index) => `
                            <li class="detail-list-item">
                                <span class="detail-step-number">${index + 1}</span>
                                <span>${escapeHtml(step)}</span>
                            </li>`).join('')}
                    </ol>
                </div>
            </div>
             <p class="text-xs text-gray-400 mt-8 text-right">Last updated: ${new Date(recipe.updatedAt || Date.now()).toLocaleDateString()}</p>
        `;
         // Ensure edit/delete buttons are visible now that content is loaded
         editRecipeBtn.classList.remove('hidden');
         deleteRecipeBtn.classList.remove('hidden');
    }


    // Show the form for adding a new recipe
    function showAddForm() {
        recipeForm.reset();
        editRecipeIdInput.value = '';
        formTitle.textContent = 'Add New Recipe';
        ingredientsListDiv.innerHTML = '';
        addIngredientField(); // Add one empty ingredient field
        stepsListDiv.innerHTML = '';
        addStepField(); // Add one empty step field
        updateStepNumbers();
        showSection(recipeFormSection);
        document.getElementById('recipe-name').focus(); // Focus first field
    }

    // Fetch recipe data and show the form for editing
    async function showEditForm(id) {
         showSection(recipeFormSection); // Show form section first
         formTitle.textContent = 'Loading for Edit...'; // Indicate loading
         recipeForm.reset(); // Reset form while loading
         ingredientsListDiv.innerHTML = ''; // Clear dynamic fields
         stepsListDiv.innerHTML = '';

        try {
            const recipe = await fetchApi(`/recipes/${id}`);
            if (!recipe) {
                 throw new Error("Recipe data not found.");
            }

            formTitle.textContent = 'Edit Recipe';
            editRecipeIdInput.value = recipe.id;

            // Populate basic fields
            document.getElementById('recipe-name').value = recipe.name || '';
            document.getElementById('recipe-description').value = recipe.description || '';
            document.getElementById('recipe-prep-time').value = recipe.prepTime || '';
            document.getElementById('recipe-cook-time').value = recipe.cookTime || '';
            document.getElementById('recipe-servings').value = recipe.servings || '';
            document.getElementById('recipe-image-url').value = recipe.imageUrl || '';

            // Populate ingredients
            if (recipe.ingredients && recipe.ingredients.length > 0) {
                recipe.ingredients.forEach(ing => addIngredientField(ing.quantity, ing.unit, ing.name));
            } else {
                addIngredientField(); // Add one empty if none exist
            }

            // Populate steps
             if (recipe.steps && recipe.steps.length > 0) {
                recipe.steps.forEach(step => addStepField(step));
            } else {
                addStepField(); // Add one empty if none exist
            }
            updateStepNumbers();

        } catch (error) {
            showModal("Error", `Could not load recipe for editing: ${error.message}`, true);
            showSection(recipeListSection); // Go back to list on error
        }
    }

    // Add a new ingredient input group to the form
    function addIngredientField(quantity = '', unit = '', name = '') {
        const div = document.createElement('div');
        div.className = 'dynamic-field-group';
        div.innerHTML = `
            <input type="text" placeholder="Qty" value="${escapeHtml(quantity)}" class="ingredient-quantity input-field w-1/6">
            <input type="text" placeholder="Unit" value="${escapeHtml(unit)}" class="ingredient-unit input-field w-1/4">
            <input type="text" placeholder="Ingredient Name" value="${escapeHtml(name)}" class="ingredient-name input-field flex-grow" required>
            <button type="button" class="remove-button" title="Remove Ingredient">&times;</button>
        `;
        div.querySelector('.remove-button').addEventListener('click', (e) => {
             const parentGroup = e.target.closest('.dynamic-field-group');
             if (ingredientsListDiv.children.length > 1) {
                parentGroup.remove();
            } else {
                 parentGroup.querySelector('.ingredient-quantity').value = '';
                 parentGroup.querySelector('.ingredient-unit').value = '';
                 parentGroup.querySelector('.ingredient-name').value = '';
                 // Optionally show info modal: showModal("Info", "At least one ingredient field is required.", true);
            }
        });
        ingredientsListDiv.appendChild(div);
    }

     // Add a new step input group to the form
    function addStepField(instruction = '') {
        const div = document.createElement('div');
        div.className = 'dynamic-field-group';
        div.innerHTML = `
            <span class="step-number"></span>
            <input type="text" placeholder="Instruction" value="${escapeHtml(instruction)}" class="step-instruction input-field flex-grow" required>
            <button type="button" class="remove-button" title="Remove Step">&times;</button>
        `;
        div.querySelector('.remove-button').addEventListener('click', (e) => {
             const parentGroup = e.target.closest('.dynamic-field-group');
             if (stepsListDiv.children.length > 1) {
                parentGroup.remove();
                updateStepNumbers();
            } else {
                parentGroup.querySelector('.step-instruction').value = '';
                 // Optionally show info modal: showModal("Info", "At least one step field is required.", true);
            }
        });
        stepsListDiv.appendChild(div);
        updateStepNumbers();
    }

    // Update the step numbers displayed in the form
    function updateStepNumbers() {
        const stepGroups = stepsListDiv.querySelectorAll('.dynamic-field-group');
        stepGroups.forEach((group, index) => {
            group.querySelector('.step-number').textContent = `${index + 1}.`;
        });
    }

    // Handle form submission (Add or Edit via API)
    async function handleFormSubmit(event) {
        event.preventDefault();
        setSaveButtonState(true); // Disable button

        // --- Validation ---
        const recipeNameInput = document.getElementById('recipe-name');
        if (!recipeNameInput.value.trim()) {
            showModal("Validation Error", "Recipe Name is required.", true);
            recipeNameInput.focus();
            setSaveButtonState(false); // Re-enable button
            return;
        }

        // Collect ingredients - ensure at least one valid ingredient
        const ingredients = [];
        let hasValidIngredient = false;
        const ingredientGroups = ingredientsListDiv.querySelectorAll('.dynamic-field-group');
        ingredientGroups.forEach(group => {
            const nameInput = group.querySelector('.ingredient-name');
            const quantity = group.querySelector('.ingredient-quantity').value.trim();
            const unit = group.querySelector('.ingredient-unit').value.trim();
            const name = nameInput.value.trim();
            if (name) {
                ingredients.push({ quantity, unit, name });
                hasValidIngredient = true;
            } else if (ingredientGroups.length > 1 && !quantity && !unit) {
                 group.remove(); // Remove empty optional row
            }
        });
         if (!hasValidIngredient) {
             showModal("Validation Error", "Please add at least one ingredient with a name.", true);
             const firstEmptyIngredient = ingredientsListDiv.querySelector('.ingredient-name:invalid, .ingredient-name[value=""]');
             if (firstEmptyIngredient) firstEmptyIngredient.focus();
             setSaveButtonState(false);
             return;
         }

        // Collect steps - ensure at least one valid step
        const steps = [];
        let hasValidStep = false;
        const stepGroups = stepsListDiv.querySelectorAll('.dynamic-field-group');
        stepGroups.forEach(group => {
            const instructionInput = group.querySelector('.step-instruction');
            const instruction = instructionInput.value.trim();
            if (instruction) {
                steps.push(instruction);
                hasValidStep = true;
            } else if (stepGroups.length > 1) {
                 group.remove(); // Remove empty optional row
                 updateStepNumbers();
            }
        });
         if (!hasValidStep) {
             showModal("Validation Error", "Please add at least one step instruction.", true);
             const firstEmptyStep = stepsListDiv.querySelector('.step-instruction:invalid, .step-instruction[value=""]');
             if(firstEmptyStep) firstEmptyStep.focus();
             setSaveButtonState(false);
             return;
         }
        // --- End Validation ---


        // Prepare recipe data payload
        const recipeData = {
            name: document.getElementById('recipe-name').value.trim(),
            description: document.getElementById('recipe-description').value.trim(),
            prepTime: parseInt(document.getElementById('recipe-prep-time').value) || null,
            cookTime: parseInt(document.getElementById('recipe-cook-time').value) || null,
            servings: parseInt(document.getElementById('recipe-servings').value) || null,
            imageUrl: document.getElementById('recipe-image-url').value.trim() || null,
            ingredients: ingredients,
            steps: steps
        };

        const recipeId = editRecipeIdInput.value ? parseInt(editRecipeIdInput.value) : null;
        const method = recipeId ? 'PUT' : 'POST';
        const endpoint = recipeId ? `/recipes/${recipeId}` : '/recipes';

        try {
            const result = await fetchApi(endpoint, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recipeData)
            });

            console.log("Save result:", result);
            await loadAndRenderRecipes(); // Reload the list to show changes/new item
            showSection(recipeListSection);
            recipeForm.reset();

        } catch (error) {
            // Error message already shown by fetchApi
            console.error("Failed to save recipe:", error);
        } finally {
             setSaveButtonState(false); // Re-enable button
        }
    }

    // Set state of the save button (disabled/enabled)
    function setSaveButtonState(isSaving) {
        if (isSaving) {
            saveFormBtn.disabled = true;
            saveFormBtn.textContent = 'Saving...';
            saveFormBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            saveFormBtn.disabled = false;
            saveFormBtn.textContent = 'Save Recipe';
            saveFormBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }


    // Confirm and delete a recipe via API
    function confirmDeleteRecipe(id) {
        const recipeToDelete = allRecipes.find(r => r.id === id); // Find from cached list
         if (!recipeToDelete) {
             console.error("Recipe to delete not found in cache:", id);
             showModal("Error", "Could not find the recipe to delete.", true);
             return;
         }

         currentRecipeIdToDelete = id; // Store ID for the callback

         showModal(
             "Confirm Deletion",
             `Are you sure you want to delete the recipe "${escapeHtml(recipeToDelete.name)}"? This action cannot be undone.`,
             false,
             async () => { // Async confirmation callback
                 try {
                     await fetchApi(`/recipes/${currentRecipeIdToDelete}`, { method: 'DELETE' });
                     // Remove from local cache and re-render immediately for responsiveness
                     allRecipes = allRecipes.filter(r => r.id !== currentRecipeIdToDelete);
                     renderRecipeList(allRecipes); // Re-render the filtered list
                     showSection(recipeListSection); // Go back to list
                     console.log("Recipe deleted:", currentRecipeIdToDelete);
                 } catch (error) {
                      // Error message already shown by fetchApi
                     console.error("Failed to delete recipe:", error);
                 } finally {
                      currentRecipeIdToDelete = null; // Reset
                 }
             }
         );
    }

    // Filter recipes based on search input (client-side filtering)
    function filterRecipes() {
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (!searchTerm) {
            renderRecipeList(allRecipes); // Show all if search is empty
            return;
        }

        const filteredRecipes = allRecipes.filter(recipe =>
            recipe.name.toLowerCase().includes(searchTerm) ||
            (recipe.description && recipe.description.toLowerCase().includes(searchTerm))
            // Add ingredient search if needed (requires fetching full details or modifying list API)
            // || (recipe.ingredients && recipe.ingredients.some(ing => ing.name.toLowerCase().includes(searchTerm)))
        );
        renderRecipeList(filteredRecipes);
    }

    // Show Confirmation Modal
    function showModal(title, message, infoOnly = false, onConfirm = null) {
        modalTitle.textContent = title;
        modalMessage.innerHTML = message; // Use innerHTML

        const newConfirmBtn = modalConfirmBtn.cloneNode(true);
        modalConfirmBtn.parentNode.replaceChild(newConfirmBtn, modalConfirmBtn);
        modalConfirmBtn = newConfirmBtn; // Update reference

        if (infoOnly) {
            modalConfirmBtn.classList.add('hidden');
            modalCancelBtn.textContent = 'OK';
            modalCancelBtn.onclick = hideModal;
            modalConfirmBtn.onclick = null; // Ensure no action
            // Use secondary button style for OK
            modalCancelBtn.className = 'button button-secondary';
            modalConfirmBtn.className = 'button button-danger hidden'; // Keep base styles but hide
        } else {
            modalConfirmBtn.classList.remove('hidden');
            modalCancelBtn.textContent = 'Cancel';
            modalCancelBtn.onclick = hideModal;
             // Reset styles
             modalCancelBtn.className = 'button button-secondary';
             modalConfirmBtn.className = 'button button-danger'; // Default danger for confirm

            if (onConfirm) {
                modalConfirmBtn.onclick = () => {
                    // No need to hide modal here, it's done in the callback if needed
                    onConfirm();
                    // Hide modal *after* confirm action potentially finishes
                    // Consider adding async/await if onConfirm is async and you want to wait
                    hideModal();
                };
            } else {
                 modalConfirmBtn.onclick = hideModal;
            }
        }

        confirmationModal.classList.add('visible');
        (infoOnly ? modalCancelBtn : modalConfirmBtn).focus();
    }

    // Hide Confirmation Modal
    function hideModal() {
        confirmationModal.classList.remove('visible');
        // It's generally safer to clear the onclick handlers when hiding
        modalConfirmBtn.onclick = null;
        modalCancelBtn.onclick = hideModal; // Reset cancel to just hide
    }

    // Helper function to generate a color from a string
    function stringToColor(str) {
        if (!str) return 'cccccc';
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash;
        }
        let color = '';
        for (let i = 0; i < 3; i++) {
            const value = (hash >> (i * 8)) & 0xFF;
            const lightValue = Math.floor((value + 255 * 2) / 3);
            color += ('00' + lightValue.toString(16)).substr(-2);
        }
        return color;
    }

    // Helper function to escape HTML characters
    function escapeHtml(unsafe) {
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    // Show a specific section and hide others
    function showSection(sectionToShow) {
        [recipeListSection, recipeFormSection, recipeDetailsSection].forEach(section => {
            section.classList.add('hidden');
        });
        sectionToShow.classList.remove('hidden');
        window.scrollTo(0, 0); // Scroll to top
    }

    // --- Event Listeners ---
    addRecipeNavBtn.addEventListener('click', showAddForm);
    cancelFormBtn.addEventListener('click', () => showSection(recipeListSection));
    addIngredientBtn.addEventListener('click', () => addIngredientField());
    addStepBtn.addEventListener('click', () => addStepField());
    recipeForm.addEventListener('submit', handleFormSubmit);
    backToListBtn.addEventListener('click', () => showSection(recipeListSection));
    editRecipeBtn.addEventListener('click', () => {
         if(currentRecipeIdToEdit) showEditForm(currentRecipeIdToEdit);
    });
    deleteRecipeBtn.addEventListener('click', () => {
         if(currentRecipeIdToEdit) confirmDeleteRecipe(currentRecipeIdToEdit);
    });
    searchInput.addEventListener('input', filterRecipes); // Use client-side filtering

    // Modal listeners
    modalCancelBtn.addEventListener('click', hideModal);
    confirmationModal.addEventListener('click', (event) => {
         if (event.target === confirmationModal) hideModal();
     });
    document.addEventListener('keydown', (event) => {
         if (event.key === 'Escape' && confirmationModal.classList.contains('visible')) hideModal();
     });

    // --- Initial Load ---
    initializeApp();

}); // End DOMContentLoaded