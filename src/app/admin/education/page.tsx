"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  sampleCourses,
  sampleSnippets,
  type Course,
  type CourseCategory,
  type Module,
  type QuizQuestion,
  type SnippetWeek,
  type DailySnippet,
} from "./sample-data";

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const weekRanges = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5", "Week 6", "Week 7", "Week 8"];

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function createEmptyModule(): Module {
  return {
    id: makeId(),
    title: "New Module",
    content: "",
    readingTime: 5,
    imageUrl: "",
    videoUrl: "",
    quizQuestions: [],
  };
}

function createEmptyQuiz(): QuizQuestion {
  return {
    id: makeId(),
    question: "",
    options: ["", "", "", ""],
    correctIndex: 0,
  };
}

function createEmptySnippets(): SnippetWeek[] {
  return weekRanges.map((wr) => ({
    weekRange: wr,
    days: Array.from({ length: 7 }, () => ({ title: "", bullets: ["", "", ""] })),
  }));
}

// Toast component
function Toast({ message, type, onClose }: { message: string; type: "success" | "error"; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 ${
      type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
    }`}>
      {type === "success" ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      {message}
    </div>
  );
}

// Snippet preview component
function SnippetPreview({ snippet }: { snippet: DailySnippet }) {
  return (
    <div className="bg-gray-900 rounded-xl p-3 w-[200px]">
      <div className="bg-white rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-800 mb-1.5">{snippet.title || "Untitled"}</p>
        <ul className="space-y-1">
          {snippet.bullets.filter(Boolean).map((b, i) => (
            <li key={i} className="text-[10px] text-gray-600 flex items-start gap-1.5">
              <span className="w-1 h-1 bg-[#20c858] rounded-full mt-1 flex-shrink-0" />
              <span>{b}</span>
            </li>
          ))}
          {snippet.bullets.filter(Boolean).length === 0 && (
            <li className="text-[10px] text-gray-300 italic">No content</li>
          )}
        </ul>
      </div>
    </div>
  );
}

export default function EducationPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [snippetWeeks, setSnippetWeeks] = useState<SnippetWeek[]>(createEmptySnippets());
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [expandedQuiz, setExpandedQuiz] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [activeSection, setActiveSection] = useState<"courses" | "snippets">("courses");
  const [eduCategoryFilter, setEduCategoryFilter] = useState<CourseCategory | "all">("all");
  const [previewModule, setPreviewModule] = useState<string | null>(null);
  const [snippetWeekIdx, setSnippetWeekIdx] = useState(0);
  const [snippetPreviewDay, setSnippetPreviewDay] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFromSupabase = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("education_courses")
        .select("*")
        .order("created_at", { ascending: true });
      if (data && data.length > 0) {
        const parsed: Course[] = data.map((row: Record<string, string>) => {
          const modules = JSON.parse(row.modules || "[]");
          return {
            id: row.id,
            name: row.name,
            description: row.description || "",
            coverImageUrl: row.cover_image_url || "",
            category: (row.category || "exercise") as CourseCategory,
            difficulty: (row.difficulty || "Beginner") as Course["difficulty"],
            estimatedDuration: row.estimated_duration || "",
            modules: modules.map((m: Record<string, unknown>) => ({
              id: m.id || makeId(),
              title: m.title || "",
              content: m.content || m.description || "",
              readingTime: m.readingTime || 5,
              imageUrl: (m.imageUrl as string) || "",
              videoUrl: (m.videoUrl as string) || "",
              quizQuestions: m.quizQuestions || [],
            })),
          };
        });
        setCourses(parsed);
      }
    } catch {
      // Table may not exist yet
    }

    try {
      const { data: snippetData } = await supabase
        .from("education_snippets")
        .select("*")
        .order("created_at", { ascending: true });
      if (snippetData && snippetData.length > 0) {
        const parsed: SnippetWeek[] = snippetData.map((row: Record<string, string>) => ({
          weekRange: row.week_range,
          days: JSON.parse(row.days || "[]"),
        }));
        if (parsed.length === weekRanges.length) {
          setSnippetWeeks(parsed);
        }
      }
    } catch {
      // Table may not exist yet
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFromSupabase();
  }, [loadFromSupabase]);

  const update = (updated: Course[]) => {
    setCourses(updated);
    setDirty(true);
  };

  const updateSnippets = (updated: SnippetWeek[]) => {
    setSnippetWeeks(updated);
    setDirty(true);
  };

  const loadSampleCourses = () => {
    setCourses(sampleCourses.map(c => ({ ...c, id: makeId(), modules: c.modules.map(m => ({ ...m, id: makeId() })) })));
    setDirty(true);
    setToast({ message: "Loaded sample courses — save to persist", type: "success" });
  };

  const loadSampleSnippets = () => {
    setSnippetWeeks(sampleSnippets.map(sw => ({ ...sw })));
    setDirty(true);
    setToast({ message: "Loaded sample snippets — save to persist", type: "success" });
  };

  const addCourse = () => {
    update([
      ...courses,
      {
        id: makeId(),
        name: "New Course",
        description: "",
        coverImageUrl: "",
        category: "exercise" as CourseCategory,
        difficulty: "Beginner",
        estimatedDuration: "",
        modules: [],
      },
    ]);
  };

  const deleteCourse = (id: string) => {
    update(courses.filter((c) => c.id !== id));
  };

  const updateCourse = (id: string, field: keyof Course, value: string) => {
    update(courses.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  const addModule = (courseId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? { ...c, modules: [...c.modules, createEmptyModule()] }
          : c
      )
    );
  };

  const deleteModule = (courseId: string, moduleId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? { ...c, modules: c.modules.filter((m) => m.id !== moduleId) }
          : c
      )
    );
  };

  const updateModule = (
    courseId: string,
    moduleId: string,
    field: keyof Module,
    value: string | number
  ) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId ? { ...m, [field]: value } : m
              ),
            }
          : c
      )
    );
  };

  const addQuiz = (courseId: string, moduleId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? { ...m, quizQuestions: [...m.quizQuestions, createEmptyQuiz()] }
                  : m
              ),
            }
          : c
      )
    );
  };

  const deleteQuiz = (courseId: string, moduleId: string, quizId: string) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? { ...m, quizQuestions: m.quizQuestions.filter((q) => q.id !== quizId) }
                  : m
              ),
            }
          : c
      )
    );
  };

  const updateQuiz = (
    courseId: string,
    moduleId: string,
    quizId: string,
    field: string,
    value: string | number | [string, string, string, string]
  ) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? {
                      ...m,
                      quizQuestions: m.quizQuestions.map((q) =>
                        q.id === quizId ? { ...q, [field]: value } : q
                      ),
                    }
                  : m
              ),
            }
          : c
      )
    );
  };

  const updateQuizOption = (
    courseId: string,
    moduleId: string,
    quizId: string,
    optIndex: number,
    value: string
  ) => {
    update(
      courses.map((c) =>
        c.id === courseId
          ? {
              ...c,
              modules: c.modules.map((m) =>
                m.id === moduleId
                  ? {
                      ...m,
                      quizQuestions: m.quizQuestions.map((q) => {
                        if (q.id !== quizId) return q;
                        const newOpts: [string, string, string, string] = [...q.options];
                        newOpts[optIndex] = value;
                        return { ...q, options: newOpts };
                      }),
                    }
                  : m
              ),
            }
          : c
      )
    );
  };

  const updateSnippetField = (weekIdx: number, dayIdx: number, field: "title", value: string) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => di === dayIdx ? { ...d, [field]: value } : d),
      };
    });
    updateSnippets(updated);
  };

  const updateSnippetBullet = (weekIdx: number, dayIdx: number, bulletIdx: number, value: string) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          const newBullets = [...d.bullets];
          newBullets[bulletIdx] = value;
          return { ...d, bullets: newBullets };
        }),
      };
    });
    updateSnippets(updated);
  };

  const addSnippetBullet = (weekIdx: number, dayIdx: number) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          return { ...d, bullets: [...d.bullets, ""] };
        }),
      };
    });
    updateSnippets(updated);
  };

  const removeSnippetBullet = (weekIdx: number, dayIdx: number, bulletIdx: number) => {
    const updated = snippetWeeks.map((w, wi) => {
      if (wi !== weekIdx) return w;
      return {
        ...w,
        days: w.days.map((d, di) => {
          if (di !== dayIdx) return d;
          return { ...d, bullets: d.bullets.filter((_, bi) => bi !== bulletIdx) };
        }),
      };
    });
    updateSnippets(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert courses
      const courseRows = courses.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        cover_image_url: c.coverImageUrl,
        category: c.category,
        difficulty: c.difficulty,
        estimated_duration: c.estimatedDuration,
        modules: JSON.stringify(c.modules),
      }));

      // Get existing IDs to detect deletions
      const { data: existing } = await supabase.from("education_courses").select("id");
      const existingIds = new Set((existing || []).map((r: { id: string }) => r.id));
      const currentIds = new Set(courses.map((c) => c.id));
      const deletedIds = [...existingIds].filter((id) => !currentIds.has(id));

      if (deletedIds.length > 0) {
        await supabase.from("education_courses").delete().in("id", deletedIds);
      }
      if (courseRows.length > 0) {
        const { error } = await supabase.from("education_courses").upsert(courseRows, { onConflict: "id" });
        if (error) throw error;
      }

      // Upsert snippets
      const snippetRows = snippetWeeks.map((sw, i) => ({
        id: `snippet-week-${i}`,
        week_range: sw.weekRange,
        days: JSON.stringify(sw.days),
      }));
      if (snippetRows.length > 0) {
        const { error } = await supabase.from("education_snippets").upsert(snippetRows, { onConflict: "id" });
        if (error) throw error;
      }

      setDirty(false);
      setToast({ message: "All changes saved successfully", type: "success" });
    } catch (err) {
      console.error("Save error:", err);
      setToast({ message: "Failed to save changes", type: "error" });
    }
    setSaving(false);
  };

  const handleDiscard = () => {
    loadFromSupabase();
    setDirty(false);
  };

  const handleExport = () => {
    const data = { courses, snippetWeeks };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "education-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setToast({ message: "Exported education data as JSON", type: "success" });
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.courses && Array.isArray(data.courses)) {
          setCourses(data.courses);
          if (data.snippetWeeks) setSnippetWeeks(data.snippetWeeks);
          setDirty(true);
          setToast({ message: "Imported education data from JSON", type: "success" });
        } else {
          setToast({ message: "Invalid JSON format", type: "error" });
        }
      } catch {
        setToast({ message: "Failed to parse JSON file", type: "error" });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const difficultyColors: Record<string, string> = {
    Beginner: "bg-green-100 text-green-700",
    Intermediate: "bg-amber-100 text-amber-700",
    Advanced: "bg-red-100 text-red-700",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm">Loading education content...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Section tabs */}
      <div className="flex items-center gap-1 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100 w-fit">
        <button
          onClick={() => setActiveSection("courses")}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeSection === "courses" ? "bg-[#20c858] text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Courses ({courses.length})
        </button>
        <button
          onClick={() => setActiveSection("snippets")}
          className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            activeSection === "snippets" ? "bg-[#20c858] text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
        >
          Daily Snippets
        </button>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        {activeSection === "courses" && (
          <button
            onClick={addCourse}
            className="px-4 py-2 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1ab34d] transition-colors"
          >
            + Add Course
          </button>
        )}
        <button
          onClick={handleExport}
          className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Export JSON
        </button>
        <label className="px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
          Import JSON
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
        </label>
        <div className="ml-auto flex items-center gap-3">
          {dirty && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
              <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
              Unsaved changes
            </span>
          )}
          <button
            onClick={handleDiscard}
            disabled={!dirty}
            className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1ab34d] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* COURSES SECTION */}
      {activeSection === "courses" && (
        <div className="space-y-3">
          {/* Category filter tabs */}
          <div className="flex items-center gap-2 bg-white rounded-xl p-2 shadow-sm border border-gray-100">
            {([
              { key: "all" as const, label: "All", color: "bg-gray-600", count: courses.length },
              { key: "exercise" as const, label: "Exercise", color: "bg-blue-500", count: courses.filter(c => c.category === "exercise").length },
              { key: "nutrition" as const, label: "Nutrition", color: "bg-emerald-500", count: courses.filter(c => c.category === "nutrition").length },
              { key: "sleep" as const, label: "Sleep", color: "bg-purple-500", count: courses.filter(c => c.category === "sleep").length },
              { key: "mental" as const, label: "Mental", color: "bg-cyan-500", count: courses.filter(c => c.category === "mental").length },
            ]).map((tab) => {
              const isActive = eduCategoryFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setEduCategoryFilter(tab.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-[#1F2937] text-white" : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isActive ? "bg-white" : tab.color}`} />
                  {tab.label}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-gray-100 text-gray-500"}`}>{tab.count}</span>
                </button>
              );
            })}
          </div>

          {courses.filter(c => eduCategoryFilter === "all" || c.category === eduCategoryFilter).length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm border border-gray-100">
              <p className="text-gray-400 text-sm mb-4">No courses yet. Add one manually or load sample data to get started.</p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={addCourse}
                  className="px-4 py-2 bg-[#20c858] text-white text-sm font-medium rounded-lg hover:bg-[#1ab34d] transition-colors"
                >
                  + Add Course
                </button>
                <button
                  onClick={loadSampleCourses}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Load Sample Courses
                </button>
              </div>
            </div>
          )}

          {courses.filter(c => eduCategoryFilter === "all" || c.category === eduCategoryFilter).map((course) => {
            const totalReadingTime = course.modules.reduce((s, m) => s + m.readingTime, 0);
            return (
              <div
                key={course.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                {/* Course header */}
                <div className="flex items-center gap-4 p-4">
                  <button
                    onClick={() => {
                      setExpandedCourse(expandedCourse === course.id ? null : course.id);
                      setExpandedModule(null);
                      setExpandedQuiz(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className={`w-5 h-5 transition-transform ${
                        expandedCourse === course.id ? "rotate-90" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="text"
                        value={course.name}
                        onChange={(e) => updateCourse(course.id, "name", e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900 flex-1 min-w-[200px]"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${({exercise:"bg-blue-100 text-blue-700",nutrition:"bg-emerald-100 text-emerald-700",sleep:"bg-purple-100 text-purple-700",mental:"bg-cyan-100 text-cyan-700"})[course.category] || "bg-gray-100 text-gray-600"}`}>
                        {course.category}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyColors[course.difficulty]}`}>
                        {course.difficulty}
                      </span>
                      <span className="text-xs text-gray-400">
                        {course.modules.length} module{course.modules.length !== 1 ? "s" : ""} / {totalReadingTime} min
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteCourse(course.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                {/* Expanded: course details + modules */}
                {expandedCourse === course.id && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* Course metadata */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 p-4 bg-gray-50 rounded-xl">
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
                        <textarea
                          value={course.description}
                          onChange={(e) => updateCourse(course.id, "description", e.target.value)}
                          placeholder="Course description..."
                          rows={3}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#20c858] outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Cover Image</label>
                        {course.coverImageUrl ? (
                          <div className="relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={course.coverImageUrl} alt="Cover" className="w-full h-28 object-cover rounded-lg border border-gray-200" />
                            <button
                              onClick={() => updateCourse(course.id, "coverImageUrl", "")}
                              className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <label className="flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#20c858] hover:bg-[#20c858]/5 transition-colors">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const ext = file.name.split(".").pop();
                                  const path = `covers/${course.id}.${ext}`;
                                  const { error: uploadErr } = await supabase.storage.from("education-media").upload(path, file, { upsert: true });
                                  if (uploadErr) { setToast({ message: `Upload failed: ${uploadErr.message}`, type: "error" }); return; }
                                  const { data: urlData } = supabase.storage.from("education-media").getPublicUrl(path);
                                  updateCourse(course.id, "coverImageUrl", urlData.publicUrl);
                                  setToast({ message: "Cover image uploaded", type: "success" });
                                }}
                              />
                              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span className="text-xs text-gray-500">Upload cover</span>
                            </label>
                            <input
                              type="text"
                              value={course.coverImageUrl}
                              onChange={(e) => updateCourse(course.id, "coverImageUrl", e.target.value)}
                              placeholder="or paste image URL"
                              className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#20c858] outline-none text-gray-600"
                            />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
                        <select
                          value={course.category}
                          onChange={(e) => updateCourse(course.id, "category", e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                        >
                          <option value="exercise">Exercise</option>
                          <option value="nutrition">Nutrition</option>
                          <option value="sleep">Sleep</option>
                          <option value="mental">Mental</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Difficulty</label>
                        <select
                          value={course.difficulty}
                          onChange={(e) => updateCourse(course.id, "difficulty", e.target.value)}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                        >
                          <option value="Beginner">Beginner</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Advanced">Advanced</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500 mb-1 block">Estimated Duration</label>
                        <input
                          type="text"
                          value={course.estimatedDuration}
                          onChange={(e) => updateCourse(course.id, "estimatedDuration", e.target.value)}
                          placeholder="e.g. 2 hours"
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                        />
                      </div>
                    </div>

                    {/* Modules */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700">Modules</h3>
                        <button
                          onClick={() => addModule(course.id)}
                          className="px-3 py-1.5 text-sm text-[#20c858] hover:bg-green-50 rounded-lg transition-colors font-medium"
                        >
                          + Add Module
                        </button>
                      </div>
                      <div className="space-y-2">
                        {course.modules.map((mod, idx) => (
                          <div
                            key={mod.id}
                            className={`rounded-lg border overflow-hidden transition-colors ${
                              expandedModule === mod.id ? "border-[#20c858]/30 bg-green-50/20" : "border-gray-200 bg-gray-50"
                            }`}
                          >
                            {/* Module header */}
                            <div className="flex items-center gap-3 p-3">
                              <div className="text-gray-300 cursor-grab flex-shrink-0">
                                <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path d="M7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM7 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 8a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM13 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
                                </svg>
                              </div>
                              <span className="text-xs text-gray-400 font-mono w-6 text-center flex-shrink-0">
                                {idx + 1}
                              </span>
                              <button
                                onClick={() => setExpandedModule(expandedModule === mod.id ? null : mod.id)}
                                className="flex-1 text-left"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-gray-800">{mod.title || "Untitled"}</span>
                                  <span className="text-xs text-gray-400">{mod.readingTime} min read</span>
                                  {mod.quizQuestions.length > 0 && (
                                    <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded">
                                      {mod.quizQuestions.length} quiz Q
                                    </span>
                                  )}
                                </div>
                              </button>
                              <button
                                onClick={() => setPreviewModule(previewModule === mod.id ? null : mod.id)}
                                className={`p-1 rounded transition-colors text-xs ${
                                  previewModule === mod.id ? "bg-[#20c858] text-white" : "text-gray-400 hover:text-gray-600"
                                }`}
                                title="Preview"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => deleteModule(course.id, mod.id)}
                                className="p-1 text-red-400 hover:text-red-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>

                            {/* Module expanded */}
                            {expandedModule === mod.id && (
                              <div className="border-t border-gray-200 p-4 space-y-3 bg-white">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div className="md:col-span-2">
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Title</label>
                                    <input
                                      type="text"
                                      value={mod.title}
                                      onChange={(e) => updateModule(course.id, mod.id, "title", e.target.value)}
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                                      placeholder="Module title"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Reading Time (min)</label>
                                    <input
                                      type="number"
                                      value={mod.readingTime}
                                      onChange={(e) => updateModule(course.id, mod.id, "readingTime", parseInt(e.target.value) || 0)}
                                      className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#20c858] outline-none text-gray-900"
                                      min={1}
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-xs font-medium text-gray-500 mb-1 block">Content (Markdown)</label>
                                  <div className="flex gap-3">
                                    <textarea
                                      value={mod.content}
                                      onChange={(e) => updateModule(course.id, mod.id, "content", e.target.value)}
                                      placeholder="Write module content in markdown..."
                                      rows={8}
                                      className={`px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 focus:ring-2 focus:ring-[#20c858] outline-none resize-y font-mono ${
                                        previewModule === mod.id ? "w-1/2" : "w-full"
                                      }`}
                                    />
                                    {previewModule === mod.id && (
                                      <div className="w-1/2 px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 overflow-y-auto max-h-64">
                                        <p className="text-xs text-gray-400 mb-2 font-medium">Preview</p>
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                          {mod.content || "No content yet..."}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Media: Image + Video */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Image upload */}
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Module Image</label>
                                    {mod.imageUrl ? (
                                      <div className="relative group">
                                        <img src={mod.imageUrl} alt="" className="w-full h-32 object-cover rounded-lg border border-gray-200" />
                                        <button
                                          onClick={() => updateModule(course.id, mod.id, "imageUrl", "")}
                                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="space-y-1.5">
                                        <label className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#20c858] hover:bg-[#20c858]/5 transition-colors">
                                          <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={async (e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              const ext = file.name.split(".").pop();
                                              const path = `modules/${course.id}/${mod.id}.${ext}`;
                                              const { error: uploadErr } = await supabase.storage.from("education-media").upload(path, file, { upsert: true });
                                              if (uploadErr) { setToast({ message: `Upload failed: ${uploadErr.message}`, type: "error" }); return; }
                                              const { data: urlData } = supabase.storage.from("education-media").getPublicUrl(path);
                                              updateModule(course.id, mod.id, "imageUrl", urlData.publicUrl);
                                              setToast({ message: "Image uploaded", type: "success" });
                                            }}
                                          />
                                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                          <span className="text-xs text-gray-500">Upload image</span>
                                        </label>
                                        <input
                                          type="text"
                                          value={mod.imageUrl}
                                          onChange={(e) => updateModule(course.id, mod.id, "imageUrl", e.target.value)}
                                          placeholder="or paste image URL"
                                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#20c858] outline-none text-gray-600"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  {/* Video URL */}
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 mb-1 block">Video URL</label>
                                    {mod.videoUrl ? (() => {
                                      const vUrl = mod.videoUrl;
                                      const ytMatch = vUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
                                      const vimeoMatch = vUrl.match(/vimeo\.com\/(\d+)/);
                                      const embedSrc = ytMatch
                                        ? `https://www.youtube.com/embed/${ytMatch[1]}?rel=0`
                                        : vimeoMatch
                                        ? `https://player.vimeo.com/video/${vimeoMatch[1]}`
                                        : null;
                                      return (
                                      <div className="relative group">
                                        {embedSrc ? (
                                          <iframe
                                            src={embedSrc}
                                            className="w-full h-40 rounded-lg border border-gray-200"
                                            allow="autoplay; fullscreen; picture-in-picture"
                                            allowFullScreen
                                          />
                                        ) : (
                                          <video src={vUrl} controls className="w-full h-40 rounded-lg border border-gray-200 bg-black object-contain" />
                                        )}
                                        <button
                                          onClick={() => updateModule(course.id, mod.id, "videoUrl", "")}
                                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                      </div>);
                                    })() : (
                                      <div className="space-y-1.5">
                                        <div className="flex items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-300 rounded-lg">
                                          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                          <span className="text-xs text-gray-400">Paste a video link below</span>
                                        </div>
                                        <input
                                          type="text"
                                          value={mod.videoUrl}
                                          onChange={(e) => updateModule(course.id, mod.id, "videoUrl", e.target.value)}
                                          placeholder="YouTube or Vimeo URL"
                                          className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#20c858] outline-none text-gray-600"
                                        />
                                        <p className="text-[10px] text-gray-400">Videos are linked by URL to save storage space</p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Quiz section */}
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => setExpandedQuiz(expandedQuiz === mod.id ? null : mod.id)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-purple-50 hover:bg-purple-100/70 transition-colors"
                                  >
                                    <span className="text-sm font-medium text-purple-700">
                                      Quiz Questions ({mod.quizQuestions.length})
                                    </span>
                                    <svg
                                      className={`w-4 h-4 text-purple-400 transition-transform ${
                                        expandedQuiz === mod.id ? "rotate-180" : ""
                                      }`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                  {expandedQuiz === mod.id && (
                                    <div className="p-4 space-y-3">
                                      {mod.quizQuestions.map((q, qi) => (
                                        <div key={q.id} className="p-3 border border-purple-200 rounded-lg bg-purple-50/30 space-y-2">
                                          <div className="flex items-start gap-2">
                                            <span className="text-xs text-purple-400 font-mono mt-2">Q{qi + 1}</span>
                                            <input
                                              type="text"
                                              value={q.question}
                                              onChange={(e) => updateQuiz(course.id, mod.id, q.id, "question", e.target.value)}
                                              placeholder="Question text"
                                              className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-400 outline-none text-gray-900"
                                            />
                                            <button
                                              onClick={() => deleteQuiz(course.id, mod.id, q.id)}
                                              className="p-1 text-red-400 hover:text-red-600"
                                            >
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                              </svg>
                                            </button>
                                          </div>
                                          <div className="grid grid-cols-2 gap-2 pl-6">
                                            {q.options.map((opt, oi) => (
                                              <div key={oi} className="flex items-center gap-1.5">
                                                <input
                                                  type="radio"
                                                  name={`quiz-${q.id}`}
                                                  checked={q.correctIndex === oi}
                                                  onChange={() => updateQuiz(course.id, mod.id, q.id, "correctIndex", oi)}
                                                  className="accent-[#20c858]"
                                                />
                                                <input
                                                  type="text"
                                                  value={opt}
                                                  onChange={(e) => updateQuizOption(course.id, mod.id, q.id, oi, e.target.value)}
                                                  placeholder={`Option ${oi + 1}`}
                                                  className={`flex-1 px-2 py-1 border rounded text-xs focus:ring-1 outline-none text-gray-900 ${
                                                    q.correctIndex === oi ? "border-green-400 bg-green-50 focus:ring-green-400" : "border-gray-200 focus:ring-purple-400"
                                                  }`}
                                                />
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                      <button
                                        onClick={() => addQuiz(course.id, mod.id)}
                                        className="px-3 py-1.5 text-xs text-purple-600 hover:bg-purple-50 rounded-lg transition-colors font-medium"
                                      >
                                        + Add Question
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {course.modules.length === 0 && (
                          <p className="text-center text-gray-300 text-sm py-6">No modules yet. Add one above.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* DAILY SNIPPETS SECTION */}
      {activeSection === "snippets" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Daily Educational Snippets</h3>
              <p className="text-xs text-gray-400 mt-0.5">7 snippets per week, 8 weeks. Each snippet has a title and 3-5 bullet points.</p>
            </div>
            {snippetWeeks.every(w => w.days.every(d => !d.title)) && (
              <button
                onClick={loadSampleSnippets}
                className="px-3 py-1.5 bg-white border border-gray-300 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Load Sample Snippets
              </button>
            )}
          </div>

          {/* Week tabs */}
          <div className="px-4 pt-4">
            <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 w-fit">
              {weekRanges.map((wr, wi) => (
                <button
                  key={wi}
                  onClick={() => { setSnippetWeekIdx(wi); setSnippetPreviewDay(null); }}
                  className={`px-4 py-1.5 text-xs rounded-md font-medium transition-colors ${
                    snippetWeekIdx === wi
                      ? "bg-white text-gray-800 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {wr}
                </button>
              ))}
            </div>
          </div>

          {/* Snippets grid */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {snippetWeeks[snippetWeekIdx].days.map((snippet, dayIdx) => (
              <div key={dayIdx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-white hover:border-[#20c858]/30 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase">{dayLabels[dayIdx]}</span>
                  <button
                    onClick={() => setSnippetPreviewDay(snippetPreviewDay === dayIdx ? null : dayIdx)}
                    className={`p-0.5 rounded text-xs ${
                      snippetPreviewDay === dayIdx ? "bg-[#20c858] text-white" : "text-gray-300 hover:text-gray-500"
                    }`}
                    title="Preview"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  value={snippet.title}
                  onChange={(e) => updateSnippetField(snippetWeekIdx, dayIdx, "title", e.target.value)}
                  placeholder="Snippet title"
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:ring-1 focus:ring-[#20c858] outline-none text-gray-900"
                />
                <div className="space-y-1">
                  {snippet.bullets.map((bullet, bi) => (
                    <div key={bi} className="flex items-center gap-1">
                      <span className="w-1 h-1 bg-gray-300 rounded-full flex-shrink-0" />
                      <input
                        type="text"
                        value={bullet}
                        onChange={(e) => updateSnippetBullet(snippetWeekIdx, dayIdx, bi, e.target.value)}
                        placeholder={`Bullet ${bi + 1}`}
                        className="flex-1 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] focus:ring-1 focus:ring-[#20c858] outline-none text-gray-900"
                      />
                      {snippet.bullets.length > 1 && (
                        <button
                          onClick={() => removeSnippetBullet(snippetWeekIdx, dayIdx, bi)}
                          className="text-gray-300 hover:text-red-400 text-xs"
                        >
                          x
                        </button>
                      )}
                    </div>
                  ))}
                  {snippet.bullets.length < 5 && (
                    <button
                      onClick={() => addSnippetBullet(snippetWeekIdx, dayIdx)}
                      className="text-[10px] text-[#20c858] hover:underline font-medium"
                    >
                      + bullet
                    </button>
                  )}
                </div>

                {/* Inline preview */}
                {snippetPreviewDay === dayIdx && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <SnippetPreview snippet={snippet} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
