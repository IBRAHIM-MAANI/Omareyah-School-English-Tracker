import React from "react";
import { Palette, Check } from "lucide-react";
import { useTheme, THEMES, ThemeKey } from "../context/ThemeContext";

export default function ThemeSwitcher() {
  const { themeKey, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-3 p-2 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200 shadow-sm">
      <Palette size={16} className="text-slate-400 ml-2" />
      <div className="flex gap-2">
        {(Object.keys(THEMES) as ThemeKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setTheme(key)}
            title={THEMES[key].name}
            className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${THEMES[key].primary} ${themeKey === key ? 'border-slate-900 scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`}
          >
            {themeKey === key && <Check size={12} className="text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}
