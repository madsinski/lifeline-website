"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

type MealCategory = "breakfast" | "lunch" | "dinner" | "snack";
type Difficulty = "easy" | "medium" | "hard";

interface MealSwap {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface Meal {
  id: string;
  name: string;
  description: string;
  category: MealCategory;
  ingredients: string[];
  instructions: string[];
  prep_time_min: number;
  cook_time_min: number;
  servings: number;
  difficulty: Difficulty;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  dietary_tags: string[];
  illustration_url: string;
  video_url: string;
  swaps: MealSwap[];
  created_at: string;
}

const CATEGORIES: MealCategory[] = ["breakfast", "lunch", "dinner", "snack"];
const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];
const DIETARY_TAGS = [
  "high-protein", "vegetarian", "vegan", "gluten-free", "dairy-free",
  "low-carb", "no-cook", "meal-prep",
] as const;

const CATEGORY_COLORS: Record<MealCategory, string> = {
  breakfast: "#F59E0B",
  lunch: "#10B981",
  dinner: "#8B5CF6",
  snack: "#EC4899",
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "#22C55E",
  medium: "#F59E0B",
  hard: "#EF4444",
};

// ── Toast & confirm dialog (same as exercises page) ────────────────────────────

function Toast({ message, type, onClose }: { message: string; type: "success" | "error" | "info"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
      type === "success" ? "bg-green-600 text-white" : type === "info" ? "bg-blue-600 text-white" : "bg-red-600 text-white"
    }`}>{message}</div>
  );
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MealsPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<MealCategory | "all">("all");
  const [difficultyFilter, setDifficultyFilter] = useState<Difficulty | "all">("all");
  const [tagFilter, setTagFilter] = useState<string | "all">("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [editingMeal, setEditingMeal] = useState<Partial<Meal> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [viewingMeal, setViewingMeal] = useState<Meal | null>(null);

  const loadMeals = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("meals").select("*").order("name");
    if (error) {
      setToast({ message: `Failed to load: ${error.message}`, type: "error" });
    } else {
      setMeals((data as Meal[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadMeals(); }, [loadMeals]);

  const filtered = meals.filter((m) => {
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
    if (difficultyFilter !== "all" && m.difficulty !== difficultyFilter) return false;
    if (tagFilter !== "all" && !(m.dietary_tags || []).includes(tagFilter)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const saveMeal = async () => {
    if (!editingMeal) return;
    const { id, created_at, ...rest } = editingMeal as Meal;
    void created_at;
    if (!rest.name?.trim()) { setToast({ message: "Name is required", type: "error" }); return; }
    if (!rest.category) { setToast({ message: "Category is required", type: "error" }); return; }
    if (isCreating) {
      const { error } = await supabase.from("meals").insert([rest]);
      if (error) { setToast({ message: `Create failed: ${error.message}`, type: "error" }); return; }
      setToast({ message: `Created "${rest.name}"`, type: "success" });
    } else {
      const { error } = await supabase.from("meals").update(rest).eq("id", id);
      if (error) { setToast({ message: `Update failed: ${error.message}`, type: "error" }); return; }
      setToast({ message: `Updated "${rest.name}"`, type: "success" });
    }
    setEditingMeal(null);
    setIsCreating(false);
    loadMeals();
  };

  const deleteMeal = async (id: string, name: string) => {
    const { error } = await supabase.from("meals").delete().eq("id", id);
    if (error) { setToast({ message: `Delete failed: ${error.message}`, type: "error" }); return; }
    setToast({ message: `Deleted "${name}"`, type: "success" });
    setConfirmDelete(null);
    loadMeals();
  };

  const startCreate = () => {
    setEditingMeal({
      name: "", description: "", category: "breakfast", ingredients: [""], instructions: [""],
      prep_time_min: 5, cook_time_min: 0, servings: 1, difficulty: "easy",
      calories: null, protein: null, carbs: null, fat: null,
      dietary_tags: [], illustration_url: "", video_url: "", swaps: [],
    });
    setIsCreating(true);
  };

  const startEdit = (meal: Meal) => {
    setEditingMeal({ ...meal });
    setIsCreating(false);
  };

  const toggleTag = (tag: string) => {
    if (!editingMeal) return;
    const tags = editingMeal.dietary_tags || [];
    setEditingMeal({
      ...editingMeal,
      dietary_tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
    });
  };

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meals Library</h1>
          <p className="text-sm text-gray-500 mt-1">{meals.length} meals total · {filtered.length} matching filters</p>
        </div>
        <button onClick={startCreate} className="px-4 py-2 bg-[#10B981] text-white text-sm font-medium rounded-lg hover:bg-[#047857] transition-colors">
          + Add Meal
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or description..."
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as MealCategory | "all")}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value as Difficulty | "all")}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900"
          >
            <option value="all">All difficulty</option>
            {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-900"
          >
            <option value="all">All tags</option>
            {DIETARY_TAGS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Meal grid */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-[#10B981] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm shadow-sm border border-gray-100">
          No meals match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map((meal) => {
            const catColor = CATEGORY_COLORS[meal.category];
            const totalTime = (meal.prep_time_min || 0) + (meal.cook_time_min || 0);
            return (
              <div key={meal.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                <div className="relative aspect-[4/3] bg-gray-100">
                  {meal.illustration_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={meal.illustration_url} alt={meal.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-300">
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span
                      className="px-2 py-0.5 text-[10px] font-semibold text-white rounded-full uppercase tracking-wide"
                      style={{ backgroundColor: catColor }}
                    >
                      {meal.category}
                    </span>
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">{meal.name}</h3>
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1 flex-1">{meal.description}</p>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400">
                    <span>⏱ {totalTime}min</span>
                    {meal.protein != null && <span>· 💪 {meal.protein}g</span>}
                    {meal.calories != null && <span>· 🔥 {meal.calories}kcal</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-2 flex-wrap">
                    {(meal.dietary_tags || []).slice(0, 3).map(t => (
                      <span key={t} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] rounded uppercase font-medium">{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                    <button onClick={() => setViewingMeal(meal)} className="flex-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded">View</button>
                    <button onClick={() => startEdit(meal)} className="flex-1 px-2 py-1 text-xs text-[#10B981] hover:bg-[#10B981]/5 rounded">Edit</button>
                    <button onClick={() => setConfirmDelete({ id: meal.id, name: meal.name })} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded">×</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View modal */}
      {viewingMeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setViewingMeal(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {viewingMeal.illustration_url && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={viewingMeal.illustration_url} alt={viewingMeal.name} className="w-full h-56 object-cover" />
            )}
            <div className="p-6 overflow-y-auto">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{viewingMeal.name}</h2>
                  <p className="text-sm text-gray-500">{viewingMeal.description}</p>
                </div>
                <button onClick={() => setViewingMeal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 my-3">
                <span>⏱ {viewingMeal.prep_time_min}min prep</span>
                <span>🍳 {viewingMeal.cook_time_min}min cook</span>
                <span>🍽 {viewingMeal.servings} serving{viewingMeal.servings !== 1 ? "s" : ""}</span>
                <span>📊 {viewingMeal.difficulty}</span>
              </div>
              {viewingMeal.calories != null && (
                <div className="grid grid-cols-4 gap-2 mb-4 bg-gray-50 rounded-xl p-3">
                  <div className="text-center"><p className="text-xs text-gray-400">Calories</p><p className="text-lg font-bold text-gray-900">{viewingMeal.calories}</p></div>
                  <div className="text-center"><p className="text-xs text-gray-400">Protein</p><p className="text-lg font-bold text-gray-900">{viewingMeal.protein}g</p></div>
                  <div className="text-center"><p className="text-xs text-gray-400">Carbs</p><p className="text-lg font-bold text-gray-900">{viewingMeal.carbs}g</p></div>
                  <div className="text-center"><p className="text-xs text-gray-400">Fat</p><p className="text-lg font-bold text-gray-900">{viewingMeal.fat}g</p></div>
                </div>
              )}
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Ingredients</h3>
                <ul className="space-y-1">
                  {(viewingMeal.ingredients || []).map((ing, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-[#10B981]">•</span>
                      <span>{ing}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Instructions</h3>
                <ol className="space-y-2">
                  {(viewingMeal.instructions || []).map((step, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="font-bold text-[#10B981] flex-shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
              {viewingMeal.dietary_tags && viewingMeal.dietary_tags.length > 0 && (
                <div className="flex gap-1 mt-4 flex-wrap">
                  {viewingMeal.dietary_tags.map(t => (
                    <span key={t} className="px-2 py-1 bg-[#10B981]/10 text-[#10B981] text-xs rounded font-medium">{t}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingMeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => { setEditingMeal(null); setIsCreating(false); }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{isCreating ? "Add Meal" : "Edit Meal"}</h2>
              <button onClick={() => { setEditingMeal(null); setIsCreating(false); }} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name *</label>
                <input
                  type="text"
                  value={editingMeal.name || ""}
                  onChange={(e) => setEditingMeal({ ...editingMeal, name: e.target.value })}
                  placeholder="Greek Yogurt Power Bowl"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none"
                />
              </div>
              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Description</label>
                <input
                  type="text"
                  value={editingMeal.description || ""}
                  onChange={(e) => setEditingMeal({ ...editingMeal, description: e.target.value })}
                  placeholder="One-line summary"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#10B981] outline-none"
                />
              </div>
              {/* Category, Difficulty, Servings */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Category *</label>
                  <select
                    value={editingMeal.category || "breakfast"}
                    onChange={(e) => setEditingMeal({ ...editingMeal, category: e.target.value as MealCategory })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Difficulty</label>
                  <select
                    value={editingMeal.difficulty || "easy"}
                    onChange={(e) => setEditingMeal({ ...editingMeal, difficulty: e.target.value as Difficulty })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                  >
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Servings</label>
                  <input
                    type="number"
                    value={editingMeal.servings || 1}
                    onChange={(e) => setEditingMeal({ ...editingMeal, servings: Number(e.target.value) })}
                    min={1}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Prep time (min)</label>
                  <input
                    type="number"
                    value={editingMeal.prep_time_min || 0}
                    onChange={(e) => setEditingMeal({ ...editingMeal, prep_time_min: Number(e.target.value) })}
                    min={0}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Cook time (min)</label>
                  <input
                    type="number"
                    value={editingMeal.cook_time_min || 0}
                    onChange={(e) => setEditingMeal({ ...editingMeal, cook_time_min: Number(e.target.value) })}
                    min={0}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                </div>
              </div>
              {/* Macros */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Calories</label>
                  <input type="number" value={editingMeal.calories ?? ""} onChange={(e) => setEditingMeal({ ...editingMeal, calories: e.target.value === "" ? null : Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Protein (g)</label>
                  <input type="number" value={editingMeal.protein ?? ""} onChange={(e) => setEditingMeal({ ...editingMeal, protein: e.target.value === "" ? null : Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Carbs (g)</label>
                  <input type="number" value={editingMeal.carbs ?? ""} onChange={(e) => setEditingMeal({ ...editingMeal, carbs: e.target.value === "" ? null : Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fat (g)</label>
                  <input type="number" value={editingMeal.fat ?? ""} onChange={(e) => setEditingMeal({ ...editingMeal, fat: e.target.value === "" ? null : Number(e.target.value) })} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                </div>
              </div>
              {/* Image URL */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Photo URL</label>
                <input
                  type="text"
                  value={editingMeal.illustration_url || ""}
                  onChange={(e) => setEditingMeal({ ...editingMeal, illustration_url: e.target.value })}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                {editingMeal.illustration_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={editingMeal.illustration_url} alt="" className="mt-2 w-full h-32 object-cover rounded-lg" />
                )}
              </div>
              {/* Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Ingredients</label>
                  <button
                    onClick={() => setEditingMeal({ ...editingMeal, ingredients: [...(editingMeal.ingredients || []), ""] })}
                    className="text-xs text-[#10B981] hover:underline"
                  >+ Add</button>
                </div>
                {(editingMeal.ingredients || [""]).map((ing, i) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <input
                      type="text"
                      value={ing}
                      onChange={(e) => {
                        const updated = [...(editingMeal.ingredients || [""])];
                        updated[i] = e.target.value;
                        setEditingMeal({ ...editingMeal, ingredients: updated });
                      }}
                      placeholder={`Ingredient ${i + 1}`}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        const updated = (editingMeal.ingredients || []).filter((_, j) => j !== i);
                        setEditingMeal({ ...editingMeal, ingredients: updated });
                      }}
                      className="px-2 text-red-400 hover:text-red-600"
                    >×</button>
                  </div>
                ))}
              </div>
              {/* Instructions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Instructions</label>
                  <button
                    onClick={() => setEditingMeal({ ...editingMeal, instructions: [...(editingMeal.instructions || []), ""] })}
                    className="text-xs text-[#10B981] hover:underline"
                  >+ Add step</button>
                </div>
                {(editingMeal.instructions || [""]).map((step, i) => (
                  <div key={i} className="flex gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-400 mt-2">{i + 1}.</span>
                    <textarea
                      value={step}
                      onChange={(e) => {
                        const updated = [...(editingMeal.instructions || [""])];
                        updated[i] = e.target.value;
                        setEditingMeal({ ...editingMeal, instructions: updated });
                      }}
                      placeholder={`Step ${i + 1}`}
                      rows={2}
                      className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm resize-y"
                    />
                    <button
                      onClick={() => {
                        const updated = (editingMeal.instructions || []).filter((_, j) => j !== i);
                        setEditingMeal({ ...editingMeal, instructions: updated });
                      }}
                      className="px-2 text-red-400 hover:text-red-600"
                    >×</button>
                  </div>
                ))}
              </div>
              {/* Dietary tags */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dietary tags</label>
                <div className="flex flex-wrap gap-2">
                  {DIETARY_TAGS.map(t => {
                    const isOn = (editingMeal.dietary_tags || []).includes(t);
                    return (
                      <button
                        key={t}
                        onClick={() => toggleTag(t)}
                        className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                          isOn ? "bg-[#10B981] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Approved swaps */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Approved swaps
                    <span className="ml-2 text-[10px] font-normal text-gray-400 normal-case tracking-normal">
                      Alternative meals client can log instead
                    </span>
                  </label>
                  <button
                    onClick={() => setEditingMeal({
                      ...editingMeal,
                      swaps: [...(editingMeal.swaps || []), { name: "", kcal: 0, protein: 0, carbs: 0, fat: 0 }],
                    })}
                    className="text-xs text-[#10B981] hover:underline"
                  >+ Add swap</button>
                </div>
                {(editingMeal.swaps || []).length === 0 && (
                  <p className="text-xs text-gray-300 italic py-2">No swaps defined. Client will see an option to describe a custom meal.</p>
                )}
                {(editingMeal.swaps || []).map((swap, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <input
                      type="text"
                      value={swap.name}
                      onChange={(e) => {
                        const updated = [...(editingMeal.swaps || [])];
                        updated[i] = { ...updated[i], name: e.target.value };
                        setEditingMeal({ ...editingMeal, swaps: updated });
                      }}
                      placeholder="e.g. Eggs and toast"
                      className="col-span-4 px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                    />
                    {(['kcal', 'protein', 'carbs', 'fat'] as const).map((field) => (
                      <input
                        key={field}
                        type="number"
                        value={swap[field] || 0}
                        onChange={(e) => {
                          const updated = [...(editingMeal.swaps || [])];
                          updated[i] = { ...updated[i], [field]: Number(e.target.value) || 0 };
                          setEditingMeal({ ...editingMeal, swaps: updated });
                        }}
                        placeholder={field}
                        title={field}
                        className="col-span-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm text-center"
                      />
                    ))}
                    <div className="col-span-3 flex items-center gap-1.5 text-[10px] text-gray-400">
                      <span>kcal</span><span>·</span><span>P</span><span>·</span><span>C</span><span>·</span><span>F</span>
                    </div>
                    <button
                      onClick={() => {
                        const updated = (editingMeal.swaps || []).filter((_, j) => j !== i);
                        setEditingMeal({ ...editingMeal, swaps: updated });
                      }}
                      className="col-span-1 text-red-400 hover:text-red-600 text-lg"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button onClick={() => { setEditingMeal(null); setIsCreating(false); }} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button onClick={saveMeal} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#10B981] hover:bg-[#047857] rounded-lg">{isCreating ? "Create" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <ConfirmDialog
          title="Delete meal"
          message={`Are you sure you want to delete "${confirmDelete.name}"? This cannot be undone.`}
          onConfirm={() => deleteMeal(confirmDelete.id, confirmDelete.name)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}
