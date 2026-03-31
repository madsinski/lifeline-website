export function PhoneMockup() {
  return (
    <div className="relative w-[280px] h-[580px]">
      {/* Phone frame */}
      <div className="absolute inset-0 bg-[#1a1a1a] rounded-[3rem] shadow-2xl border border-[#333]" />
      {/* Inner bezel */}
      <div className="absolute inset-[3px] bg-[#111] rounded-[2.85rem]" />
      {/* Screen */}
      <div className="absolute inset-[4px] rounded-[2.8rem] overflow-hidden bg-[#ecf0f3]">
        {/* Subtle reflection overlay */}
        <div
          className="absolute inset-0 z-30 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.04) 100%)",
          }}
        />

        {/* Dynamic Island notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-[22px] bg-black rounded-full z-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border border-[#333] ml-6" />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-7 pt-[34px] pb-1 relative z-10">
          <span className="text-[10px] font-semibold text-gray-500">9:41</span>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
            <div className="w-4 h-2.5 border border-gray-400 rounded-sm relative">
              <div className="absolute inset-[1px] bg-gray-400 rounded-[1px]" style={{ width: "70%" }} />
              <div className="absolute -right-[3px] top-[2px] w-[2px] h-[4px] bg-gray-400 rounded-r-sm" />
            </div>
          </div>
        </div>

        {/* Lifeline logo */}
        <div className="flex justify-center py-0.5">
          <div className="flex items-center gap-0.5 text-[9px] font-bold tracking-tight">
            <span className="text-[#646464]">LIFE</span>
            <span className="text-[#14D67B]">LI</span>
            <span className="text-[#1FCBDE]">N</span>
            <span className="text-[#14D67B]">E</span>
          </div>
        </div>

        <div className="px-4 pt-1">
          {/* Welcome row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[9px] text-gray-400">Welcome,</p>
              <h2 className="text-sm font-bold text-[#1F2937]">Victor</h2>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
              </svg>
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Quick action circles */}
          <div className="flex justify-between mb-3 px-1">
            {[
              { color: "#20c858", label: "Assessment" },
              { color: "#EF4444", label: "My Health" },
              { color: "#8B5CF6", label: "Coach" },
              { color: "#06B6D4", label: "Community" },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center border-[1.5px]"
                  style={{
                    backgroundColor: `${item.color}15`,
                    borderColor: item.color,
                  }}
                >
                  {item.label === "Assessment" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round">
                      <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2 6.75h5.25M8.25 12h.008v.008H8.25V12zm0 3h.008v.008H8.25V15zm0 3h.008v.008H8.25V18zM4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5H15m-12 0h3.75" />
                    </svg>
                  )}
                  {item.label === "My Health" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={item.color}><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                  )}
                  {item.label === "Coach" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round"><path d="M13 4v7l4 4M4 12a8 8 0 118 8" /><path d="M8 16l-4 4M20 8l-4-4" /></svg>
                  )}
                  {item.label === "Community" && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={item.color}><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
                  )}
                </div>
                <span className="text-[7px] text-gray-500 font-medium">{item.label}</span>
              </div>
            ))}
          </div>

          {/* Actions today section */}
          <div className="bg-[rgba(156,171,194,0.25)] rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-full bg-[#20c85815] border border-[#20c858] flex items-center justify-center">
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#20c858" strokeWidth="3"><path d="M5 13l4 4L19 7" /></svg>
                </div>
                <span className="text-[10px] font-bold text-[#1F2937]">Actions</span>
              </div>
              <div className="flex items-center gap-1 bg-[#F59E0B] bg-opacity-10 border border-[#F59E0B] rounded-full px-1.5 py-0.5">
                <svg width="7" height="7" viewBox="0 0 24 24" fill="#F59E0B"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
                <span className="text-[7px] font-bold text-[#F59E0B]">Focus</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-[#D1D5DB] rounded-full mb-2">
              <div className="h-1 bg-[#20c858] rounded-full" style={{ width: "35%" }} />
            </div>

            {/* Action items */}
            <div className="space-y-1.5">
              {[
                { text: "Why protein is essential", done: true },
                { text: "Vitamins & supplements", done: true },
                { text: "Upper body strength", done: false },
                { text: "8,000 steps goal", done: false },
              ].map((action, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#e6ecf4] rounded-lg px-2.5 py-1.5">
                  <div
                    className="w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: action.done ? "#20c858" : "#3B82F6", backgroundColor: action.done ? "#20c85815" : "transparent" }}
                  >
                    {action.done ? (
                      <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="#20c858" strokeWidth="2.5"><path d="M2 6l3 3 5-5" /></svg>
                    ) : (
                      <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                        <path d="M6.5 6.5v11M17.5 6.5v11M2 9v6M22 9v6M6.5 12h11" />
                      </svg>
                    )}
                  </div>
                  <span className={`text-[9px] ${action.done ? "text-gray-400 line-through" : "text-[#1F2937]"} font-medium`}>
                    {action.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* What's coming up */}
          <div className="bg-[rgba(156,171,194,0.25)] rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[10px] font-bold text-[#1F2937]">What&apos;s coming up</span>
              <span className="w-4 h-4 rounded-full bg-[#20c858] text-white text-[7px] font-bold flex items-center justify-center">3</span>
            </div>
            <div className="space-y-1.5">
              {[
                { text: "Measurements appt", sub: "Mar 30, 09:00", color: "#20c858" },
                { text: "Blood test appt", sub: "Mar 31, 10:00", color: "#3B82F6" },
                { text: "New health report", sub: "Your Q1 report is ready", color: "#F59E0B" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#e6ecf4] rounded-lg px-2.5 py-1.5">
                  <div
                    className="w-5 h-5 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: item.color, backgroundColor: `${item.color}12` }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[9px] font-bold text-[#1F2937] block truncate">{item.text}</span>
                    <span className="text-[7px] text-gray-400 block truncate">{item.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom nav — matches app exactly */}
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* Green divider line */}
          <div className="flex">
            <div className="flex-1 h-[2px] bg-[#20c858]" />
            <div className="flex-1 h-[2px] bg-[#D1D5DB]" />
            <div className="flex-1 h-[2px] bg-[#D1D5DB]" />
            <div className="flex-1 h-[2px] bg-[#D1D5DB]" />
            <div className="flex-1 h-[2px] bg-[#D1D5DB]" />
          </div>
          {/* Nav icons */}
          <div className="flex items-center justify-around bg-[#ecf0f3] py-2 px-2">
            {[
              { color: "#20c858", active: true },
              { color: "#9CA3AF", active: false },
              { color: "#9CA3AF", active: false },
              { color: "#9CA3AF", active: false },
              { color: "#9CA3AF", active: false },
            ].map((nav, i) => (
              <div key={i} className="flex items-center justify-center w-5 h-5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nav.color }} />
              </div>
            ))}
          </div>
          {/* Black spacer — matches app */}
          <div className="h-5 bg-black" />
        </div>
      </div>
    </div>
  );
}

export function PhoneMockupCoach() {
  return (
    <div className="relative w-[280px] h-[580px]">
      {/* Phone frame */}
      <div className="absolute inset-0 bg-[#1a1a1a] rounded-[3rem] shadow-2xl border border-[#333]" />
      {/* Inner bezel */}
      <div className="absolute inset-[3px] bg-[#111] rounded-[2.85rem]" />
      {/* Screen */}
      <div className="absolute inset-[4px] rounded-[2.8rem] overflow-hidden bg-[#ecf0f3]">
        {/* Subtle reflection overlay */}
        <div
          className="absolute inset-0 z-30 pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.04) 100%)",
          }}
        />

        {/* Dynamic Island notch */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-[22px] bg-black rounded-full z-20 flex items-center justify-center">
          <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a] border border-[#333] ml-6" />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-7 pt-[34px] pb-1 relative z-10">
          <span className="text-[10px] font-semibold text-gray-500">9:41</span>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"/></svg>
            <div className="w-4 h-2.5 border border-gray-400 rounded-sm relative">
              <div className="absolute inset-[1px] bg-gray-400 rounded-[1px]" style={{ width: "70%" }} />
              <div className="absolute -right-[3px] top-[2px] w-[2px] h-[4px] bg-gray-400 rounded-r-sm" />
            </div>
          </div>
        </div>

        {/* Header */}
        <div className="px-4 pt-1 pb-2">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            <h2 className="text-sm font-bold text-[#1F2937]">Health Coach</h2>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 bg-[rgba(156,171,194,0.2)] rounded-lg p-0.5 mb-3">
            {["Exercise", "Nutrition", "Mindset"].map((tab, i) => (
              <button
                key={tab}
                className={`flex-1 text-[9px] font-semibold py-1.5 rounded-md transition-all ${
                  i === 0
                    ? "bg-white text-[#1F2937] shadow-sm"
                    : "text-gray-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Weekly overview */}
          <div className="bg-[rgba(156,171,194,0.25)] rounded-xl p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#1F2937]">This week</span>
              <span className="text-[8px] text-[#20c858] font-semibold">3/5 completed</span>
            </div>
            <div className="flex gap-1">
              {["M", "T", "W", "T", "F"].map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[7px] text-gray-400 font-medium">{day}</span>
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      i < 3
                        ? "bg-[#20c858] text-white"
                        : i === 3
                        ? "bg-[#20c858]/20 border border-[#20c858] text-[#20c858]"
                        : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    {i < 3 ? (
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M2 6l3 3 5-5" /></svg>
                    ) : (
                      <span className="text-[7px] font-bold">{i + 1}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Today's workout */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-[#1F2937]">Today&apos;s Workout</span>
              <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Upper Body</span>
            </div>

            <div className="space-y-1.5">
              {[
                { name: "Bench Press", sets: "4x8", weight: "70kg", done: true },
                { name: "Overhead Press", sets: "3x10", weight: "40kg", done: true },
                { name: "Dumbbell Row", sets: "3x12", weight: "22kg", done: false },
                { name: "Lateral Raises", sets: "3x15", weight: "10kg", done: false },
                { name: "Tricep Dips", sets: "3x12", weight: "BW", done: false },
              ].map((exercise, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#e6ecf4] rounded-lg px-2.5 py-2">
                  <div
                    className="w-4 h-4 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: exercise.done ? "#20c858" : "#D1D5DB",
                      backgroundColor: exercise.done ? "#20c85815" : "transparent",
                    }}
                  >
                    {exercise.done && (
                      <svg width="7" height="7" viewBox="0 0 12 12" fill="none" stroke="#20c858" strokeWidth="2.5"><path d="M2 6l3 3 5-5" /></svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[9px] font-semibold block ${exercise.done ? "text-gray-400 line-through" : "text-[#1F2937]"}`}>
                      {exercise.name}
                    </span>
                    <span className="text-[7px] text-gray-400">{exercise.sets} @ {exercise.weight}</span>
                  </div>
                  <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          {/* Coach message */}
          <div className="bg-[#20c858]/10 border border-[#20c858]/30 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-4 h-4 rounded-full bg-[#20c858] flex items-center justify-center">
                <span className="text-[6px] font-bold text-white">CS</span>
              </div>
              <span className="text-[8px] font-bold text-[#1F2937]">Coach Sarah</span>
            </div>
            <p className="text-[8px] text-gray-600 leading-relaxed">
              Great progress this week! Focus on form for the dumbbell rows today. Keep your core tight.
            </p>
          </div>
        </div>

        {/* Bottom nav bar */}
        <div className="absolute bottom-3 left-4 right-4 z-10">
          <div className="flex items-center justify-around bg-white/80 backdrop-blur-sm rounded-2xl py-2 px-2 shadow-sm border border-gray-100">
            {[
              { label: "Home", active: false },
              { label: "Health", active: false },
              { label: "Coach", active: true },
              { label: "Activity", active: false },
              { label: "More", active: false },
            ].map((nav, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: nav.active ? "#8B5CF6" : "transparent" }}
                />
                <span className={`text-[7px] font-medium ${nav.active ? "text-[#8B5CF6]" : "text-gray-400"}`}>{nav.label}</span>
              </div>
            ))}
          </div>
          {/* Black spacer — matches app */}
          <div className="h-5 bg-black" />
        </div>
      </div>
    </div>
  );
}

export default PhoneMockup;
